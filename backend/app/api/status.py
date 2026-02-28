from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.db.engine import get_session
from app.models.models import SystemState

router = APIRouter()


@router.get("/sync")
async def get_sync_status(session: Session = Depends(get_session)):
    """
    Returns the current status of the background AMFI NAV sync cron job.
    """
    state_obj = session.get(SystemState, "nav_sync_status")
    last_run_obj = session.get(SystemState, "nav_sync_last_run")
    progress_obj = session.get(SystemState, "nav_sync_progress")

    is_syncing = False
    if state_obj and state_obj.value == "IN_PROGRESS":
        is_syncing = True

    last_synced = last_run_obj.value if last_run_obj else None
    progress = progress_obj.value if progress_obj else "0/0"

    return {"is_syncing": is_syncing, "last_synced": last_synced, "progress": progress}
