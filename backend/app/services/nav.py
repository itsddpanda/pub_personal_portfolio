import requests
from sqlmodel import Session, select
from app.models.models import Scheme, NavHistory
from datetime import datetime, date
import logging
import time

logger = logging.getLogger(__name__)

MFAPI_BASE_URL = "https://api.mfapi.in/mf"

def fetch_latest_nav(amfi_code: str):
    """
    Fetches the latest NAV from mfapi.in for a given AMFI code.
    Returns: (nav: float, date: date) or (None, None)
    """
    try:
        url = f"{MFAPI_BASE_URL}/{amfi_code}"
        # MFAPI might rate limit if we hit too fast, but it claims to be open.
        # Adding a small sleep if needed, but for now strict 1 request.
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "SUCCESS" or len(data.get("data", [])) > 0:
                nav_list = data.get("data", [])
                if nav_list:
                    latest = nav_list[0]
                    # Format: "date": "dd-mm-yyyy", "nav": "123.45"
                    date_str = latest.get("date")
                    nav_val = float(latest.get("nav"))
                    
                    # Parse Date
                    date_obj = datetime.strptime(date_str, "%d-%m-%Y").date()
                    return nav_val, date_obj
        else:
            logger.error(f"Failed to fetch NAV for {amfi_code}: Status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Error fetching NAV for {amfi_code}: {e}")
        
    return None, None

def sync_navs(session: Session):
    """
    Iterates through all schemes with AMFI codes that are missing NAVs (latest_nav IS NULL)
    and updates their NAVs using the fallback mfapi.in API.
    """
    schemes = session.exec(
        select(Scheme).where(Scheme.amfi_code != None, Scheme.latest_nav == None)
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
            "status": "success" if nav else "failed"
        }
        
        if nav and nav_date:
            # Update Scheme Cache
            scheme.latest_nav = nav
            scheme.latest_nav_date = nav_date
            session.add(scheme)
            
            # Add to History (Idempotent check)
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
