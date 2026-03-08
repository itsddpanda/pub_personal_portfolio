import os
import json
import logging
import requests
from datetime import datetime, date as dt_date
from typing import Dict, Any, Optional, List

from app.models.models import (
    FundEnrichment,
    FundPerformance,
    FundRiskMetrics,
    FundHolding,
    FundPeer,
    FundManager,
    FundSector,
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


def _safe_float(val) -> Optional[float]:
    """Safely convert a value to float, returning None on failure."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> Optional[int]:
    """Safely convert a value to int, returning None on failure."""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _safe_date(val) -> Optional[dt_date]:
    """Safely parse a YYYY-MM-DD string to date, returning None on failure."""
    if val is None:
        return None
    try:
        return dt_date.fromisoformat(str(val)[:10])
    except (ValueError, TypeError):
        return None


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
    api_key = os.getenv("FUND_DAAS_API_KEY", "sk_test_123")
    if not api_key:
        logger.error("FUND_DAAS_API_KEY environment variable is not set and no fallback available.")
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

def trigger_bulk_daas_prefetch(isins: list[str]) -> None:
    """
    Fire-and-forget background task to queue ISINs for bulk pre-fetching.
    Requires ISINs to be exactly 12 characters. Matches the 202 Accepted flow.
    """
    if not isins:
        return

    # 1. Filter and clean the ISINs
    valid_isins = [isin.strip() for isin in isins if isin and len(isin.strip()) == 12]
    unique_isins = list(set(valid_isins))

    if not unique_isins:
        logger.info("No valid 12-character ISINs found for bulk prefetch.")
        return

    api_key = os.getenv("FUND_DAAS_API_KEY", "sk_test_123")
    headers = {"Authorization": f"Bearer {api_key}"}

    # 2. Chunk into batches of 50 (API Limit)
    chunk_size = 50
    chunks = [unique_isins[i:i + chunk_size] for i in range(0, len(unique_isins), chunk_size)]

    logger.info(f"Triggering DaaS bulk pre-fetch for {len(unique_isins)} ISINs in {len(chunks)} chunks.")

    for i, chunk in enumerate(chunks):
        chunk_str = ",".join(chunk)
        url = f"{DAAS_BASE_URL}/api/v1/fund/pro/{chunk_str}"
        
        try:
            # We don't care about the response body, just firing the request.
            # Timeout is somewhat relaxed since it's a background task, but we don't want to hang forever
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 202:
                logger.info(f"Successfully queued bulk chunk {i+1}/{len(chunks)} (202 Accepted).")
            else:
                 logger.warning(f"Bulk chunk {i+1} returned unexpected status {res.status_code}: {res.text}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error queuing bulk DaaS chunk {i+1}: {e}")
            # Continue to next chunk instead of failing entirely
            continue


def generate_custom_highlights(enrichment: FundEnrichment, thresholds: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Generates semantic 'Key Highlights' based on the fund's actual metrics.
    Replaces static/poor-quality DaaS kbyi intelligence.
    """
    if thresholds is None:
        # Hardcoded default thresholds as fallback for deleted threshold_resolver
        thresholds = {
            "cagr_rank_top": 5,
            "cagr_outperform_min": 2.0,
            "cagr_underperform_min": -2.0,
            "expense_ratio_low": 0.5,
            "expense_ratio_high": 2.0,
            "concentration_top5_high": 35.0,
            "beta_high": 1.2,
            "beta_low": 0.8,
            "ytm_attractive": 7.5,
            "pe_discount_pct": 0.8,
        }

    highlights = []

    # Safe gets with fallbacks from thresholds dictionary
    t_rank_top = thresholds.get("cagr_rank_top", 5)
    t_outperform_min = thresholds.get("cagr_outperform_min", 2.0)
    t_underperform_min = thresholds.get("cagr_underperform_min", -2.0)
    t_expense_low = thresholds.get("expense_ratio_low", 0.5)
    t_expense_high = thresholds.get("expense_ratio_high", 2.0)
    t_conc_high = thresholds.get("concentration_top5_high", 35.0)
    t_beta_high = thresholds.get("beta_high", 1.2)
    t_beta_low = thresholds.get("beta_low", 0.8)
    t_ytm_attr = thresholds.get("ytm_attractive", 7.5)
    t_pe_disc = thresholds.get("pe_discount_pct", 0.8)

    # 1. Performance Insights
    perf = enrichment.performance
    risk = enrichment.risk_metrics
    
    is_consistent_compounder = False
    is_high_return = False
    
    if perf and risk:
        # Check Multi-period consistency 
        if (perf.cagr_1y and risk.cat_avg_1y and perf.cagr_1y > risk.cat_avg_1y) and \
           (perf.cagr_3y and risk.cat_avg_3y and perf.cagr_3y > risk.cat_avg_3y) and \
           (perf.cagr_5y and risk.cat_avg_5y and perf.cagr_5y > risk.cat_avg_5y):
           
            is_consistent_compounder = True
            highlights.append({
                "Performance": {
                    "text": "Consistent Compounder: Outperformed category average across 1-year, 3-year, and 5-year periods.",
                    "type": "positive"
                }
            })

        # Check 3Y Performance vs Rank (if not already highlighted as consistent compounder)
        if not is_consistent_compounder:
            if perf.cagr_rank_3y and perf.cagr_rank_3y <= t_rank_top:
                is_high_return = True
                highlights.append({
                    "Performance": {
                        "text": f"Top-tier performer in its category, ranking #{perf.cagr_rank_3y} over the last 3 years.",
                        "type": "positive"
                    }
                })
            elif perf.cagr_3y and risk.cat_avg_3y:
                diff = perf.cagr_3y - risk.cat_avg_3y
                if diff > t_outperform_min:
                    is_high_return = True
                    highlights.append({
                        "Return": {
                            "text": f"Consistently outperformed category average by {diff:.1f}% over 3 years.",
                            "type": "positive"
                        }
                    })
                elif diff < t_underperform_min:
                    highlights.append({
                        "Underperformance": {
                            "text": f"Underperformed category average by {abs(diff):.1f}% over 3 years.",
                            "type": "risk"
                        }
                    })

    # 2. Cost Efficiency
    if enrichment.expense_ratio is not None:
        if enrichment.expense_ratio < t_expense_low:
            highlights.append({
                "Cost": {
                    "text": f"Highly cost-effective with an expense ratio of just {enrichment.expense_ratio}%.",
                    "type": "positive"
                }
            })
        elif enrichment.expense_ratio > t_expense_high:
            highlights.append({
                "Cost": {
                    "text": f"Expensive relative to peers, with an expense ratio of {enrichment.expense_ratio}%.",
                    "type": "risk"
                }
            })

    # 3. Concentration Risk
    if enrichment.top_5_stocks_weight and enrichment.top_5_stocks_weight > t_conc_high:
        highlights.append({
            "Concentration": {
                "text": f"Concentrated portfolio with {enrichment.top_5_stocks_weight:.1f}% in the top 5 holdings. Higher impact of individual stock moves.",
                "type": "risk"
            }
        })

    # 4. Volatility / Risk & Cross-Metrics
    is_high_beta = False
    if risk and risk.beta_3y:
        if risk.beta_3y > t_beta_high:
            is_high_beta = True
            if is_high_return or is_consistent_compounder:
                highlights.append({
                    "Volatility": {
                        "text": f"Returns come with risk: High volatility (Beta: {risk.beta_3y:.2f}) relative to the benchmark. Expect sharper swings.",
                        "type": "info"
                    }
                })
            else:
                highlights.append({
                    "Volatility": {
                        "text": f"Higher volatility (Beta: {risk.beta_3y:.2f}) relative to the benchmark. Expect sharper swings.",
                        "type": "risk"
                    }
                })
        elif risk.beta_3y < t_beta_low:
            highlights.append({
                "Stability": {
                    "text": f"Lower volatility (Beta: {risk.beta_3y:.2f}) than the broader market. Provides defensive stability.",
                    "type": "positive"
                }
            })

    # 5. Asset Type Specifics
    if enrichment.yield_to_maturity and enrichment.yield_to_maturity > t_ytm_attr:
        highlights.append({
            "Yield": {
                "text": f"Attractive gross yield of {enrichment.yield_to_maturity:.2f}% YTM for debt investors.",
                "type": "positive"
            }
        })
    
    if enrichment.pe and enrichment.cat_avg_pe:
        if enrichment.pe < enrichment.cat_avg_pe * t_pe_disc:
            highlights.append({
                "Valuation": {
                    "text": "Value-oriented positioning with P/E significantly below category average.",
                    "type": "positive"
                }
            })
        elif enrichment.pe > enrichment.cat_avg_pe * 1.2:
            highlights.append({
                "Valuation": {
                    "text": "Expensive valuation with P/E significantly above category average.",
                    "type": "risk"
                }
            })

    # 6. Data Staleness
    if enrichment.fetched_at:
        try:
            from datetime import timezone
            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            age_days = (now_utc - enrichment.fetched_at).days
            if age_days > 30:
                highlights.append({
                    "Data": {
                        "text": f"Underlying data is {age_days} days old and may not reflect current market conditions.",
                        "type": "warning"
                    }
                })
        except Exception:
            pass

    # Fallback if no highlights generated
    if not highlights:
        age_text = ""
        if enrichment.inception_date:
            try:
                from datetime import timezone
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                years = (now_utc.date() - enrichment.inception_date).days / 365.25
                age_text = f" {years:.1f}-year old"
            except Exception:
                pass
            
        highlights.append({
            "Insight": {
                "text": f"Analyzing this{age_text} {enrichment.category or 'fund'} across its {enrichment.number_of_holdings or 'multiple'} holdings.",
                "type": "info"
            }
        })

    return highlights


def parse_enrichment_response(
    scheme_id: int,
    data: Dict[str, Any],
    mfa_nav: Optional[float] = None,
    mfa_name: Optional[str] = None,
    session: Optional[Session] = None,
) -> FundEnrichment:
    """
    Parses the DaaS JSON dictionary into the local SQLAlchemy models.
    Generates local intelligence highlights to replace DaaS kbyi.
    """

    # Parse calculated_at timestamp
    calc_at = data.get("calculated_at")
    calculated_at_dt = None
    if calc_at:
        try:
            calculated_at_dt = datetime.fromisoformat(str(calc_at))
        except (ValueError, TypeError):
            calculated_at_dt = None

    # Normalization calculations for Asset and Cap
    raw_equity_alloc = _safe_float(data.get("equity_alloc"))
    raw_debt_alloc = _safe_float(data.get("debt_alloc"))
    raw_cash_alloc = _safe_float(data.get("cash_alloc"))
    raw_other_alloc = _safe_float(data.get("other_alloc"))

    total_asset_alloc = (raw_equity_alloc or 0.0) + (raw_debt_alloc or 0.0) + (raw_cash_alloc or 0.0) + (raw_other_alloc or 0.0)

    equity_alloc_final = raw_equity_alloc
    debt_alloc_final = raw_debt_alloc
    cash_alloc_final = raw_cash_alloc
    other_alloc_final = raw_other_alloc

    if total_asset_alloc > 100.0:
        if raw_equity_alloc is not None: equity_alloc_final = round((raw_equity_alloc / total_asset_alloc) * 100.0, 2)
        if raw_debt_alloc is not None: debt_alloc_final = round((raw_debt_alloc / total_asset_alloc) * 100.0, 2)
        if raw_cash_alloc is not None: cash_alloc_final = round((raw_cash_alloc / total_asset_alloc) * 100.0, 2)
        if raw_other_alloc is not None: other_alloc_final = round((raw_other_alloc / total_asset_alloc) * 100.0, 2)

    raw_large_cap_wt = _safe_float(data.get("large_cap_wt"))
    raw_mid_cap_wt = _safe_float(data.get("mid_cap_wt"))
    raw_small_cap_wt = _safe_float(data.get("small_cap_wt"))
    raw_others_cap_wt = _safe_float(data.get("others_cap_wt"))

    total_cap_weight = (raw_large_cap_wt or 0.0) + (raw_mid_cap_wt or 0.0) + (raw_small_cap_wt or 0.0) + (raw_others_cap_wt or 0.0)

    large_cap_wt_final = raw_large_cap_wt
    mid_cap_wt_final = raw_mid_cap_wt
    small_cap_wt_final = raw_small_cap_wt
    others_cap_wt_final = raw_others_cap_wt

    if total_cap_weight > 100.0:
        if raw_large_cap_wt is not None: large_cap_wt_final = round((raw_large_cap_wt / total_cap_weight) * 100.0, 2)
        if raw_mid_cap_wt is not None: mid_cap_wt_final = round((raw_mid_cap_wt / total_cap_weight) * 100.0, 2)
        if raw_small_cap_wt is not None: small_cap_wt_final = round((raw_small_cap_wt / total_cap_weight) * 100.0, 2)
        if raw_others_cap_wt is not None: others_cap_wt_final = round((raw_others_cap_wt / total_cap_weight) * 100.0, 2)

    # 1. Base Enrichment Record — all flat fields from API
    enrichment = FundEnrichment(
        scheme_id=scheme_id,
        fund_name=data.get("fund_name", "Unknown Fund"),
        fetched_at=datetime.utcnow(),

        # Identifiers
        code=None,  # Disabled per requirement
        morningstar_id=data.get("morningstar_id"),

        # Fund metadata
        scheme_short_name=data.get("scheme_short_name"),
        category=data.get("category"),
        sub_category=data.get("sub_category"),
        fund_type=data.get("fund_type"),
        plan_name=data.get("plan_name"),
        option_name=data.get("option_name"),
        payout_freq=data.get("payout_freq"),
        inception_date=_safe_date(data.get("inception_date")),
        benchmark=data.get("benchmark"),
        riskometer=data.get("riskometer"),
        investment_style=data.get("investment_style"),
        rating=data.get("rating"),
        objective=data.get("objective"),
        is_active=data.get("is_active"),

        # NAV snapshot
        latest_nav_api=_safe_float(data.get("latest_nav")),
        nav_change=_safe_float(data.get("nav_change")),
        nav_change_percent=_safe_float(data.get("nav_change_percent")),
        nav_date=_safe_date(data.get("nav_date")),

        # AUM & Cost
        aum_cr=_safe_float(data.get("aum_cr")),
        expense_ratio=_safe_float(data.get("expense_ratio")),
        turnover_ratio=_safe_float(data.get("turnover_ratio")),
        turnover_ratio_cat_avg=_safe_float(data.get("turnover_ratio_cat_avg")),
        exit_load=data.get("exit_load"),
        lockin_period=data.get("lockin_period"),

        # Valuation Ratios
        pe=_safe_float(data.get("pe")),
        cat_avg_pe=_safe_float(data.get("cat_avg_pe")),
        pb=_safe_float(data.get("pb")),
        cat_avg_pb=_safe_float(data.get("cat_avg_pb")),
        price_sale=_safe_float(data.get("price_sale")),
        cat_avg_price_sale=_safe_float(data.get("cat_avg_price_sale")),
        price_cash_flow=_safe_float(data.get("price_cash_flow")),
        cat_avg_price_cash_flow=_safe_float(data.get("cat_avg_price_cash_flow")),
        dividend_yield=_safe_float(data.get("dividend_yield")),
        cat_avg_dividend_yield=_safe_float(data.get("cat_avg_dividend_yield")),
        roe=_safe_float(data.get("roe")),
        cat_avg_roe=_safe_float(data.get("cat_avg_roe")),

        # Debt fund metrics
        yield_to_maturity=_safe_float(data.get("yield_to_maturity")),
        modified_duration=_safe_float(data.get("modified_duration")),
        avg_eff_maturity=_safe_float(data.get("avg_eff_maturity")),
        avg_credit_quality_name=data.get("avg_credit_quality_name"),

        # Asset Allocation
        equity_alloc=equity_alloc_final,
        debt_alloc=debt_alloc_final,
        cash_alloc=cash_alloc_final,
        other_alloc=other_alloc_final,
        
        # Cap-weight breakdown (Normalized)
        large_cap_wt=large_cap_wt_final,
        mid_cap_wt=mid_cap_wt_final,
        small_cap_wt=small_cap_wt_final,
        others_cap_wt=others_cap_wt_final,

        # Concentration metrics
        number_of_holdings=_safe_int(data.get("number_of_holdings")),
        avg_market_cap_cr=_safe_float(data.get("avg_market_cap_cr")),
        top_3_sectors_weight=_safe_float(data.get("top_3_sectors_weight")),
        top_5_stocks_weight=_safe_float(data.get("top_5_stocks_weight")),
        top_10_stocks_weight=_safe_float(data.get("top_10_stocks_weight")),

        # API calculation timestamp
        calculated_at=calculated_at_dt,
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

        # Parse CAGR metrics from cagr_metrics object
        cagr_metrics = latest_hist.get("cagr_metrics") or {}
        cagr_vals = cagr_metrics.get("cagr", {})
        cagr_ranks = cagr_metrics.get("cagr_rank_in_cat", {})

        enrichment.performance.cagr_1y = _safe_float(cagr_vals.get("1 Year"))
        enrichment.performance.cagr_3y = _safe_float(cagr_vals.get("3 Years"))
        enrichment.performance.cagr_5y = _safe_float(cagr_vals.get("5 Years"))
        enrichment.performance.cagr_10y = _safe_float(cagr_vals.get("10 Years"))

        enrichment.performance.cagr_rank_1y = _safe_int(cagr_ranks.get("1 Year"))
        enrichment.performance.cagr_rank_3y = _safe_int(cagr_ranks.get("3 Years"))
        enrichment.performance.cagr_rank_5y = _safe_int(cagr_ranks.get("5 Years"))
        enrichment.performance.cagr_rank_10y = _safe_int(cagr_ranks.get("10 Years"))

        # ... (rest of the code continues as is)
        enrichment.performance.recorded_at = _safe_date(latest_hist.get("recorded_at"))
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
    
    # Calculate sum of holding weights for normalization
    total_holding_weight = sum(_safe_float(h.get("weighting")) or 0.0 for h in holdings_data if isinstance(h, dict))
    
    for h in holdings_data:
        if not h or not isinstance(h, dict):
            continue
        # Serialize holdings_history array to JSON text if present
        hh = h.get("holdings_history")
        hh_json = json.dumps(hh) if hh else None
        
        raw_weight = _safe_float(h.get("weighting"))
        
        # Normalize if total exceeds 100%
        final_weight = raw_weight
        if raw_weight is not None and total_holding_weight > 100.0:
            final_weight = round((raw_weight / total_holding_weight) * 100.0, 2)

        holdings_list.append(
            FundHolding(
                stock_name=h.get("stock_name") or "Unknown Stock",
                sector=h.get("sector"),
                weighting=final_weight,
                market_value=_safe_float(h.get("market_value")),
                change_1m=_safe_float(h.get("change_1m")),
                holdings_history=hh_json,
            )
        )
    enrichment.holdings = holdings_list

    # 4.5. Sectors
    sectors_data = data.get("fund_sectors", [])
    if not isinstance(sectors_data, list):
        sectors_data = []

    sectors_list = []
    
    # Calculate sum of sector weights for normalization
    total_sector_weight = sum(_safe_float(s.get("weighting")) or 0.0 for s in sectors_data if isinstance(s, dict))
    
    for s in sectors_data:
        if not s or not isinstance(s, dict):
            continue
            
        raw_weight = _safe_float(s.get("weighting"))
        
        # Normalize if total exceeds 100%
        final_weight = raw_weight
        if raw_weight is not None and total_sector_weight > 100.0:
            final_weight = round((raw_weight / total_sector_weight) * 100.0, 2)

        sectors_list.append(
            FundSector(
                sector_name=s.get("sector_name") or "Unknown Sector",
                weighting=final_weight,
                market_value=_safe_float(s.get("market_value")),
                change_1m=_safe_float(s.get("change_1m")),
            )
        )
    enrichment.sectors = sectors_list

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
                cagr_1y=_safe_float(p.get("cagr_1y")),
                cagr_3y=_safe_float(p.get("cagr_3y")),
                cagr_5y=_safe_float(p.get("cagr_5y")),
                cagr_10y=_safe_float(p.get("cagr_10y")),
                yield_to_maturity=_safe_float(p.get("yield_to_maturity")),
                modified_duration=_safe_float(p.get("modified_duration")),
                avg_eff_maturity=_safe_float(p.get("avg_eff_maturity")),
                expense_ratio=_safe_float(p.get("expense_ratio")),
                portfolio_turnover=_safe_float(p.get("portfolio_turnover")),
                std_deviation=_safe_float(p.get("std_deviation")),
            )
        )
    enrichment.peers = peers_list

    # 6. Fund Managers (NEW)
    managers_data = data.get("fund_managers", [])
    if not isinstance(managers_data, list):
        managers_data = []

    managers_list = []
    for m in managers_data:
        if not m or not isinstance(m, dict):
            continue
        managers_list.append(
            FundManager(
                manager_name=m.get("manager_name") or "Unknown Manager",
                role=m.get("role"),
                start_date=_safe_date(m.get("start_date")),
                end_date=_safe_date(m.get("end_date")),
            )
        )
    enrichment.managers = managers_list
    
    # 7. Normalization Meta Tracking
    enrichment.is_sectors_normalized = total_sector_weight > 100.0
    enrichment.is_holdings_normalized = total_holding_weight > 100.0
    enrichment.is_asset_normalized = total_asset_alloc > 100.0
    enrichment.is_cap_normalized = total_cap_weight > 100.0

    # 8. Local Intelligence Generation (REPLACES kbyi)
    highlights = generate_custom_highlights(enrichment)
    enrichment.kbyi = json.dumps(highlights)

    # Run Data Validation Engine (in-memory update)
    enrichment_nav = data.get("latest_nav")
    run_validations(
        enrichment, enrichment_nav=enrichment_nav, mfa_nav=mfa_nav, mfa_name=mfa_name
    )

    return enrichment

