import sys
import os
import requests
import datetime
import logging
from sqlmodel import Session
from sqlmodel import select
from sqlalchemy.dialects.sqlite import insert


# Add the parent directory to the python path so we can import 'app'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# This is supposed to be here
from app.db.engine import get_session, engine
from app.models.models import Scheme, NavHistory, SystemState

log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_str, logging.INFO)
# Configure logging
logging.basicConfig(
    level=log_level,
    format="%(asctime)s | %(levelname)-s | %(name)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("sync_amfi")

AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

# Minimum thresholds for a valid AMFI payload
MIN_TOTAL_LINES = 10_000
MIN_VALID_NAVS = 5_000
# Reject fresh download if it has fewer NAVs than this fraction of the isin_amfi_map
ISIN_MAP_COVERAGE_THRESHOLD = 0.40


def _count_valid_navs(text: str) -> int:
    """Count lines that look like valid scheme;...;NAV;Date rows."""
    count = 0
    for line in text.splitlines():
        parts = line.strip().split(";")
        if len(parts) >= 6 and parts[0].strip().isdigit():
            try:
                float(parts[4].strip())
                datetime.datetime.strptime(parts[5].strip(), "%d-%b-%Y")
                count += 1
            except ValueError:
                pass
    return count


def validate_amfi_payload(text: str, isin_map_path: str | None = None) -> tuple[bool, str]:
    """
    Validate a raw AMFI NAVAll payload.
    Returns (is_valid, reason_string).
    """
    total_lines = len(text.splitlines())
    if total_lines < MIN_TOTAL_LINES:
        return False, f"too few lines ({total_lines} < {MIN_TOTAL_LINES})"

    valid_navs = _count_valid_navs(text)
    if valid_navs < MIN_VALID_NAVS:
        return False, f"too few valid NAV rows ({valid_navs} < {MIN_VALID_NAVS})"

    # Cross-check against isin_amfi_map if available
    if isin_map_path and os.path.exists(isin_map_path):
        try:
            import json
            with open(isin_map_path) as f:
                isin_map = json.load(f)
            expected = len(isin_map)
            min_expected = int(expected * ISIN_MAP_COVERAGE_THRESHOLD)
            if valid_navs < min_expected:
                return False, (
                    f"NAV count ({valid_navs}) is below {ISIN_MAP_COVERAGE_THRESHOLD:.0%} "
                    f"of isin_amfi_map size ({expected}); expected >= {min_expected}"
                )
            logger.debug(
                f"isin_map coverage check passed: {valid_navs}/{expected} "
                f"({valid_navs/expected:.1%})"
            )
        except Exception as e:
            logger.warning(f"Could not load isin_amfi_map for validation: {e}")

    return True, f"{valid_navs} valid NAVs across {total_lines} lines"


def update_status(session: Session, status: str):
    """Updates the sync status in the SystemState table."""
    state = session.get(SystemState, "amfi_bulk_sync_status")
    if not state:
        state = SystemState(key="amfi_bulk_sync_status", value=status)
    else:
        state.value = status
        state.updated_at = datetime.datetime.utcnow()
    session.add(state)

    last_run = session.get(SystemState, "amfi_bulk_sync_last_run")
    if not last_run:
        last_run = SystemState(
            key="amfi_bulk_sync_last_run", value=datetime.datetime.utcnow().isoformat()
        )
    else:
        last_run.value = datetime.datetime.utcnow().isoformat()
        last_run.updated_at = datetime.datetime.utcnow()
    session.add(last_run)

    session.commit()


def run_sync():
    logger.info("Starting AMFI bulk sync...")
    with Session(engine) as session:
        try:
            # 1. Fetch or Load the latest AMFI NAV data
            amfi_file_path = (
                "/data/NAVAll.txt"
                if os.path.exists("/data")
                else os.path.join(os.path.dirname(__file__), "..", "data", "NAVAll.txt")
            )

            # Check for recent cached file using file mtime (more reliable than DB state)
            use_cache = False
            if os.path.exists(amfi_file_path):
                try:
                    file_mtime = datetime.datetime.utcfromtimestamp(
                        os.path.getmtime(amfi_file_path)
                    )
                    time_since_file = datetime.datetime.utcnow() - file_mtime
                    logger.debug(
                        f"Cache file age: {time_since_file.total_seconds() / 3600:.1f} hours"
                    )
                    if time_since_file < datetime.timedelta(hours=12):
                        logger.info(
                            f"Skipping HTTP fetch. Cache file is only {time_since_file.total_seconds() / 3600:.1f} hours old. Using cached payload."
                        )
                        use_cache = True
                except Exception as e:
                    logger.warning(f"Failed to check cache file age: {e}")

            # Mark status as IN_PROGRESS
            update_status(session, "IN_PROGRESS")

            isin_map_path = (
                "/data/isin_amfi_map.json"
                if os.path.exists("/data")
                else os.path.join(os.path.dirname(__file__), "..", "data", "isin_amfi_map.json")
            )

            if not use_cache:
                logger.info(f"Fetching NAV data from {AMFI_URL}")
                response = requests.get(AMFI_URL, timeout=30)
                response.raise_for_status()
                fresh_text = response.text

                # Validate the fresh download before trusting it
                is_valid, reason = validate_amfi_payload(fresh_text, isin_map_path)
                if is_valid:
                    logger.info(f"Fresh payload validated OK: {reason}")
                    payload_text = fresh_text
                    # Persist to disk only if valid (don't overwrite a good cache with garbage)
                    try:
                        os.makedirs(os.path.dirname(amfi_file_path), exist_ok=True)
                        with open(amfi_file_path, "w") as f:
                            f.write(payload_text)
                        logger.debug(f"Successfully cached payload to {amfi_file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to cache NAV payload to disk: {e}")
                else:
                    logger.warning(
                        f"Fresh AMFI payload appears partial/broken: {reason}. "
                        f"Falling back to cached file."
                    )
                    if os.path.exists(amfi_file_path):
                        logger.info(f"Loading fallback NAV data from {amfi_file_path}")
                        with open(amfi_file_path, "r") as f:
                            payload_text = f.read()
                        # Validate the fallback too
                        fb_valid, fb_reason = validate_amfi_payload(payload_text, isin_map_path)
                        if not fb_valid:
                            raise RuntimeError(
                                f"Fallback cache is also invalid: {fb_reason}"
                            )
                        logger.info(f"Fallback cache validated OK: {fb_reason}")
                    else:
                        raise RuntimeError(
                            f"Fresh payload invalid ({reason}) and no fallback cache exists at {amfi_file_path}"
                        )
            else:
                logger.info(f"Loading NAV data from disk cache at {amfi_file_path}")
                with open(amfi_file_path, "r") as f:
                    payload_text = f.read()
                # Validate cached file too (catches a corrupt manual placement)
                is_valid, reason = validate_amfi_payload(payload_text, isin_map_path)
                if not is_valid:
                    logger.warning(
                        f"Cached NAV file failed validation: {reason}. Forcing fresh fetch."
                    )
                    logger.info(f"Fetching NAV data from {AMFI_URL}")
                    response = requests.get(AMFI_URL, timeout=30)
                    response.raise_for_status()
                    payload_text = response.text
                    fv, fr = validate_amfi_payload(payload_text, isin_map_path)
                    if not fv:
                        raise RuntimeError(f"Fresh payload also invalid after cache miss: {fr}")
                    logger.info(f"Fresh payload validated OK: {fr}")
                    try:
                        os.makedirs(os.path.dirname(amfi_file_path), exist_ok=True)
                        with open(amfi_file_path, "w") as f:
                            f.write(payload_text)
                    except Exception as e:
                        logger.warning(f"Failed to write refreshed cache: {e}")

            lines = payload_text.splitlines()
            logger.debug(f"Started processing {len(lines)} lines of data")

            # 2. Build a lookup map of AMFI code -> (NAV, Date)
            amfi_data = {}
            for line in lines:
                line = line.strip()
                parts = line.split(";")
                # Format: Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
                if len(parts) >= 6 and parts[0].strip().isdigit():
                    amfi_code = parts[0].strip()
                    nav_str = parts[4].strip()
                    date_str = parts[5].strip()

                    try:
                        nav = float(nav_str)
                        # AMFI date format is often dd-MMM-YYYY (e.g. 19-Feb-2026)
                        parsed_date = datetime.datetime.strptime(
                            date_str, "%d-%b-%Y"
                        ).date()
                        amfi_data[amfi_code] = (nav, parsed_date)
                    except ValueError:
                        # Skip if NAV is "N.A." or date format is unexpected
                        pass

            logger.debug(f"Parsed {len(amfi_data)} valid scheme NAVs from AMFI")

            # 4. Update schemes in our local database
            schemes = session.exec(select(Scheme).where(Scheme.amfi_code != None)).all()
            
            nav_dicts = []
            
            for scheme in schemes:
                if scheme.amfi_code in amfi_data:
                    nav, nav_date = amfi_data[scheme.amfi_code]

                    # Update cache
                    scheme.latest_nav = nav
                    scheme.latest_nav_date = nav_date
                    session.add(scheme)

                    # Build history records for bulk processing
                    nav_dicts.append({
                        "scheme_id": scheme.id, 
                        "date": nav_date, 
                        "nav": nav
                    })
                    
            if nav_dicts:
                # Add to history if doesn't exist via fast C-binary bulk evaluation
                stmt = insert(NavHistory).values(nav_dicts)
                stmt = stmt.on_conflict_do_nothing(
                    index_elements=["scheme_id", "date"]
                )
                session.exec(stmt)

            session.commit()
            logger.info(f"Successfully updated {len(nav_dicts)} local schemes")

            # 5. Mark status as COMPLETED
            update_status(session, "IDLE")

        except Exception as e:
            logger.error(f"Error during AMFI sync: {e}")
            update_status(session, "FAILED")
            sys.exit(1)


if __name__ == "__main__":
    run_sync()
