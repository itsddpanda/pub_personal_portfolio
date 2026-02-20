from typing import Optional, List
from datetime import date as dt_date, datetime
from sqlmodel import Field, SQLModel, Relationship
from uuid import UUID, uuid4
import hashlib

# Shared Data
class AMC(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    code: str = Field(unique=True)

class Scheme(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    isin: str = Field(unique=True, index=True)
    amfi_code: Optional[str] = Field(default=None)
    name: str
    type: str # EQUITY, DEBT, etc.
    advisor: Optional[str] = None # DIRECT, REGULAR
    amc_id: Optional[int] = Field(default=None, foreign_key="amc.id")
    
    # Caching latest NAV & Valuation
    latest_nav: Optional[float] = None
    latest_nav_date: Optional[dt_date] = None
    
    # Snapshot from CAS
    valuation_date: Optional[dt_date] = None
    valuation_value: Optional[float] = None

    transactions: List["Transaction"] = Relationship(back_populates="scheme")
    nav_history: List["NavHistory"] = Relationship(back_populates="scheme")

class NavHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scheme_id: int = Field(foreign_key="scheme.id")
    date: dt_date
    nav: float
    
    scheme: Scheme = Relationship(back_populates="nav_history")

# Private Data
class User(SQLModel, table=True):
    id: Optional[UUID] = Field(default_factory=uuid4, primary_key=True)
    name: str
    pan: str = Field(index=True, unique=True)
    pin_hash: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    portfolios: List["Portfolio"] = Relationship(back_populates="user")

class Portfolio(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: UUID = Field(foreign_key="user.id")
    name: str
    
    user: User = Relationship(back_populates="portfolios")
    folios: List["Folio"] = Relationship(back_populates="portfolio")

class Folio(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    portfolio_id: int = Field(foreign_key="portfolio.id")
    amc_id: Optional[int] = Field(default=None, foreign_key="amc.id")
    folio_number: str
    
    portfolio: Portfolio = Relationship(back_populates="folios")
    transactions: List["Transaction"] = Relationship(back_populates="folio")

class Transaction(SQLModel, table=True):
    # Composite Hash ID: PAN + ISIN + Date + Amount + Type + Units
    id: str = Field(primary_key=True) 
    
    folio_id: int = Field(foreign_key="folio.id")
    scheme_id: int = Field(foreign_key="scheme.id")
    
    date: dt_date
    type: str
    amount: float
    units: float
    nav: float
    balance: Optional[float] = None
    
    folio: Folio = Relationship(back_populates="transactions")
    scheme: Scheme = Relationship(back_populates="transactions")

    @staticmethod
    def generate_id(pan: str, isin: str, date: dt_date, amount: float, type: str, units: float) -> str:
        """
        Generates a deterministic hash for deduplication.
        """
        raw = f"{pan}|{isin}|{date.isoformat()}|{amount}|{type}|{units}"
        return hashlib.sha256(raw.encode()).hexdigest()

class SystemState(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
