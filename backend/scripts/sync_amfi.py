import sys
import os
import requests
import datetime
import logging
from sqlmodel import Session
from sqlmodel import select

# Add the parent directory to the python path so we can import 'app'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.engine import get_session, engine
from app.models.models import Scheme, NavHistory, SystemState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("sync_amfi")

AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

def update_status(session: Session, status: str):
    """Updates the sync status in the SystemState table."""
    state = session.get(SystemState, "nav_sync_status")
    if not state:
        state = SystemState(key="nav_sync_status", value=status)
    else:
        state.value = status
        state.updated_at = datetime.datetime.utcnow()
    session.add(state)
    
    last_run = session.get(SystemState, "nav_sync_last_run")
    if not last_run:
        last_run = SystemState(key="nav_sync_last_run", value=datetime.datetime.utcnow().isoformat())
    else:
        last_run.value = datetime.datetime.utcnow().isoformat()
        last_run.updated_at = datetime.datetime.utcnow()
    session.add(last_run)
    
    session.commit()

def run_sync():
    logger.info("Starting AMFI bulk sync...")
    with Session(engine) as session:
        # 1. Mark status as IN_PROGRESS
        update_status(session, "IN_PROGRESS")
        
        try:
            # 2. Fetch the latest AMFI NAV data
            logger.info(f"Fetching NAV data from {AMFI_URL}")
            response = requests.get(AMFI_URL, timeout=30)
            response.raise_for_status()
            lines = response.text.splitlines()
            logger.info(f"Received {len(lines)} lines of data")
            
            # 3. Build a lookup map of AMFI code -> (NAV, Date)
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
                        parsed_date = datetime.datetime.strptime(date_str, "%d-%b-%Y").date()
                        amfi_data[amfi_code] = (nav, parsed_date)
                    except ValueError:
                        # Skip if NAV is "N.A." or date format is unexpected
                        pass
            
            logger.info(f"Parsed {len(amfi_data)} valid scheme NAVs from AMFI")
            
            # 4. Update schemes in our local database
            schemes = session.exec(select(Scheme).where(Scheme.amfi_code != None)).all()
            updated_count = 0
            
            for scheme in schemes:
                if scheme.amfi_code in amfi_data:
                    nav, nav_date = amfi_data[scheme.amfi_code]
                    
                    # Update cache
                    scheme.latest_nav = nav
                    scheme.latest_nav_date = nav_date
                    session.add(scheme)
                    
                    # Add to history if doesn't exist
                    exists = session.exec(
                        select(NavHistory).where(
                            NavHistory.scheme_id == scheme.id,
                            NavHistory.date == nav_date
                        )
                    ).first()
                    
                    if not exists:
                        history = NavHistory(
                            scheme_id=scheme.id,
                            date=nav_date,
                            nav=nav
                        )
                        session.add(history)
                    
                    updated_count += 1
            
            session.commit()
            logger.info(f"Successfully updated {updated_count} local schemes")
            
            # 5. Mark status as COMPLETED
            update_status(session, "IDLE")
            
        except Exception as e:
            logger.error(f"Error during AMFI sync: {e}")
            update_status(session, "FAILED")
            sys.exit(1)

if __name__ == "__main__":
    run_sync()
