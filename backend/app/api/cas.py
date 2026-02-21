from fastapi import APIRouter, File, UploadFile, HTTPException, Body, Depends, Header, Request, BackgroundTasks
from typing import Dict, Any, Optional
from sqlmodel import Session, select
from app.db.engine import get_session
from app.models.models import User, Portfolio, Folio, Scheme, Transaction, AMC
import casparser
import io
import traceback
import tempfile
import os
from datetime import datetime
from uuid import UUID
import hashlib
import subprocess

from app.services.cas_service import process_cas_data

router = APIRouter()

def trigger_background_sync():
    """Run the AMFI sync script in a separate process to avoid blocking the API worker."""
    try:
        # Use python from the environment to run the sync script
        subprocess.Popen(["python", "/app/scripts/sync_amfi.py"])
    except Exception as e:
        import traceback
        traceback.print_exc()

@router.post("/upload")
async def upload_cas(
    request: Request,
    file: UploadFile = File(...),
    password: str = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    x_user_id: str = Header(None),
    session: Session = Depends(get_session)
):
    """
    Upload, parse, and persist CAS PDF data with deduplication.
    Optional x-user-id header to enforce PAN match against active user.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB

    try:
        # Check Content-Length header first (if available)
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > MAX_FILE_SIZE:
             raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

        # Read in chunks to enforce size limit securely
        content = bytearray()
        chunk_size = 1024 * 1024 # 1 MB chunks
        
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            content.extend(chunk)
            if len(content) > MAX_FILE_SIZE:
                 raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
        
        content = bytes(content)
        
        # Delegate to Service Layer
        result = process_cas_data(session, content, password, x_user_id)
        
        # Trigger background sync if upload was successful and new schemes/txns might exist
        if result.get("status") == "success":
            background_tasks.add_task(trigger_background_sync)
            
        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
