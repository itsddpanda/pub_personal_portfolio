import requests
from sqlmodel import Session, select, or_, func
from sqlalchemy.dialects.sqlite import insert
from app.models.models import Scheme, NavHistory
from datetime import datetime, date, timedelta
import logging
import time

logger = logging.getLogger(__name__)

MFAPI_BASE_URL = "https://api.mfapi.in/mf"


def scrape_amfi_portal_fallback(amfi_code: str):
    """
    Scrapes the AMFI portal for a specific scheme's recent NAV history when the main API fails.
    Since we don't know the exact last date, we request the last 5 days.
    """
    try:
        # Request data from 5 days ago to today
        start_date = (date.today() - timedelta(days=5)).strftime("%d-%b-%Y")
        url = f"https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt={start_date}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            lines = response.text.splitlines()
            # We need to find our specific amfi_code in this bulk dump

            latest_nav = None
            latest_date = None

            for line in lines:
                parts = line.split(";")
                if len(parts) >= 8 and parts[0].strip() == amfi_code:
                    nav_str = parts[4].strip()
                    date_str = parts[7].strip()

                    try:
                        nav_val = float(nav_str)
                        date_obj = datetime.strptime(date_str, "%d-%b-%Y").date()

                        # Keep the most recent one (the file is usually chronological, but we ensure max date)
                        if not latest_date or date_obj > latest_date:
                            latest_nav = nav_val
                            latest_date = date_obj
                    except ValueError:
                        pass

            if latest_nav and latest_date:
                logger.info(f"Fallback scraper succeeded for {amfi_code}")
                return latest_nav, latest_date

    except Exception as e:
        logger.warning(f"Fallback scraper also failed for {amfi_code}: {e}")

    return None, None


def fetch_latest_nav(amfi_code: str):
    """
    Fetches the latest NAV from mfapi.in. If that fails (e.g., 502), falls back to scraping AMFI.
    Returns: (nav: float, date: date) or (None, None)
    """
    try:
        url = f"{MFAPI_BASE_URL}/{amfi_code}"
        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "SUCCESS" or len(data.get("data", [])) > 0:
                nav_list = data.get("data", [])
                if nav_list:
                    latest = nav_list[0]
                    date_str = latest.get("date")
                    nav_val = float(latest.get("nav"))

                    date_obj = datetime.strptime(date_str, "%d-%m-%Y").date()
                    return nav_val, date_obj
        else:
            logger.warning(
                f"Failed to fetch NAV from mfapi.in for {amfi_code}: Status {response.status_code}. Using fallback."
            )

    except Exception as e:
        logger.warning(
            f"Error fetching NAV from mfapi.in for {amfi_code}: {e}. Using fallback."
        )

    # Trigger fallback if we reach here
    return scrape_amfi_portal_fallback(amfi_code)


def sync_navs(session: Session):
    """
    Iterates through all schemes with AMFI codes that are missing NAVs (latest_nav IS NULL)
    and updates their NAVs using the fallback mfapi.in API.
    """
    three_days_ago = date.today() - timedelta(days=3)
    schemes = session.exec(
        select(Scheme).where(
            Scheme.amfi_code != None,
            or_(Scheme.latest_nav == None, Scheme.latest_nav_date < three_days_ago),
        )
    ).all()
    updated_count = 0
    errors = 0

    # Debug Data
    debug_dump = {}

    for scheme in schemes:
        if not scheme.amfi_code:
            continue

        nav, nav_date = fetch_latest_nav(scheme.amfi_code)

        # Debug Entry
        debug_dump[scheme.isin] = {
            "name": scheme.name,
            "amfi": scheme.amfi_code,
            "api_nav": nav,
            "api_date": str(nav_date) if nav_date else None,
            "status": "success" if nav else "failed",
        }

        if nav and nav_date:
            # Update Scheme Cache
            scheme.latest_nav = nav
            scheme.latest_nav_date = nav_date
            session.add(scheme)

            # Add to History (Idempotent check)
            exists = session.exec(
                select(NavHistory).where(
                    NavHistory.scheme_id == scheme.id, NavHistory.date == nav_date
                )
            ).first()

            if not exists:
                history = NavHistory(scheme_id=scheme.id, date=nav_date, nav=nav)
                session.add(history)

            updated_count += 1
            # Rate limit politeness
            time.sleep(0.1)
        else:
            errors += 1

    session.commit()

    # Write Debug Dump
    import json

    try:
        with open("/data/nav_sync_dump.json", "w") as f:
            json.dump(debug_dump, f, indent=2, default=str)
        logger.info("NAV sync dump written to /data/nav_sync_dump.json")
    except Exception as e:
        logger.error(f"Failed to write NAV dump: {e}")

    return {"updated": updated_count, "errors": errors}


def find_schemes_with_nav_gaps(session: Session, lookback_days: int = 7, min_expected: int = 5):
    """
    Finds schemes with fewer than `min_expected` NavHistory records
    in the last `lookback_days` calendar days.
    Returns: list of (scheme_id, amfi_code, actual_count) tuples.
    """
    today = date.today()
    yesterday = today - timedelta(days=1)
    cutoff = yesterday - timedelta(days=lookback_days)

    results = session.exec(
        select(Scheme.id, Scheme.amfi_code, func.count(NavHistory.id))
        .join(NavHistory, NavHistory.scheme_id == Scheme.id)
        .where(
            Scheme.amfi_code != None, 
            NavHistory.date >= cutoff,
            NavHistory.date <= yesterday
        )
        .group_by(Scheme.id, Scheme.amfi_code)
    ).all()

    seen_ids = set()
    gap_schemes = []

    for scheme_id, amfi_code, count in results:
        seen_ids.add(scheme_id)
        if count < min_expected:
            gap_schemes.append((scheme_id, amfi_code, count))

    # Schemes with ZERO records in the window (no JOIN match)
    all_schemes = session.exec(
        select(Scheme.id, Scheme.amfi_code).where(Scheme.amfi_code != None)
    ).all()

    for sid, amfi in all_schemes:
        if sid not in seen_ids:
            gap_schemes.append((sid, amfi, 0))

    logger.info(f"Gap scan: {len(gap_schemes)} schemes with < {min_expected} NAVs in last {lookback_days} days")
    return gap_schemes


def backfill_historical_nav(
    session: Session, scheme_id: int, amfi_code: str, force: bool = False
):
    """
    Fetches historical NAV data using the Dual-Source Router logic.
    """
    from app.services.mfapi_client import fetch_amfi_date_nav

    scheme = session.get(Scheme, scheme_id)
    if not scheme:
        return False

    logger.info(
        f"Evaluating backfill for scheme {scheme_id} (AMFI: {amfi_code}). Force={force}"
    )
    today = date.today()

    # 1. Throttle Check
    if not force and scheme.last_history_sync:
        gap_since_sync = (today - scheme.last_history_sync).days
        if gap_since_sync <= 7:
            logger.info(
                f"Skipping {amfi_code}. Last sync was {gap_since_sync} days ago."
            )
            return True

    # 2. Calculate Gap
    max_date = session.exec(
        select(func.max(NavHistory.date)).where(NavHistory.scheme_id == scheme_id)
    ).first()

    gap_days = (today - max_date).days if max_date else None
    logger.info(f"Scheme {amfi_code} data gap: {gap_days} days. max_date: {max_date}")

    success = False
    added_count = 0

    try:
        if scheme.last_history_sync is None or gap_days is None or gap_days > 30:
            # Route 1: Brand new sync or Massive Gap -> mfapi.in
            logger.info(
                f"Routing {amfi_code} to mfapi.in (10-Year payload). Reason: last_sync={scheme.last_history_sync}, gap={gap_days}"
            )
            url = f"{MFAPI_BASE_URL}/{amfi_code}"
            response = requests.get(url, timeout=30)

            if response.status_code == 200:
                data = response.json()
                nav_list = data.get("data", [])

                nav_dicts = []
                for item in nav_list:
                    date_str = item.get("date")
                    nav_val = float(item.get("nav"))
                    date_obj = datetime.strptime(date_str, "%d-%m-%Y").date()

                    # If we've never synced history, we need the full backfill so we must not filter by max_date.
                    if (
                        scheme.last_history_sync is None
                        or max_date is None
                        or date_obj > max_date
                    ):
                        nav_dicts.append(
                            {"scheme_id": scheme_id, "date": date_obj, "nav": nav_val}
                        )

                if nav_dicts:
                    stmt = insert(NavHistory).values(nav_dicts)
                    stmt = stmt.on_conflict_do_nothing(
                        index_elements=["scheme_id", "date"]
                    )
                    session.exec(stmt)
                    added_count = len(nav_dicts)
                success = True

        elif gap_days > 0 and gap_days <= 30:
            # Route 2: Maintenance Gap -> AMFI Scraper Loop
            logger.info(f"Routing {amfi_code} to AMFI Scraper ({gap_days} days)")
            nav_dicts = []

            for i in range(1, gap_days + 1):
                target_date = max_date + timedelta(days=i)
                # AMFI doesn't publish NAVs on weekends/holidays, so it may return None. That's fine.
                nav_val = fetch_amfi_date_nav(amfi_code, target_date)
                if nav_val is not None:
                    nav_dicts.append(
                        {"scheme_id": scheme_id, "date": target_date, "nav": nav_val}
                    )

            if nav_dicts:
                stmt = insert(NavHistory).values(nav_dicts)
                stmt = stmt.on_conflict_do_nothing(index_elements=["scheme_id", "date"])
                session.exec(stmt)
                added_count = len(nav_dicts)
            success = True
        else:
            success = True  # gap_days == 0

        # Update sync tracking
        if success:
            session.commit()
            logger.info(f"Backfilled {added_count} NAV records for scheme {scheme_id}")

            # Record that we successfully attempted a sync today (even if 0 rows were added, stops infinite loops)
            scheme.last_history_sync = today

            # Fix latest_nav cache dynamically from DB to ensure accuracy
            latest = session.exec(
                select(NavHistory)
                .where(NavHistory.scheme_id == scheme_id)
                .order_by(NavHistory.date.desc())
            ).first()

            if latest:
                scheme.latest_nav = latest.nav
                scheme.latest_nav_date = latest.date

            session.add(scheme)
            session.commit()
            return True

    except Exception as e:
        logger.error(f"Error backfilling history for {amfi_code}: {e}")
        session.rollback()

    return False


def backfill_all_schemes():
    """
    Finds all schemes that need historical backfill (e.g., those with only 1 history record)
    and triggers the backfill process.
    """
    from app.db.engine import get_session
    from app.models.models import SystemState

    # Needs its own session as it runs in a background task
    session_gen = get_session()
    session = next(session_gen)

    try:
        # Mark sync as in progress
        state = session.get(SystemState, "nav_sync_status")
        if not state:
            state = SystemState(key="nav_sync_status", value="IN_PROGRESS")
        else:
            state.value = "IN_PROGRESS"

        progress_state = session.get(SystemState, "nav_sync_progress")
        if not progress_state:
            progress_state = SystemState(key="nav_sync_progress", value="0/0")
        else:
            progress_state.value = "0/0"

        session.add(state)
        session.add(progress_state)
        session.commit()

        schemes = session.exec(select(Scheme).where(Scheme.amfi_code != None)).all()
        total_schemes = len(schemes)

        for i, scheme in enumerate(schemes):
            # Update progress BEFORE tracking to visually satisfy frontend
            progress_state.value = f"{i}/{total_schemes}"
            session.add(progress_state)
            session.commit()

            # The backfill_historical_nav handles its own 7-day throttle checking.
            # We just trigger it for everyone.
            backfill_historical_nav(session, scheme.id, scheme.amfi_code)
            time.sleep(0.5)

        # Completion Tracking
        state.value = "SUCCESS"
        progress_state.value = f"{total_schemes}/{total_schemes}"
        last_run = session.get(SystemState, "nav_sync_last_run")
        if not last_run:
            last_run = SystemState(
                key="nav_sync_last_run", value=datetime.utcnow().isoformat()
            )
        else:
            last_run.value = datetime.utcnow().isoformat()

        session.add(state)
        session.add(progress_state)
        session.add(last_run)
        session.commit()
    except Exception as e:
        logger.error(f"Error in backfill_all_schemes: {e}")
        state = session.get(SystemState, "nav_sync_status")
        if state:
            state.value = "FAILED"
            session.add(state)
            session.commit()
    finally:
        try:
            next(session_gen)
        except StopIteration:
            pass
