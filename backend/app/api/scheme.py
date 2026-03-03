from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from app.db.engine import get_session
from app.models.models import Scheme, Transaction, NavHistory, Folio, Portfolio
from app.services.mfapi_client import (
    fetch_scheme_data,
    extract_metadata,
    extract_nav_history,
)
from uuid import UUID
from typing import List, Dict, Any
from pyxirr import xirr
from datetime import date

from app.models.models import FundEnrichment
from app.services.fund_intelligence import (
    fetch_fund_intelligence,
    prefetch_fund_intelligence_batches,
    parse_enrichment_response,
    DaasProcessingException,
    DaasAuthException,
    MAX_BULK_PREFETCH_SIZE,
)
from app.services.isin_validator import normalize_and_validate_isin
from app.services.interfaces.fund_intel import get_enrichment_for_scheme
from app.services.cache_manager import should_purge

router = APIRouter()


class PrefetchRequest(BaseModel):
    isins: List[str] = Field(default_factory=list)
    batch_size: int = Field(default=MAX_BULK_PREFETCH_SIZE, ge=1, le=MAX_BULK_PREFETCH_SIZE)
    throttle_seconds: float = Field(default=0.3, ge=0)


@router.get("/{amfi_code}")
def get_scheme_details(
    amfi_code: str,
    x_user_id: str = Header(None),
    session: Session = Depends(get_session),
):
    if not x_user_id:
        raise HTTPException(status_code=400, detail="x-user-id header is required")
    try:
        user_id = UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user id")

    # 1. Fetch Scheme
    scheme = session.exec(select(Scheme).where(Scheme.amfi_code == amfi_code)).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # 2. Lazy Load Metadata & History
    if not scheme.fund_house or not scheme.scheme_category:
        mfapi_data = fetch_scheme_data(amfi_code)
        if mfapi_data:
            meta = extract_metadata(mfapi_data)
            scheme.fund_house = meta.get("fund_house")
            scheme.scheme_category = meta.get("scheme_category")
            scheme.scheme_type = meta.get("scheme_type")
            session.add(scheme)

            # Check if NavHistory needs full backfill
            history_count = session.exec(
                select(NavHistory).where(NavHistory.scheme_id == scheme.id)
            ).all()
            if not history_count:
                history_tuples = extract_nav_history(mfapi_data)
                nav_objs = [
                    NavHistory(scheme_id=scheme.id, date=dt, nav=val)
                    for dt, val in history_tuples
                ]
                session.add_all(nav_objs)

            session.commit()
            session.refresh(scheme)

    # 3. Fetch Transactions for this user
    # We must join Folio to ensure it belongs to user_id
    transactions = session.exec(
        select(Transaction)
        .join(Folio)
        .join(Portfolio)
        .where(Transaction.scheme_id == scheme.id, Portfolio.user_id == user_id)
        .order_by(Transaction.date)
    ).all()

    # 4. Calculate Ledger Running Balance & FIFO Invested Value
    ledger = []
    running_units = 0.0

    inflow_types = [
        "PURCHASE",
        "PURCHASE_SIP",
        "SIP",
        "SWITCH_IN",
        "STP_IN",
        "OPENING_BALANCE",
        "DIVIDEND_REINVESTMENT",
    ]
    outflow_types = ["REDEMPTION", "SWITCH_OUT", "STP_OUT", "SWP"]

    fifo_queue = []
    total_stamp_duty = 0.0

    for t in transactions:
        units = t.units or 0.0
        amount = t.amount or 0.0
        t_type = t.type.upper()

        if any(x in t_type for x in inflow_types):
            running_units += units
            if abs(units) > 0:
                cost_per_unit = abs(amount) / abs(units)
                fifo_queue.append({"units": abs(units), "cost_per_unit": cost_per_unit})
        elif any(x in t_type for x in outflow_types):
            running_units -= abs(units)
            units_to_redeem = abs(units)
            while units_to_redeem > 0.0001 and fifo_queue:
                batch = fifo_queue[0]
                if batch["units"] > units_to_redeem:
                    batch["units"] -= units_to_redeem
                    units_to_redeem = 0
                else:
                    units_to_redeem -= batch["units"]
                    fifo_queue.pop(0)

        if "STAMP_DUTY" in t_type:
            total_stamp_duty += abs(amount)
        else:
            ledger.append(
                {
                    "id": t.id,
                    "date": t.date.isoformat(),
                    "type": t.type,
                    "amount": amount,
                    "nav": t.nav,
                    "units": units,
                    "running_balance": round(running_units, 3),
                }
            )

    invested_value = sum(b["units"] * b["cost_per_unit"] for b in fifo_queue)
    current_value = running_units * (scheme.latest_nav or 0.0)

    # 5. Calculate XIRR
    calc_xirr = None
    xirr_status = "VALID"

    # We need dates and amounts for XIRR
    x_dates = []
    x_amounts = []
    has_estimated_opening = False

    for t in transactions:
        t_type = t.type.upper()
        if "STAMP_DUTY" in t_type:
            continue

        if any(x in t_type for x in inflow_types):
            x_dates.append(t.date)
            x_amounts.append(-abs(t.amount or 0.0))
            if "OPENING_BALANCE" in t_type and (t.amount == 0 or t.amount is None):
                has_estimated_opening = True
        elif any(x in t_type for x in outflow_types + ["DIVIDEND"]):
            x_dates.append(t.date)
            x_amounts.append(abs(t.amount or 0.0))

    if has_estimated_opening:
        xirr_status = "ESTIMATED"
    elif len(x_dates) > 0:
        if current_value > 0:
            x_dates.append(date.today())
            x_amounts.append(current_value)

        try:
            raw_xirr = xirr(x_dates, x_amounts)
            if raw_xirr is not None:
                duration_days = (date.today() - min(x_dates)).days
                if duration_days < 365:
                    xirr_status = "LESS_THAN_1_YEAR"
                calc_xirr = raw_xirr * 100
        except Exception:
            xirr_status = "ERROR"

    return {
        "scheme": {
            "name": scheme.name,
            "amfi_code": scheme.amfi_code,
            "isin": scheme.isin,
            "fund_house": scheme.fund_house,
            "category": scheme.scheme_category,
            "type": scheme.scheme_type,
            "latest_nav": scheme.latest_nav,
            "latest_nav_date": (
                scheme.latest_nav_date.isoformat() if scheme.latest_nav_date else None
            ),
        },
        "kpis": {
            "invested_value": round(invested_value, 2),
            "current_value": round(current_value, 2),
            "units": round(running_units, 3),
            "xirr": round(calc_xirr, 2) if calc_xirr is not None else None,
            "xirr_status": xirr_status,
            "stamp_duty": round(total_stamp_duty, 2),
        },
        "ledger": ledger,
    }


@router.get("/{amfi_code}/history")
def get_scheme_history(amfi_code: str, session: Session = Depends(get_session)):
    """
    Returns the historical NAV data for a scheme, sorted by date.
    Used for frontend charting.
    """
    scheme = session.exec(select(Scheme).where(Scheme.amfi_code == amfi_code)).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # Fetch history from local DB
    history = session.exec(
        select(NavHistory)
        .where(NavHistory.scheme_id == scheme.id)
        .order_by(NavHistory.date)
    ).all()

    # If history is empty, try a quick fetch from MFAPI for this specific scheme
    if not history:
        # Note: This is a synchronous fallback for the chart.
        # The background task in CAS upload should have ideally handled this.
        mfapi_data = fetch_scheme_data(amfi_code)
        if mfapi_data:
            history_tuples = extract_nav_history(mfapi_data)
            nav_objs = [
                NavHistory(scheme_id=scheme.id, date=dt, nav=val)
                for dt, val in history_tuples
            ]
            session.add_all(nav_objs)
            session.commit()

            # Re-fetch history
            history = session.exec(
                select(NavHistory)
                .where(NavHistory.scheme_id == scheme.id)
                .order_by(NavHistory.date)
            ).all()

    return {
        "scheme_name": scheme.name,
        "amfi_code": amfi_code,
        "data": [{"date": h.date.isoformat(), "nav": h.nav} for h in history],
    }


@router.post("/{amfi_code}/backfill")
def trigger_scheme_backfill(amfi_code: str, session: Session = Depends(get_session)):
    """
    Manually triggers a full historical NAV backfill for a specific scheme.
    """
    from app.services.nav import backfill_historical_nav

    scheme = session.exec(select(Scheme).where(Scheme.amfi_code == amfi_code)).first()

    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    success = backfill_historical_nav(session, scheme.id, amfi_code, force=True)

    if success:
        return {"status": "success", "message": f"Backfill completed for {amfi_code}"}
    else:
        raise HTTPException(status_code=500, detail="Backfill failed or no data found")


@router.get("/{amfi_code}/enrichment")
def get_scheme_enrichment(
    amfi_code: str, force: bool = False, session: Session = Depends(get_session)
):
    """
    Fetches the Fund Intelligence extended data.
    Returns 503 if the DaaS API is computing it in the background.
    """
    scheme = session.exec(select(Scheme).where(Scheme.amfi_code == amfi_code)).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # 1. Check if we already have it cached
    enrichment = session.exec(
        select(FundEnrichment).where(FundEnrichment.scheme_id == scheme.id)
    ).first()

    if enrichment:
        if force or should_purge(enrichment.fetched_at.date()):
            # Cache expired or forced refresh, delete it and we'll fetch a new one
            session.delete(enrichment)
            session.commit()
            enrichment = None

    # 2. Not cached or expired. Fetch from DaaS API
    if not enrichment:
        try:
            try:
                valid_isin = normalize_and_validate_isin(scheme.isin or "")
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc))

            raw_data = fetch_fund_intelligence(valid_isin)
            if not raw_data:
                raise HTTPException(
                    status_code=404, detail="Intelligence data not found for this ISIN"
                )

            enrichment = parse_enrichment_response(
                scheme.id,
                raw_data,
                mfa_nav=scheme.latest_nav,
                mfa_name=scheme.name,
                session=session,
            )

            session.add(enrichment)
            session.commit()
            session.refresh(enrichment)

        except DaasProcessingException as e:
            # Standard 503 response, telling frontend to try again in `e.retry_after` seconds.
            raise HTTPException(
                status_code=503,
                detail={"status": "processing", "message": str(e)},
                headers={"Retry-After": str(e.retry_after)},
            )
        except DaasAuthException as e:
            raise HTTPException(
                status_code=500, detail="Intelligence API configuration error."
            )

    # 3. Retrieve through DTO layer to ensure encapsulation
    dto = get_enrichment_for_scheme(session, scheme.id)
    if not dto:
        raise HTTPException(status_code=500, detail="Failed to retrieve enrichment DTO")

    return dto


@router.post("/enrichment/prefetch")
def trigger_enrichment_prefetch(payload: PrefetchRequest):
    """Internal worker/API entrypoint to prefetch DaaS enrichment in bulk."""
    try:
        result = prefetch_fund_intelligence_batches(
            payload.isins,
            batch_size=payload.batch_size,
            throttle_seconds=payload.throttle_seconds,
        )
        return {"status": "accepted", "result": result}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except DaasAuthException:
        raise HTTPException(status_code=500, detail="Intelligence API configuration error.")
