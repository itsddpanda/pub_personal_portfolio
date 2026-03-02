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

    # --- New API fields (v2 Integration Guide) ---
    # Identifiers
    code: Optional[str] = None  # Moneycontrol code e.g. "MCC519"
    morningstar_id: Optional[str] = None

    # Fund metadata
    scheme_short_name: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    fund_type: Optional[str] = None
    plan_name: Optional[str] = None
    option_name: Optional[str] = None
    payout_freq: Optional[str] = None
    inception_date: Optional[dt_date] = None
    benchmark: Optional[str] = None
    riskometer: Optional[str] = None
    investment_style: Optional[str] = None
    rating: Optional[str] = None
    objective: Optional[str] = None
    is_active: Optional[bool] = None

    # NAV snapshot from API
    latest_nav_api: Optional[float] = None
    nav_change: Optional[float] = None
    nav_change_percent: Optional[float] = None
    nav_date: Optional[dt_date] = None

    # AUM & Cost
    aum_cr: Optional[float] = None
    expense_ratio: Optional[float] = None
    turnover_ratio: Optional[float] = None
    turnover_ratio_cat_avg: Optional[float] = None
    exit_load: Optional[str] = None
    lockin_period: Optional[str] = None

    # Valuation Ratios
    pe: Optional[float] = None
    cat_avg_pe: Optional[float] = None
    pb: Optional[float] = None
    cat_avg_pb: Optional[float] = None
    price_sale: Optional[float] = None
    cat_avg_price_sale: Optional[float] = None
    price_cash_flow: Optional[float] = None
    cat_avg_price_cash_flow: Optional[float] = None
    dividend_yield: Optional[float] = None
    cat_avg_dividend_yield: Optional[float] = None
    roe: Optional[float] = None
    cat_avg_roe: Optional[float] = None

    # Debt fund metrics
    yield_to_maturity: Optional[float] = None
    modified_duration: Optional[float] = None
    avg_eff_maturity: Optional[float] = None
    avg_credit_quality_name: Optional[str] = None

    # Asset Allocation
    equity_alloc: Optional[float] = None
    debt_alloc: Optional[float] = None
    cash_alloc: Optional[float] = None
    other_alloc: Optional[float] = None

    # Cap-weight breakdown
    large_cap_wt: Optional[float] = None
    mid_cap_wt: Optional[float] = None
    small_cap_wt: Optional[float] = None
    others_cap_wt: Optional[float] = None

    # Concentration metrics
    number_of_holdings: Optional[int] = None
    avg_market_cap_cr: Optional[float] = None
    top_3_sectors_weight: Optional[float] = None
    top_5_stocks_weight: Optional[float] = None
    top_10_stocks_weight: Optional[float] = None

    # KBYI insights (stored as JSON text)
    kbyi: Optional[str] = None

    # API calculation timestamp
    calculated_at: Optional[datetime] = None

    # --- Relationships ---
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
    sectors: List["FundSector"] = Relationship(
        back_populates="enrichment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    peers: List["FundPeer"] = Relationship(
        back_populates="enrichment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    managers: List["FundManager"] = Relationship(
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
    cagr_10y: Optional[float] = None  # NEW
    cagr_tooltip: Optional[str] = None

    # Category rank fields (NEW)
    cagr_rank_1y: Optional[int] = None
    cagr_rank_3y: Optional[int] = None
    cagr_rank_5y: Optional[int] = None
    cagr_rank_10y: Optional[int] = None

    # Snapshot date (NEW)
    recorded_at: Optional[dt_date] = None

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
    change_1m: Optional[float] = None  # NEW: 1-month weight change
    holdings_history: Optional[str] = None  # NEW: JSON array [{per, weightage}]

    enrichment: FundEnrichment = Relationship(back_populates="holdings")


class FundSector(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", index=True)
    sector_name: Optional[str] = Field(default="Unknown Sector")
    weighting: Optional[float] = None
    market_value: Optional[float] = None
    change_1m: Optional[float] = None

    enrichment: FundEnrichment = Relationship(back_populates="sectors")


class FundPeer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", index=True)
    fund_name: Optional[str] = Field(default="Unknown Peer")
    peer_isin: Optional[str] = None
    cagr_1y: Optional[float] = None  # NEW (was absent)
    cagr_3y: Optional[float] = None  # RENAMED from return_3y
    cagr_5y: Optional[float] = None  # NEW
    cagr_10y: Optional[float] = None  # NEW
    yield_to_maturity: Optional[float] = None  # NEW: debt peer
    modified_duration: Optional[float] = None  # NEW: debt peer
    avg_eff_maturity: Optional[float] = None  # NEW: debt peer
    expense_ratio: Optional[float] = None
    portfolio_turnover: Optional[float] = None  # NEW
    std_deviation: Optional[float] = None

    enrichment: FundEnrichment = Relationship(back_populates="peers")


class FundManager(SQLModel, table=True):
    """NEW: Stores fund manager data from the API."""
    id: Optional[int] = Field(default=None, primary_key=True)
    enrichment_id: int = Field(foreign_key="fundenrichment.id", index=True)
    manager_name: str = Field(default="Unknown Manager")
    role: Optional[str] = None
    start_date: Optional[dt_date] = None
    end_date: Optional[dt_date] = None

    enrichment: FundEnrichment = Relationship(back_populates="managers")
