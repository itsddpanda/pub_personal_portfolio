from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.cas import router as cas_router
from app.api.nav import router as nav_router
from app.api.analytics import router as analytics_router
from app.api.users import router as users_router
from app.api.status import router as status_router
from app.db.engine import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="Mutual Fund Analyzer API", lifespan=lifespan)

import os

origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = [origin.strip() for origin in origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cas_router, prefix="/api", tags=["CAS"])
app.include_router(nav_router, prefix="/api", tags=["NAV"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(status_router, prefix="/api/status", tags=["Status"])

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "mfa-backend"}
