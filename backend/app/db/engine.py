import os
from typing import Generator
from dotenv import load_dotenv
from sqlmodel import create_engine, SQLModel, Session

load_dotenv()

sqlite_url = os.environ.get("DATABASE_URL", "sqlite:///mfa.db")

# WAL mode is good for concurrency
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


def create_db_and_tables():
    from app.models import models
    from app.models.models import AMC
    import json

    SQLModel.metadata.create_all(engine)
    
    # Pre-populate AMC mapping
    try:
        amc_map_path = os.path.join(os.path.dirname(__file__), "..", "..", "config", "amc_map.json")
        if not os.path.exists(amc_map_path):
            amc_map_path = "/app/config/amc_map.json"
        
        if os.path.exists(amc_map_path):
            with open(amc_map_path, "r") as f:
                amc_data = json.load(f)
                
            with Session(engine) as session:
                for name, amc_code in amc_data.items():
                    existing = session.query(AMC).filter(AMC.code == str(amc_code)).first()
                    if not existing:
                        session.add(AMC(name=name, code=str(amc_code)))
                    elif existing.name != name:
                        existing.name = name
                session.commit()
    except Exception as e:
        print(f"Warning: Failed to auto-populate AMCs from map: {e}")


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
