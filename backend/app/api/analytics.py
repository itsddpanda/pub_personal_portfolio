from fastapi import APIRouter, Depends, HTTPException, Header
from sqlmodel import Session
from app.db.engine import get_session
from app.services.analytics import get_portfolio_summary
from app.models.models import User
from uuid import UUID

router = APIRouter()


@router.get("/summary")
async def get_summary(
    include_redeemed: bool = False,
    x_user_id: str = Header(None), session: Session = Depends(get_session)
):
    """
    Returns the analytics summary for the user identified by x-user-id.
    """
    if not x_user_id:
        raise HTTPException(status_code=400, detail="x-user-id header is required")

    try:
        user_uuid = UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid x-user-id format")

    # Check if user exists
    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    summary = get_portfolio_summary(session, user_uuid, include_redeemed=include_redeemed)
    return summary
