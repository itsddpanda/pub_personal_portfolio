import sys
import os
import json
import logging
import datetime
from sqlmodel import Session, select
from sqlalchemy.dialects.sqlite import insert

# Ensure app module can be found when running inside container
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append("/app")

from app.db.engine import engine
from app.models.models import Scheme, NavHistory, SystemState
from app.services.nav import find_schemes_with_nav_gaps
from app.services.mfapi_client import fetch_amfi_range_navs_bulk

log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_str, logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s | %(levelname)-s | %(name)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("heal_nav_gaps")


def run_heal():
    logger.info("Starting NAV gap healer...")
    today = datetime.date.today()
    yesterday = today - datetime.timedelta(days=1)
    report = {}

    with Session(engine) as session:
        try:
            # 1. Scan for gapped schemes
            gap_schemes = find_schemes_with_nav_gaps(session)
            logger.info(f"Found {len(gap_schemes)} schemes with NAV gaps")

            if not gap_schemes:
                logger.info("No gaps detected. Nothing to heal.")
                _update_state(session, "0 gaps found")
                return

            lookback_days = 7
            gap_start = yesterday - datetime.timedelta(days=lookback_days)

            logger.info(f"Fetching bulk gap data from {gap_start} to {yesterday}")
            bulk_navs = fetch_amfi_range_navs_bulk(gap_start, yesterday)

            healed = 0
            failed = 0

            # Get cutoff for cache updates
            cutoff = today - datetime.timedelta(days=lookback_days)

            for scheme_id, amfi_code, current_count in gap_schemes:
                try:                   
                    logger.debug(f"{amfi_code}: checking bulk results")

                    # 3. Get missing NAVs from the bulk fetch
                    nav_records = bulk_navs.get(amfi_code, [])

                    if nav_records:
                        # 4. Upsert into NavHistory
                        nav_dicts = [
                            {"scheme_id": scheme_id, "date": d, "nav": n}
                            for d, n in nav_records
                        ]
                        stmt = insert(NavHistory).values(nav_dicts)
                        stmt = stmt.on_conflict_do_nothing(
                            index_elements=["scheme_id", "date"]
                        )
                        session.exec(stmt)

                        # 5. Update Scheme cache with the freshest NAV
                        latest = max(nav_records, key=lambda x: x[0])
                        scheme = session.get(Scheme, scheme_id)
                        if scheme and latest[0] >= (scheme.latest_nav_date or cutoff):
                            scheme.latest_nav = latest[1]
                            scheme.latest_nav_date = latest[0]
                            session.add(scheme)

                        session.commit()

                    report[amfi_code] = {
                        "status": "healed",
                        "had": current_count,
                        "fetched": len(nav_records),
                        "range": f"{gap_start} → {today}",
                    }
                    healed += 1

                except Exception as e:
                    logger.error(f"Failed to heal {amfi_code}: {e}")
                    report[amfi_code] = {"status": "error", "error": str(e)}
                    failed += 1
                    session.rollback()

            summary = f"healed {healed}/{len(gap_schemes)} schemes, {failed} failed"
            logger.info(f"Healing complete: {summary}")
            _update_state(session, summary)

        except Exception as e:
            logger.error(f"Fatal error in heal_nav_gaps: {e}")
            _update_state(session, f"FAILED: {e}")

    # Write report
    try:
        report_path = "/data/nav_heal_report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        logger.info(f"Heal report written to {report_path}")
    except Exception as e:
        logger.error(f"Failed to write heal report: {e}")


def _update_state(session: Session, result: str):
    """Updates SystemState with heal run metadata."""
    for key, value in [
        ("nav_heal_last_run", datetime.datetime.utcnow().isoformat()),
        ("nav_heal_result", result),
    ]:
        state = session.get(SystemState, key)
        if not state:
            state = SystemState(key=key, value=value)
        else:
            state.value = value
            state.updated_at = datetime.datetime.utcnow()
        session.add(state)
    session.commit()


if __name__ == "__main__":
    run_heal()
