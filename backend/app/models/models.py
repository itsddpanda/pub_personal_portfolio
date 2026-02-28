from typing import Optional, List
from datetime import date as dt_date, datetime
from sqlmodel import Field, SQLModel, Relationship, UniqueConstraint
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
    type: str  # EQUITY, DEBT, etc.
    advisor: Optional[str] = None  # DIRECT, REGULAR
    amc_id: Optional[int] = Field(default=None, foreign_key="amc.id")

    # Extended Metadata (From MFAPI)
    fund_house: Optional[str] = None
    scheme_category: Optional[str] = None
    scheme_type: Optional[str] = None

    # Caching latest NAV & Valuation
    latest_nav: Optional[float] = None
    latest_nav_date: Optional[dt_date] = None

    # Snapshot from CAS
    valuation_date: Optional[dt_date] = None
    valuation_value: Optional[float] = None

    # Backfill tracking (V1.4.1)
    last_history_sync: Optional[dt_date] = None

    nav_history: List["NavHistory"] = Relationship(back_populates="scheme")


class NavHistory(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("scheme_id", "date", name="uix_scheme_date"),)

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

    @staticmethod
    def generate_id(
        pan: str, isin: str, date: dt_date, amount: float, type: str, units: float
    ) -> str:
        """
        Generates a deterministic hash for deduplication.
        """
        raw = f"{pan}|{isin}|{date.isoformat()}|{amount}|{type}|{units}"
        return hashlib.sha256(raw.encode()).hexdigest()


class SystemState(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Fund Intelligence Extended Data


class FundEnrichment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scheme_id: int = Field(foreign_key="scheme.id", unique=True)
    fund_name: Optional[str] = Field(default="Unknown Fund")
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    validation_status: int = Field(
        default=0
    )  # 0: Unvalidated, 1: Passed, 2: Partial, 3: Failed
    nav_validation_status: int = Field(default=0)
    name_validation_status: int = Field(default=0)
    freshness_status: int = Field(default=0)

    # Added for Phase 2: Portfolio Composition & Cost
    expense_ratio: Optional[float] = None
    equity_alloc: Optional[float] = None
    debt_alloc: Optional[float] = None
    cash_alloc: Optional[float] = None
    other_alloc: Optional[float] = None

    performance: Optional["FundPerformance"] = Relationship(
        back_populates="enrichment",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    risk_metrics: Optional["FundRiskMetrics"] = Relationship(
        back_populates="enrichment",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
    holdings: List["FundHolding"] = Relationship(
        back_populates="enrichment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    peers: List["FundPeer"] = Relationship(
        back_populates="enrichment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class FundPerformance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", unique=True)
    returns_1y: Optional[float] = None
    returns_3y: Optional[float] = None
    returns_5y: Optional[float] = None
    returns_tooltip: Optional[str] = None
    cagr_1y: Optional[float] = None
    cagr_3y: Optional[float] = None
    cagr_5y: Optional[float] = None
    cagr_tooltip: Optional[str] = None

    enrichment: FundEnrichment = Relationship(back_populates="performance")


class FundRiskMetrics(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", unique=True)

    cat_avg_1y: Optional[float] = None
    cat_avg_3y: Optional[float] = None
    cat_avg_5y: Optional[float] = None

    cat_min_1y: Optional[float] = None
    cat_min_3y: Optional[float] = None
    cat_min_5y: Optional[float] = None

    cat_max_1y: Optional[float] = None
    cat_max_3y: Optional[float] = None
    cat_max_5y: Optional[float] = None

    sharpe_ratio_1y: Optional[float] = None
    sharpe_ratio_3y: Optional[float] = None
    sharpe_ratio_5y: Optional[float] = None
    sharpe_ratio_tooltip: Optional[str] = None

    sortino_ratio_1y: Optional[float] = None
    sortino_ratio_3y: Optional[float] = None
    sortino_ratio_5y: Optional[float] = None
    sortino_ratio_tooltip: Optional[str] = None

    risk_std_dev_1y: Optional[float] = None
    risk_std_dev_3y: Optional[float] = None
    risk_std_dev_5y: Optional[float] = None
    risk_std_dev_tooltip: Optional[str] = None

    beta_1y: Optional[float] = None
    beta_3y: Optional[float] = None
    beta_5y: Optional[float] = None
    beta_tooltip: Optional[str] = None

    enrichment: FundEnrichment = Relationship(back_populates="risk_metrics")


class FundHolding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", index=True)
    stock_name: Optional[str] = Field(default="Unknown Stock")
    sector: Optional[str] = None
    weighting: Optional[float] = None
    market_value: Optional[float] = None

    enrichment: FundEnrichment = Relationship(back_populates="holdings")


class FundPeer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", index=True)
    fund_name: Optional[str] = Field(default="Unknown Peer")
    peer_isin: Optional[str] = None
    expense_ratio: Optional[float] = None
    std_deviation: Optional[float] = None
    return_3y: Optional[float] = None

    enrichment: FundEnrichment = Relationship(back_populates="peers")
