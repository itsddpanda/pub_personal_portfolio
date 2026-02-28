from rapidfuzz import fuzz
from datetime import datetime, timedelta
import logging

from app.models.models import FundEnrichment, Scheme

logger = logging.getLogger(__name__)


def validate_nav(enrichment_nav: float, mfa_nav: float) -> int:
    """
    V1: NAV Accuracy check
    Returns 1 (Match), 2 (Minor discrepancy <= 5%), 3 (Significant > 5%), or 0 (Unvalidated)
    """
    if not mfa_nav or not enrichment_nav:
        return 0
    delta_pct = abs(enrichment_nav - mfa_nav) / mfa_nav * 100
    if delta_pct <= 1.0:
        return 1
    if delta_pct <= 5.0:
        return 2
    return 3


def validate_name(enrichment_name: str, mfa_name: str) -> int:
    """
    V2: Name Match check using RapidFuzz
    Returns 1 (Match > 80%), 2 (Partial 60-80%), 3 (Failed < 60%), or 0 (Unvalidated)
    """
    if not mfa_name or not enrichment_name:
        return 0

    score = fuzz.token_sort_ratio(enrichment_name.lower(), mfa_name.lower())
    if score >= 80:
        return 1
    elif score >= 60:
        return 2
    else:
        return 3


def validate_freshness(fetched_at: datetime) -> int:
    """
    V3: Freshness check based on the age of the payload.
    Returns 1 (<30 days), 2 (30-45 days), 3 (>45 days).
    """
    if not fetched_at:
        return 0

    age = (datetime.utcnow() - fetched_at).days
    if age <= 30:
        return 1
    if age <= 45:
        return 2
    return 3


def compute_overall_validation_status(
    nav_status: int, name_status: int, freshness_status: int
) -> int:
    """
    Evaluates the lowest (worst) score across V1, V2, V3.
    3 is worst (Failed), 2 is degraded, 1 is Passed.
    If any check is unvalidated (0), the overall status cannot be purely 1 if others are worse,
    but we generally default to the worst status present.
    """
    statuses = [s for s in (nav_status, name_status, freshness_status) if s > 0]
    if not statuses:
        return 0
    return max(
        statuses
    )  # max integer value happens to correspond to the worst semantic status (3)


def run_validations(
    enrichment: FundEnrichment,
    enrichment_nav: float = None,
    mfa_nav: float = None,
    mfa_name: str = None,
):
    """
    Runs V1, V2, V3 engines against the enrichment payload and mutates the status metrics in-place.
    """
    logger.info(f"Running data validation engine for Scheme ID {enrichment.scheme_id}")

    # V1: NAV Match
    enrichment.nav_validation_status = validate_nav(enrichment_nav, mfa_nav)

    # V2: Name Match (Relies on Scheme linkage downstream, we'll assume mfa_name is available or loaded by caller)
    enrichment.name_validation_status = validate_name(enrichment.fund_name, mfa_name)

    # V3: Freshness
    enrichment.freshness_status = validate_freshness(enrichment.fetched_at)

    # Calculate overall
    enrichment.validation_status = compute_overall_validation_status(
        enrichment.nav_validation_status,
        enrichment.name_validation_status,
        enrichment.freshness_status,
    )
