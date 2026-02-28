from sqlmodel import Session, select, func, case
from app.models.models import Transaction, Scheme, Portfolio, Folio, SystemState
from pyxirr import xirr
from datetime import date
from typing import List, Dict, Any
from collections import defaultdict


from app.services.interfaces.market_data import get_schemes_by_ids


def get_portfolio_summary(session: Session, user_id: str):
    """
    Calculates Portfolio XIRR and Total Value using SQL aggregations for performance.
    """
    # 1. Fetch Net Units per Scheme using SQL Aggregation
    # Logic: Sum units (Positive for Purchase, Negative for Redemption)
    # Note: casparser typically gives positive units for both, so we use transaction type logic.

    # Define which types reduce units
    REDEMPTION_TYPES = ["REDEMPTION", "SWITCH_OUT", "STP_OUT", "SWP"]

    # Query for holdings: Scheme + Net Units
    # We join folio -> portfolio to filter by user_id
    holdings_query = (
        select(
            Transaction.scheme_id,
            func.sum(
                func.abs(Transaction.units)
                * case((Transaction.type.in_(REDEMPTION_TYPES), -1), else_=1)
            ).label("net_units"),
            func.sum(
                case(
                    (Transaction.type.notin_(REDEMPTION_TYPES), Transaction.amount),
                    else_=0,
                )
            ).label(
                "total_invested"
            ),  # Simple sum of inflows
        )
        .join(Folio, Transaction.folio_id == Folio.id)
        .join(Portfolio, Folio.portfolio_id == Portfolio.id)
        .where(Portfolio.user_id == user_id)
        .group_by(Transaction.scheme_id)
    )

    results = session.exec(holdings_query).all()

    if not results:
        return {"total_value": 0, "invested_value": 0, "xirr": 0, "holdings": []}

    scheme_ids_to_fetch = [r[0] for r in results]
    scheme_dtos = get_schemes_by_ids(session, scheme_ids_to_fetch)
    scheme_map = {s.id: s for s in scheme_dtos}

    processed_holdings = []
    total_current_value = 0.0
    total_invested_value = 0.0

    for scheme_id, net_units, invested_sum in results:
        if net_units < 0.001:
            continue

        scheme_dto = scheme_map.get(scheme_id)
        if not scheme_dto:
            continue

        nav = scheme_dto.latest_nav if scheme_dto.latest_nav else 0.0
        current_val = net_units * nav

        total_current_value += current_val
        total_invested_value += invested_sum

        processed_holdings.append(
            {
                "scheme_id": scheme_id,
                "scheme_name": scheme_dto.name,
                "isin": scheme_dto.isin,
                "amfi_code": scheme_dto.amfi_code,
                "latest_nav_date": scheme_dto.latest_nav_date,
                "units": float(net_units),
                "current_nav": nav,
                "current_value": current_val,
                "invested_value": float(invested_sum),
            }
        )

    # 2. Fetch Transactions for XIRR & FIFO Cost Basis
    # We need: date, amount, type, units, nav, scheme_id

    txn_query = (
        select(Transaction)
        .join(Folio, Transaction.folio_id == Folio.id)
        .join(Portfolio, Folio.portfolio_id == Portfolio.id)
        .where(Portfolio.user_id == user_id)
        .order_by(Transaction.date)  # FIFO requires chronological order
    )

    txns = session.exec(txn_query).all()

    # FIFO Queues: scheme_id -> List of {units, cost_per_unit}
    fifo_queues = defaultdict(list)
    estimated_schemes = set()  # Track schemes with zero-cost OPENING_BALANCE
    opening_balance_details = {}  # scheme_id -> {units, date}

    # Global XIRR Cash Flows
    dates = []
    amounts = []

    # Scheme XIRR Cash Flows & Dates
    scheme_xirr_data = defaultdict(lambda: {"dates": [], "amounts": []})
    scheme_first_investment_date = {}

    total_stamp_duty = 0.0

    inflow_types = [
        "PURCHASE",
        "PURCHASE_SIP",
        "SIP",
        "SWITCH_IN",
        "STP_IN",
        "OPENING_BALANCE",
    ]
    outflow_types = ["REDEMPTION", "SWITCH_OUT", "STP_OUT", "SWP"]

    for t in txns:
        t_type = t.type.upper()

        # Track stamp duty
        if "STAMP_DUTY" in t_type:
            total_stamp_duty += abs(t.amount) if t.amount else 0
            continue

        # --- FIFO Logic ---
        # Only track schemes that are in our holdings list (optimization? No, need all history)

        if any(x in t_type for x in inflow_types):
            # Add to queue
            # Cost per unit = Amount / Units (Should match NAV usually, but Amount is source of truth)
            if t.units and t.units > 0:
                cost_per_unit = t.amount / t.units
                fifo_queues[t.scheme_id].append(
                    {"units": t.units, "cost_per_unit": cost_per_unit}
                )
                if cost_per_unit == 0 and "OPENING_BALANCE" in t_type:
                    estimated_schemes.add(t.scheme_id)
                    opening_balance_details[t.scheme_id] = {
                        "units": float(t.units),
                        "date": t.date.isoformat() if t.date else None,
                    }

        elif any(x in t_type for x in outflow_types):
            # Remove from queue (First In, First Out)
            units_to_redeem = abs(t.units) if t.units else 0

            # Scheme queue
            queue = fifo_queues[t.scheme_id]

            while units_to_redeem > 0.0001 and queue:
                batch = queue[0]
                if batch["units"] > units_to_redeem:
                    # Partial removal from this batch
                    batch["units"] -= units_to_redeem
                    units_to_redeem = 0
                else:
                    # Exhaust this batch
                    units_to_redeem -= batch["units"]
                    queue.pop(0)

        # --- XIRR Logic ---
        cash_flow = 0.0

        if any(x in t_type for x in inflow_types):
            cash_flow = -abs(t.amount)
            # Track first investment date for scheme
            if t.scheme_id not in scheme_first_investment_date and t.date:
                scheme_first_investment_date[t.scheme_id] = t.date
        elif any(x in t_type for x in (outflow_types + ["DIVIDEND"])):
            cash_flow = abs(t.amount)

        if cash_flow != 0:
            dates.append(t.date)
            amounts.append(cash_flow)
            scheme_xirr_data[t.scheme_id]["dates"].append(t.date)
            scheme_xirr_data[t.scheme_id]["amounts"].append(cash_flow)

    # 3. Calculate Final Invested Value from FIFO Queues
    total_invested_value = 0.0
    scheme_invested_map = defaultdict(float)

    for scheme_id, queue in fifo_queues.items():
        invested = sum(b["units"] * b["cost_per_unit"] for b in queue)
        scheme_invested_map[scheme_id] = invested
        total_invested_value += invested

    # 4. Integrate with Processed Holdings
    # processed_holdings already has current_value from SQL aggregation
    # We update the invested_value from our FIFO calculation

    final_holdings = []
    for h in processed_holdings:
        # Match by scheme ID?
        # Wait, processed_holdings is a list of dicts, I don't have scheme_id easily unless I check ISIN or add it.
        # Let's verify what processed_holdings has.
        # It has "isin". I can map scheme_id -> isin from the SQL query earlier.
        # Or better: Update processed_holdings loop to include scheme_id.
        pass  # Handle in next step if needed, but wait:

    # Re-map holdings to inject invested_value
    latest_nav_date = None
    for ph in processed_holdings:
        scheme_id = ph["scheme_id"]
        net_units = ph["units"]
        nav = ph["current_nav"]
        current_val = ph["current_value"]

        # Track max NAV date among active holdings
        if ph["latest_nav_date"]:
            if not latest_nav_date or ph["latest_nav_date"] > latest_nav_date:
                latest_nav_date = ph["latest_nav_date"]

        fifo_invested = scheme_invested_map.get(scheme_id, 0.0)

        # --- Per-Scheme XIRR Calculation & Edge Cases ---
        s_xirr = None
        s_xirr_status = "VALID"

        if scheme_id in estimated_schemes:
            s_xirr_status = "ESTIMATED"
        else:
            first_date = scheme_first_investment_date.get(scheme_id)
            if first_date and latest_nav_date:
                duration = (latest_nav_date - first_date).days
                if duration < 365:
                    s_xirr_status = "LESS_THAN_1_YEAR"
                else:
                    s_dates = scheme_xirr_data[scheme_id]["dates"].copy()
                    s_amounts = scheme_xirr_data[scheme_id]["amounts"].copy()

                    if current_val > 0:
                        s_dates.append(date.today())
                        s_amounts.append(current_val)

                    try:
                        if s_dates:
                            calc_xirr = xirr(s_dates, s_amounts)
                            if calc_xirr is not None:
                                s_xirr = calc_xirr * 100
                    except Exception:
                        s_xirr_status = "ERROR"
            else:
                s_xirr_status = "MISSING_DATES"

        holding_entry = {
            "scheme_name": ph["scheme_name"],
            "isin": ph["isin"],
            "amfi_code": ph["amfi_code"],
            "units": float(net_units),
            "current_nav": nav,
            "current_value": current_val,
            "invested_value": float(fifo_invested),
            "is_estimated": scheme_id in estimated_schemes,
            "xirr": s_xirr,
            "xirr_status": s_xirr_status,
        }

        if scheme_id in estimated_schemes:
            ob = opening_balance_details.get(scheme_id, {})
            holding_entry["opening_balance_units"] = ob.get("units", 0)
            holding_entry["opening_balance_date"] = ob.get("date")
            holding_entry["purchased_units"] = float(net_units) - ob.get("units", 0)
            holding_entry["purchased_invested"] = float(fifo_invested)

        final_holdings.append(holding_entry)

    # Add terminal value for Portfolio XIRR
    if total_current_value > 0:
        dates.append(date.today())
        amounts.append(total_current_value)

    # Calculate XIRR
    try:
        if not dates or not amounts:
            xirr_val = 0.0
        elif not any(a > 0 for a in amounts) or not any(a < 0 for a in amounts):
            # PyXIRR requires at least one positive (inflow) and one negative (outflow/current value)
            xirr_val = 0.0
        else:
            xirr_val = xirr(dates, amounts)
            if xirr_val is None:
                xirr_val = 0.0
    except Exception as e:
        print(f"XIRR Error: {e}")
        xirr_val = 0.0

    # Fetch System State for Sync
    sys_status = session.get(SystemState, "nav_sync_status")
    sys_last_run = session.get(SystemState, "nav_sync_last_run")

    return {
        "total_value": total_current_value,
        "invested_value": total_invested_value,
        "xirr": xirr_val * 100 if xirr_val else 0.0,  # Percentage
        "latest_nav_date": latest_nav_date.isoformat() if latest_nav_date else None,
        "holdings": final_holdings,
        "has_estimated_holdings": len(estimated_schemes) > 0,
        "estimated_schemes_count": len(estimated_schemes),
        "total_stamp_duty": round(total_stamp_duty, 2),
        "nav_sync_status": sys_status.value if sys_status else "IDLE",
        "nav_sync_last_run": sys_last_run.value if sys_last_run else None,
    }
