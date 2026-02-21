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
        UserRead(
            id=str(user.id),
            name=user.name,
            is_pin_set=bool(user.pin_hash)
        )
        for user in users
    ]

@router.post("/{user_id}/verify-pin")
async def verify_pin(user_id: str, request: PinRequest, session: Session = Depends(get_session)):
    """
    Verify if the provided PIN matches the user's stored PIN hash.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.pin_hash:
        return {"success": True} # No PIN set, allow access
        
    hashed_input = hashlib.sha256(request.pin.encode()).hexdigest()
    if hashed_input == user.pin_hash:
        return {"success": True}
    else:
        raise HTTPException(status_code=401, detail="Invalid PIN")

@router.post("/{user_id}/set-pin")
async def set_pin(user_id: str, request: PinRequest, session: Session = Depends(get_session)):
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
async def remove_pin(user_id: str, request: PinRequest, session: Session = Depends(get_session)):
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
