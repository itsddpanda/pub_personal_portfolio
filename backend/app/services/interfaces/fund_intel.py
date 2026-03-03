from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date as dt_date
from sqlmodel import Session, select
from app.models.models import (
    FundEnrichment,
    FundPerformance,
    FundRiskMetrics,
    FundHolding,
    FundPeer,
    FundManager,
)


class PerformanceDTO(BaseModel):
    returns_1y: Optional[float] = None
    returns_3y: Optional[float] = None
    returns_5y: Optional[float] = None
    returns_tooltip: Optional[str] = None
    cagr_1y: Optional[float] = None
    cagr_3y: Optional[float] = None
    cagr_5y: Optional[float] = None
    cagr_10y: Optional[float] = None
    cagr_tooltip: Optional[str] = None
    cagr_rank_1y: Optional[int] = None
    cagr_rank_3y: Optional[int] = None
    cagr_rank_5y: Optional[int] = None
    cagr_rank_10y: Optional[int] = None
    recorded_at: Optional[dt_date] = None


class RiskMetricsDTO(BaseModel):
    cat_avg_1y: Optional[float] = None
    cat_avg_3y: Optional[float] = None
    cat_avg_5y: Optional[float] = None
    cat_min_1y: Optional[float] = None
    cat_max_1y: Optional[float] = None
    cat_max_3y: Optional[float] = None
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


class HoldingDTO(BaseModel):
    stock_name: Optional[str] = None
    sector: Optional[str] = None
    weighting: Optional[float] = None
    market_value: Optional[float] = None
    change_1m: Optional[float] = None
    holdings_history: Optional[str] = None  # JSON text


class PeerDTO(BaseModel):
    fund_name: Optional[str] = None
    peer_isin: Optional[str] = None
    cagr_1y: Optional[float] = None
    cagr_3y: Optional[float] = None
    cagr_5y: Optional[float] = None
    cagr_10y: Optional[float] = None
    yield_to_maturity: Optional[float] = None
    modified_duration: Optional[float] = None
    avg_eff_maturity: Optional[float] = None
    expense_ratio: Optional[float] = None
    portfolio_turnover: Optional[float] = None
    std_deviation: Optional[float] = None


class SectorDTO(BaseModel):
    sector_name: Optional[str] = None
    weighting: Optional[float] = None
    market_value: Optional[float] = None
    change_1m: Optional[float] = None


class ManagerDTO(BaseModel):
    manager_name: Optional[str] = None
    role: Optional[str] = None
    start_date: Optional[dt_date] = None
    end_date: Optional[dt_date] = None


class EnrichmentDTO(BaseModel):
    id: int
    scheme_id: int
    fund_name: Optional[str] = None
    fetched_at: datetime
    validation_status: int
    nav_validation_status: int
    name_validation_status: int
    freshness_status: int

    # Identifiers
    code: Optional[str] = None
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

    # NAV snapshot
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

    # KBYI insights (JSON text)
    kbyi: Optional[str] = None

    # API calculation timestamp
    calculated_at: Optional[datetime] = None

    # Relationships
    performance: Optional[PerformanceDTO] = None
    risk_metrics: Optional[RiskMetricsDTO] = None
    holdings: List[HoldingDTO] = []
    sectors: List[SectorDTO] = []
    peers: List[PeerDTO] = []
    managers: List[ManagerDTO] = []


def get_enrichment_for_scheme(
    session: Session, scheme_id: int
) -> Optional[EnrichmentDTO]:
    enrichment = session.exec(
        select(FundEnrichment).where(FundEnrichment.scheme_id == scheme_id)
    ).first()
    if not enrichment:
        return None

    dto = EnrichmentDTO.model_validate(enrichment, from_attributes=True)

    # Manually populate the relationships since we are avoiding SQLAlchemy lazy loading where possible
    if enrichment.performance:
        dto.performance = PerformanceDTO.model_validate(
            enrichment.performance, from_attributes=True
        )
    if enrichment.risk_metrics:
        dto.risk_metrics = RiskMetricsDTO.model_validate(
            enrichment.risk_metrics, from_attributes=True
        )

    dto.holdings = [
        HoldingDTO.model_validate(h, from_attributes=True) for h in enrichment.holdings
    ]
    dto.sectors = [
        SectorDTO.model_validate(s, from_attributes=True) for s in enrichment.sectors
    ]
    dto.peers = [
        PeerDTO.model_validate(p, from_attributes=True) for p in enrichment.peers
    ]
    dto.managers = [
        ManagerDTO.model_validate(m, from_attributes=True) for m in enrichment.managers
    ]

    return dto
