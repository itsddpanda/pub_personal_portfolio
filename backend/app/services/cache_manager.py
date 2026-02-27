import logging
from datetime import date, timedelta
from sqlmodel import Session, select
from typing import Optional

from app.models.models import FundEnrichment
from app.db.engine import engine

logger = logging.getLogger(__name__)


def should_purge(fetched_at: date, api_key_expiry: Optional[date] = None) -> bool:
    """
    Determines if cached data should be hard-deleted based on the DB-PRD rules.
    """
    today = date.today()
    
    # Rule 1: API key expired + 7 days grace
    if api_key_expiry and today > api_key_expiry + timedelta(days=7):
        return True 
    
    # Rule 2: Monthly refresh anchor (7th of next month)
    # E.g., Fetched on Jan 15 -> valid until Feb 7
    # Fetched on Dec 20 -> valid until Jan 7 of next year
    if fetched_at.month == 12:
        next_anchor = date(fetched_at.year + 1, 1, 7)
    else:
        next_anchor = date(fetched_at.year, fetched_at.month + 1, 7)
        
    if today >= next_anchor:
        return True
        
    return False


def purge_expired_enrichments(api_key_expiry: Optional[date] = None):
    """
    Scans the database and deletes expired FundEnrichment records.
    The cascade rules in models.py will auto-delete the child metrics.
    """
    try:
        count = 0
        with Session(engine) as session:
            statement = select(FundEnrichment)
            enrichments = session.exec(statement).all()
            
            for enrichment in enrichments:
                if should_purge(enrichment.fetched_at.date(), api_key_expiry):
                    logger.info(f"Purging expired enrichment cache for Scheme ID {enrichment.scheme_id}")
                    session.delete(enrichment)
                    count += 1
            
            if count > 0:
                session.commit()
                logger.info(f"Purge complete. Removed {count} expired records.")
    except Exception as e:
        logger.error(f"Error during cache purge: {e}")
