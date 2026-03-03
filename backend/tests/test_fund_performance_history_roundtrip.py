import json
import pathlib
import sys
from typing import Generator

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.scheme import get_session
from app.models.models import Scheme
from app.services.fund_intelligence import parse_enrichment_response
from main import app


def _sample_payload() -> dict:
    return {
        "fund_name": "Sample Fund",
        "fund_performance_history": [
            {
                "recorded_at": "2024-12-31",
                "quarterly_performance": [
                    {"period": "Q1", "return": 4.2},
                    {"period": "Q2", "return": -1.3},
                ],
                "best_periods": {"1Y": {"date": "2024-12-31", "return": 18.4}},
                "worst_periods": {"1Y": {"date": "2024-03-31", "return": -12.1}},
                "sip_returns": {"1Y": 14.2, "3Y": 15.1},
                "cagr_metrics": {
                    "cagr": {"1 Year": 12.4, "3 Years": 11.2, "5 Years": 10.3},
                    "cagr_rank_in_cat": {"1 Year": 3, "3 Years": 5, "5 Years": 4},
                    "cagr_cat_avg": {"1 Year": 9.2, "3 Years": 8.1, "5 Years": 7.6},
                },
                "risk_metrics": {
                    "returns": {"1y": 12.4, "3y": 11.2, "5y": 10.3},
                },
            }
        ],
        "fund_holdings": [],
        "fund_peers": [],
        "fund_managers": [],
        "fund_sectors": [],
    }


def test_parser_serializes_latest_performance_history_fields() -> None:
    payload = _sample_payload()
    enrichment = parse_enrichment_response(scheme_id=1, data=payload)

    assert enrichment.performance is not None
    assert json.loads(enrichment.performance.quarterly_performance) == payload[
        "fund_performance_history"
    ][-1]["quarterly_performance"]
    assert json.loads(enrichment.performance.best_periods) == payload[
        "fund_performance_history"
    ][-1]["best_periods"]
    assert json.loads(enrichment.performance.worst_periods) == payload[
        "fund_performance_history"
    ][-1]["worst_periods"]
    assert json.loads(enrichment.performance.sip_returns) == payload[
        "fund_performance_history"
    ][-1]["sip_returns"]
    assert json.loads(enrichment.performance.cagr_cat_avg) == payload[
        "fund_performance_history"
    ][-1]["cagr_metrics"]["cagr_cat_avg"]


def test_enrichment_endpoint_round_trip_performance_history(monkeypatch) -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        scheme = Scheme(
            isin="INF000000001",
            amfi_code="123456",
            name="Sample Fund",
            type="EQUITY",
            latest_nav=100.0,
        )
        session.add(scheme)
        session.commit()

    def override_get_session() -> Generator[Session, None, None]:
        with Session(engine) as session:
            yield session

    monkeypatch.setattr("app.api.scheme.fetch_fund_intelligence", lambda _isin: _sample_payload())

    app.dependency_overrides[get_session] = override_get_session

    try:
        client = TestClient(app)
        response = client.get("/api/scheme/123456/enrichment")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    perf = data["performance"]
    latest_hist = _sample_payload()["fund_performance_history"][-1]

    assert json.loads(perf["quarterly_performance"]) == latest_hist["quarterly_performance"]
    assert json.loads(perf["best_periods"]) == latest_hist["best_periods"]
    assert json.loads(perf["worst_periods"]) == latest_hist["worst_periods"]
    assert json.loads(perf["sip_returns"]) == latest_hist["sip_returns"]
    assert json.loads(perf["cagr_cat_avg"]) == latest_hist["cagr_metrics"]["cagr_cat_avg"]
