import os
import logging
import requests
from datetime import datetime
from typing import Dict, Any, Optional

from app.models.models import (
    FundEnrichment,
    FundPerformance,
    FundRiskMetrics,
    FundHolding,
    FundPeer,
    Scheme,
)
from sqlmodel import Session, select
from app.services.validation_engine import run_validations

logger = logging.getLogger(__name__)

DAAS_BASE_URL = "https://money-calc-gateway.ddpanda.workers.dev"

_isin_to_name_cache: Optional[Dict[str, str]] = None

def _get_name_from_navall(isin: str) -> Optional[str]:
    """Helper to lazy-load NAVAll.txt and extract the scheme name for an ISIN.
    Works inside docker (/data/) or running locally (backend/data/)."""
    global _isin_to_name_cache
    if _isin_to_name_cache is None:
        _isin_to_name_cache = {}
        paths = ["/data/NAVAll.txt", "data/NAVAll.txt", "backend/data/NAVAll.txt", "../data/NAVAll.txt"]
        nav_file = None
        for p in paths:
            if os.path.exists(p):
                nav_file = p
                break
        
        if nav_file:
            try:
                with open(nav_file, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        parts = line.split(';')
                        if len(parts) >= 4:
                            isin1 = parts[1].strip()
                            isin2 = parts[2].strip()
                            name = parts[3].strip()
                            if isin1 and isin1 != '-':
                                _isin_to_name_cache[isin1] = name
                            if isin2 and isin2 != '-':
                                _isin_to_name_cache[isin2] = name
            except Exception as e:
                logger.error(f"Failed to load NAVAll cache: {e}")

    return _isin_to_name_cache.get(isin)


class DaasProcessingException(Exception):
    """Raised when the DaaS API returns 503 (background calculation in progress)."""

    def __init__(self, retry_after: int = 60):
        self.retry_after = retry_after
        super().__init__(f"Fund data is processing. Retry after {retry_after}s.")


class DaasAuthException(Exception):
    """Raised when API key is missing, invalid, or quota exceeded (401/429)."""

    pass


def fetch_fund_intelligence(isin: str) -> Optional[Dict[str, Any]]:
    """
    Fetches raw fund intelligence data from the remote DaaS API.
    Raises DaasProcessingException on 503 HTTP status.
    Raises DaasAuthException on 401/429 HTTP status.
    """
    api_key = os.getenv("FUND_DAAS_API_KEY")
    if not api_key:
        logger.error("FUND_DAAS_API_KEY environment variable is not set.")
        raise DaasAuthException("API key not configured.")

    url = f"{DAAS_BASE_URL}/api/v1/fund/pro/{isin}"
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        logger.info(f"Fetching DaaS intelligence for ISIN: {isin}")
        response = requests.get(url, headers=headers, timeout=15)

        if response.status_code == 200:
            return response.json()

        elif response.status_code == 503:
            # The calculation was triggered in the background
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.info(
                f"DaaS returned 503 Processing for ISIN {isin}. Retry in {retry_after}s."
            )
            raise DaasProcessingException(retry_after=retry_after)

        elif response.status_code in (401, 429):
            logger.error(f"DaaS Auth/Quota Error for ISIN {isin}: {response.text}")
            raise DaasAuthException("Invalid API key or quota exceeded.")

        elif response.status_code == 404:
            logger.warning(f"ISIN {isin} not found in DaaS provider.")
            return None

        else:
            logger.error(
                f"DaaS API Error ({response.status_code}) for ISIN {isin}: {response.text}"
            )
            return None

    except requests.exceptions.RequestException as e:
        logger.error(f"Network error fetching DaaS intelligence for {isin}: {e}")
        return None


def parse_enrichment_response(
    scheme_id: int,
    data: Dict[str, Any],
    mfa_nav: Optional[float] = None,
    mfa_name: Optional[str] = None,
    session: Optional[Session] = None,
) -> FundEnrichment:
    """
    Parses the DaaS JSON dictionary into the local SQLAlchemy models.
    Does NOT save to DB - just builds the object graph.
    """

    # 1. Base Enrichment Record
    enrichment = FundEnrichment(
        scheme_id=scheme_id,
        fund_name=data.get("fund_name", "Unknown Fund"),
        fetched_at=datetime.utcnow(),
        expense_ratio=data.get("expense_ratio"),
        equity_alloc=data.get("equity_alloc"),
        debt_alloc=data.get("debt_alloc"),
        cash_alloc=data.get("cash_alloc"),
        other_alloc=data.get("other_alloc"),
    )

    # 2. Performance
    enrichment.performance = FundPerformance()

    # 3. Risk Metrics
    enrichment.risk_metrics = FundRiskMetrics()

    # Extract tooltips function
    def get_tooltip(risk_obj, key, default=None):
        tt = risk_obj.get(key, {}).get("toolTipText", "")
        if not tt:
            return default
        parts = tt.split("<br/>")
        text = parts[-1].strip().lstrip("?").strip()
        return text if text else default

    # Look for performance history array if provided to extract multi-period cagr/risk metrics
    history = data.get("fund_performance_history", [])
    if history and len(history) > 0:
        latest_hist = history[-1]

        # Ignore cagr_metrics array as per user feedback (incorrect source)
        # We will populate performance.returns_* from the risk_metrics["returns"] object instead
        pass

        # Parse Risk Metrics
        if latest_hist.get("risk_metrics"):
            risk = latest_hist["risk_metrics"]

            enrichment.risk_metrics.sharpe_ratio_1y = (
                float(risk.get("sharpe_ratio", {}).get("1y", 0))
                if risk.get("sharpe_ratio", {}).get("1y")
                else None
            )
            enrichment.risk_metrics.sharpe_ratio_3y = (
                float(risk.get("sharpe_ratio", {}).get("3y", 0))
                if risk.get("sharpe_ratio", {}).get("3y")
                else None
            )
            enrichment.risk_metrics.sharpe_ratio_5y = (
                float(risk.get("sharpe_ratio", {}).get("5y", 0))
                if risk.get("sharpe_ratio", {}).get("5y")
                else None
            )
            enrichment.risk_metrics.sharpe_ratio_tooltip = get_tooltip(
                risk,
                "sharpe_ratio",
                "Measures risk-adjusted performance. Higher is better.",
            )

            enrichment.risk_metrics.sortino_ratio_1y = (
                float(risk.get("sortino_ratio", {}).get("1y", 0))
                if risk.get("sortino_ratio", {}).get("1y")
                else None
            )
            enrichment.risk_metrics.sortino_ratio_3y = (
                float(risk.get("sortino_ratio", {}).get("3y", 0))
                if risk.get("sortino_ratio", {}).get("3y")
                else None
            )
            enrichment.risk_metrics.sortino_ratio_5y = (
                float(risk.get("sortino_ratio", {}).get("5y", 0))
                if risk.get("sortino_ratio", {}).get("5y")
                else None
            )
            enrichment.risk_metrics.sortino_ratio_tooltip = get_tooltip(
                risk,
                "sortino_ratio",
                "Measures downside risk-adjusted performance. Higher is better.",
            )

            enrichment.risk_metrics.risk_std_dev_1y = (
                float(risk.get("risk_std_dev", {}).get("1y", 0))
                if risk.get("risk_std_dev", {}).get("1y")
                else None
            )
            enrichment.risk_metrics.risk_std_dev_3y = (
                float(risk.get("risk_std_dev", {}).get("3y", 0))
                if risk.get("risk_std_dev", {}).get("3y")
                else None
            )
            enrichment.risk_metrics.risk_std_dev_5y = (
                float(risk.get("risk_std_dev", {}).get("5y", 0))
                if risk.get("risk_std_dev", {}).get("5y")
                else None
            )
            enrichment.risk_metrics.risk_std_dev_tooltip = get_tooltip(
                risk,
                "risk_std_dev",
                "Measures fund volatility. Lower generally indicates less risk.",
            )

            enrichment.risk_metrics.beta_1y = (
                float(risk.get("beta", {}).get("1y", 0))
                if risk.get("beta", {}).get("1y")
                else None
            )
            enrichment.risk_metrics.beta_3y = (
                float(risk.get("beta", {}).get("3y", 0))
                if risk.get("beta", {}).get("3y")
                else None
            )
            enrichment.risk_metrics.beta_5y = (
                float(risk.get("beta", {}).get("5y", 0))
                if risk.get("beta", {}).get("5y")
                else None
            )
            enrichment.risk_metrics.beta_tooltip = get_tooltip(
                risk,
                "beta",
                "Measures volatility relative to the broader market. Beta > 1 implies higher volatility.",
            )

            # Category averages (extracting from 'returns' object)
            returns_obj = risk.get("returns", {})

            # Map returns from the risk_metrics.returns object as per feedback
            enrichment.performance.returns_1y = (
                float(returns_obj.get("1y", 0)) if returns_obj.get("1y") else None
            )
            enrichment.performance.returns_3y = (
                float(returns_obj.get("3y", 0)) if returns_obj.get("3y") else None
            )
            enrichment.performance.returns_5y = (
                float(returns_obj.get("5y", 0)) if returns_obj.get("5y") else None
            )

            returns_tt = returns_obj.get("toolTipText", "")
            if returns_tt:
                parts = returns_tt.split("<br/>")
                text = parts[-1].strip().lstrip("?").strip()
                enrichment.performance.returns_tooltip = (
                    text
                    if text
                    else "Percentage growth of the fund over the selected period."
                )
            else:
                enrichment.performance.returns_tooltip = (
                    "Percentage growth of the fund over the selected period."
                )

            enrichment.risk_metrics.cat_avg_1y = (
                float(returns_obj.get("cat_avg_1y"))
                if returns_obj.get("cat_avg_1y")
                else None
            )
            enrichment.risk_metrics.cat_avg_3y = (
                float(returns_obj.get("cat_avg_3y"))
                if returns_obj.get("cat_avg_3y")
                else None
            )
            enrichment.risk_metrics.cat_avg_5y = (
                float(returns_obj.get("cat_avg_5y"))
                if returns_obj.get("cat_avg_5y")
                else None
            )

            enrichment.risk_metrics.cat_min_1y = (
                float(returns_obj.get("cat_min_1y"))
                if returns_obj.get("cat_min_1y")
                else None
            )
            enrichment.risk_metrics.cat_min_3y = (
                float(returns_obj.get("cat_min_3y"))
                if returns_obj.get("cat_min_3y")
                else None
            )
            enrichment.risk_metrics.cat_min_5y = (
                float(returns_obj.get("cat_min_5y"))
                if returns_obj.get("cat_min_5y")
                else None
            )

            enrichment.risk_metrics.cat_max_1y = (
                float(returns_obj.get("cat_max_1y"))
                if returns_obj.get("cat_max_1y")
                else None
            )
            enrichment.risk_metrics.cat_max_3y = (
                float(returns_obj.get("cat_max_3y"))
                if returns_obj.get("cat_max_3y")
                else None
            )
            enrichment.risk_metrics.cat_max_5y = (
                float(returns_obj.get("cat_max_5y"))
                if returns_obj.get("cat_max_5y")
                else None
            )

    # 4. Holdings
    holdings_data = data.get("fund_holdings", [])
    if not isinstance(holdings_data, list):
        holdings_data = []

    holdings_list = []
    for h in holdings_data:
        if not h or not isinstance(h, dict):
            continue
        holdings_list.append(
            FundHolding(
                stock_name=h.get("stock_name") or "Unknown Stock",
                sector=h.get("sector"),
                weighting=h.get("weighting"),
                market_value=h.get("market_value"),
            )
        )
    enrichment.holdings = holdings_list

    # 5. Peers
    peers_data = data.get("fund_peers", [])
    if not isinstance(peers_data, list):
        peers_data = []

    peers_list = []
    for p in peers_data:
        if not p or not isinstance(p, dict):
            continue

        peer_name = p.get("peer_name") or p.get("fund_name")
        peer_isin = p.get("peer_isin")

        if not peer_name and peer_isin:
            # 1. Try local NAVAll file first
            navall_name = _get_name_from_navall(peer_isin)
            if navall_name:
                peer_name = navall_name
            # 2. Fallback to Scheme table
            elif session:
                local_scheme = session.exec(
                    select(Scheme).where(Scheme.isin == peer_isin)
                ).first()
                if local_scheme:
                    peer_name = local_scheme.name

        if not peer_name:
            peer_name = "Unknown Peer"

        peers_list.append(
            FundPeer(
                fund_name=peer_name,
                peer_isin=peer_isin,
                return_3y=p.get("cagr_3y"),
                # Expense and Std Dev aren't explicitly in the peer array according to the doc exactly,
                # but we will extract from the flat if available per peer, otherwise None
                expense_ratio=p.get("expense_ratio"),
                std_deviation=p.get("std_deviation"),
            )
        )
    enrichment.peers = peers_list

    # Run Data Validation Engine (in-memory update)
    enrichment_nav = data.get("latest_nav")
    run_validations(
        enrichment, enrichment_nav=enrichment_nav, mfa_nav=mfa_nav, mfa_name=mfa_name
    )

    return enrichment
