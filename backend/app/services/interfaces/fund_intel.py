from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlmodel import Session, select
from app.models.models import (
    FundEnrichment,
    FundPerformance,
    FundRiskMetrics,
    FundHolding,
    FundPeer,
)


class PerformanceDTO(BaseModel):
    returns_1y: Optional[float]
    returns_3y: Optional[float]
    returns_5y: Optional[float]
    returns_tooltip: Optional[str]
    cagr_1y: Optional[float]
    cagr_3y: Optional[float]
    cagr_5y: Optional[float]
    cagr_tooltip: Optional[str]


class RiskMetricsDTO(BaseModel):
    cat_avg_1y: Optional[float]
    cat_avg_3y: Optional[float]
    cat_avg_5y: Optional[float]
    cat_min_1y: Optional[float]
    cat_max_1y: Optional[float]
    cat_max_3y: Optional[float]
    sharpe_ratio_1y: Optional[float]
    sharpe_ratio_3y: Optional[float]
    sharpe_ratio_5y: Optional[float]
    sharpe_ratio_tooltip: Optional[str]
    sortino_ratio_1y: Optional[float]
    sortino_ratio_3y: Optional[float]
    sortino_ratio_5y: Optional[float]
    sortino_ratio_tooltip: Optional[str]
    risk_std_dev_1y: Optional[float]
    risk_std_dev_3y: Optional[float]
    risk_std_dev_5y: Optional[float]
    risk_std_dev_tooltip: Optional[str]
    beta_1y: Optional[float]
    beta_3y: Optional[float]
    beta_5y: Optional[float]
    beta_tooltip: Optional[str]


class HoldingDTO(BaseModel):
    stock_name: Optional[str]
    sector: Optional[str]
    weighting: Optional[float]
    market_value: Optional[float]


class PeerDTO(BaseModel):
    fund_name: Optional[str]
    peer_isin: Optional[str]
    expense_ratio: Optional[float]
    std_deviation: Optional[float]
    return_3y: Optional[float]


class EnrichmentDTO(BaseModel):
    id: int
    scheme_id: int
    fund_name: Optional[str]
    fetched_at: datetime
    validation_status: int
    nav_validation_status: int
    name_validation_status: int
    freshness_status: int

    expense_ratio: Optional[float]
    equity_alloc: Optional[float]
    debt_alloc: Optional[float]
    cash_alloc: Optional[float]
    other_alloc: Optional[float]

    performance: Optional[PerformanceDTO] = None
    risk_metrics: Optional[RiskMetricsDTO] = None
    holdings: List[HoldingDTO] = []
    peers: List[PeerDTO] = []


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
    # We could also use joinedload in the query, but let's keep it simple explicit queries for safety
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
    dto.peers = [
        PeerDTO.model_validate(p, from_attributes=True) for p in enrichment.peers
    ]

    return dto
