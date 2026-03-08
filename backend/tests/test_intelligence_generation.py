import pytest
from app.models.models import FundEnrichment, FundPerformance, FundRiskMetrics
from app.services.fund_intelligence import generate_custom_highlights
import json

def test_generate_highlights_top_performer():
    enrichment = FundEnrichment(scheme_id=1, fund_name="Test Fund")
    perf = FundPerformance(cagr_rank_3y=3)
    enrichment.performance = perf
    
    highlights = generate_custom_highlights(enrichment)
    
    assert any("Top-tier performer" in str(h) for h in highlights)
    assert any(h.get("Performance", {}).get("type") == "positive" for h in highlights)

def test_generate_highlights_low_cost():
    enrichment = FundEnrichment(scheme_id=1, fund_name="Test Fund", expense_ratio=0.1)
    
    highlights = generate_custom_highlights(enrichment)
    
    assert any("cost-effective" in str(h) for h in highlights)
    assert any(h.get("Cost", {}).get("type") == "positive" for h in highlights)

def test_generate_highlights_high_concentration():
    enrichment = FundEnrichment(scheme_id=1, fund_name="Test Fund", top_5_stocks_weight=45.0)
    
    highlights = generate_custom_highlights(enrichment)
    
    assert any("Concentrated portfolio" in str(h) for h in highlights)
    assert any(h.get("Concentration", {}).get("type") == "risk" for h in highlights)

def test_generate_highlights_high_volatility():
    enrichment = FundEnrichment(scheme_id=1, fund_name="Test Fund")
    risk = FundRiskMetrics(beta_3y=1.5)
    enrichment.risk_metrics = risk
    
    highlights = generate_custom_highlights(enrichment)
    
    assert any("Higher volatility" in str(h) for h in highlights)
    assert any(h.get("Volatility", {}).get("type") == "risk" for h in highlights)

def test_generate_highlights_fallback():
    enrichment = FundEnrichment(scheme_id=1, fund_name="Test Fund", category="Equity")
    
    highlights = generate_custom_highlights(enrichment)
    
    assert len(highlights) == 1
    assert "Analyzing Equity metrics" in str(highlights[0])
    assert highlights[0].get("Insight", {}).get("type") == "info"
