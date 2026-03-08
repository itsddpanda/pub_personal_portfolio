from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from app.db.engine import get_session
from app.models.models import User
from typing import List, Optional
from pydantic import BaseModel
import hashlib

router = APIRouter()


class UserRead(BaseModel):
    id: str
    name: str
    is_pin_set: bool


class PinRequest(BaseModel):
    pin: str


@router.get("", response_model=List[UserRead])
async def list_users(session: Session = Depends(get_session)):
    """
    List all users with a flag indicating if they have a PIN set.
    """
    users = session.exec(select(User)).all()
    return [
        UserRead(id=str(user.id), name=user.name, is_pin_set=bool(user.pin_hash))
        for user in users
    ]


@router.post("/{user_id}/verify-pin")
async def verify_pin(
    user_id: str, request: PinRequest, session: Session = Depends(get_session)
):
    """
    Verify if the provided PIN matches the user's stored PIN hash.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.pin_hash:
        return {"success": True}  # No PIN set, allow access

    hashed_input = hashlib.sha256(request.pin.encode()).hexdigest()
    if hashed_input == user.pin_hash:
        return {"success": True}
    else:
        raise HTTPException(status_code=401, detail="Invalid PIN")


@router.post("/{user_id}/set-pin")
async def set_pin(
    user_id: str, request: PinRequest, session: Session = Depends(get_session)
):
    """
    Set or update the PIN for a user.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not request.pin or len(request.pin) != 4 or not request.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")

    hashed_pin = hashlib.sha256(request.pin.encode()).hexdigest()
    user.pin_hash = hashed_pin
    session.add(user)
    session.commit()

    return {"success": True}


@router.post("/{user_id}/remove-pin")
async def remove_pin(
    user_id: str, request: PinRequest, session: Session = Depends(get_session)
):
    """
    Remove PIN for a user after verifying the current PIN.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.pin_hash:
        return {"success": True}  # No PIN to remove

    hashed_input = hashlib.sha256(request.pin.encode()).hexdigest()
    if hashed_input != user.pin_hash:
        raise HTTPException(status_code=401, detail="Incorrect PIN")

    user.pin_hash = None
    session.add(user)
    session.commit()

    return {"success": True}

# --- Intelligence Preferences ---

class HighlightPrefsUpdate(BaseModel):
    expense_ratio_low: Optional[float] = None
    expense_ratio_high: Optional[float] = None
    concentration_top5_high: Optional[float] = None
    beta_high: Optional[float] = None
    beta_low: Optional[float] = None
    ytm_attractive: Optional[float] = None
    pe_discount_pct: Optional[float] = None
    cagr_rank_top: Optional[int] = None
    cagr_outperform_min: Optional[float] = None
    cagr_underperform_min: Optional[float] = None
    risk_profile: Optional[str] = None

@router.get("/{user_id}/highlight-prefs")
async def get_highlight_prefs(user_id: str, session: Session = Depends(get_session)):
    """Get customized intelligence thresholds for the user."""
    from app.models.models import UserHighlightPrefs
    from uuid import UUID
    
    try:
        user_uuid = UUID(user_id)
        prefs = session.exec(
            select(UserHighlightPrefs).where(UserHighlightPrefs.user_id == user_uuid)
        ).first()
        
        if not prefs:
            return {}  # Will fallback to defaults on frontend
            
        # Return all non-null fields
        return {k: v for k, v in prefs.model_dump().items() if v is not None}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")

@router.put("/{user_id}/highlight-prefs")
async def update_highlight_prefs(
    user_id: str, 
    update_data: HighlightPrefsUpdate, 
    session: Session = Depends(get_session)
):
    """Save manual overrides for intelligence thresholds."""
    from app.models.models import UserHighlightPrefs
    from uuid import UUID
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    prefs = session.exec(
        select(UserHighlightPrefs).where(UserHighlightPrefs.user_id == user_uuid)
    ).first()
    
    if not prefs:
        prefs = UserHighlightPrefs(user_id=user_uuid)
        session.add(prefs)
        
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(prefs, key, value)
        
    session.add(prefs)
    session.commit()
    session.refresh(prefs)
    
    return {k: v for k, v in prefs.model_dump().items() if v is not None}

class WizardAnswers(BaseModel):
    time_horizon_years: int
    drawdown_tolerance: str  # "low", "medium", "high"
    cost_sensitivity: str    # "low", "medium", "high"
    style_preference: str    # "active", "passive", "mixed"
    goal: str                # "income", "growth"
    diversification: str     # "broad", "concentrated"
    priority: str            # "outperform", "protect"
    
@router.post("/{user_id}/highlight-prefs/wizard")
async def save_wizard_prefs(
    user_id: str, 
    answers: WizardAnswers, 
    session: Session = Depends(get_session)
):
    """Process questionnaire answers into concrete intelligence thresholds."""
    from app.models.models import UserHighlightPrefs
    from uuid import UUID
    
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = session.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Translate wizard answers into threshold boundaries
    prefs_update = HighlightPrefsUpdate()
    
    # Risk Profile & Volatility
    if answers.drawdown_tolerance == "low" or answers.time_horizon_years < 3:
        prefs_update.risk_profile = "conservative"
        prefs_update.beta_high = 1.05
    elif answers.drawdown_tolerance == "high" and answers.time_horizon_years > 7:
        prefs_update.risk_profile = "aggressive"
        prefs_update.beta_high = 1.3
    else:
        prefs_update.risk_profile = "moderate"
        prefs_update.beta_high = 1.2
        
    # Cost
    if answers.cost_sensitivity == "high" or answers.style_preference == "passive":
        prefs_update.expense_ratio_high = 1.0
        prefs_update.expense_ratio_low = 0.3
    elif answers.cost_sensitivity == "low" and answers.style_preference == "active":
        prefs_update.expense_ratio_high = 2.2
    else:
        prefs_update.expense_ratio_high = 1.8
        
    # Concentration
    if answers.diversification == "broad":
        prefs_update.concentration_top5_high = 25.0
    elif answers.diversification == "concentrated":
        prefs_update.concentration_top5_high = 45.0
        
    # Performance priority
    if answers.priority == "protect":
        prefs_update.cagr_underperform_min = -1.0
        prefs_update.cagr_outperform_min = 2.5 # Harder to impress
    elif answers.priority == "outperform":
        prefs_update.cagr_underperform_min = -3.0 # Lenient on slips if aiming high
        prefs_update.cagr_outperform_min = 1.5
        prefs_update.cagr_rank_top = 10
        
    # Goal
    if answers.goal == "income":
        prefs_update.ytm_attractive = 7.0
    elif answers.goal == "growth":
        prefs_update.ytm_attractive = 8.5 # Harder to impress for yield
        
    # Apply to DB
    prefs = session.exec(
        select(UserHighlightPrefs).where(UserHighlightPrefs.user_id == user_uuid)
    ).first()
    
    if not prefs:
        prefs = UserHighlightPrefs(user_id=user_uuid)
        session.add(prefs)
        
    # Nullify old manual overrides, replace with wizard defaults
    update_dict = prefs_update.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(prefs, key, value)
        
    session.add(prefs)
    session.commit()
    session.refresh(prefs)
    
    return {k: v for k, v in prefs.model_dump().items() if v is not None}
