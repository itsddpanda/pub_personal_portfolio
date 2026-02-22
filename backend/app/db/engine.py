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

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
