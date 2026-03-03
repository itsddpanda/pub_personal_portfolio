from datetime import datetime, timedelta
from typing import Generator

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.scheme import get_session
from app.models.models import FundEnrichment, Scheme
from main import app


def _enrichment_payload(nav: float = 101.5) -> dict:
    return {
        "fund_name": "Test Scheme",
        "latest_nav": nav,
        "fund_performance_history": [],
        "fund_holdings": [],
        "fund_sectors": [
            {
                "sector_name": "Financial Services",
                "weighting": 31.2,
                "market_value": 1000.0,
                "change_1m": 0.6,
            }
        ],
        "fund_peers": [],
        "fund_managers": [],
    }


def _new_test_client() -> tuple[TestClient, Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    session = Session(engine)

    def override_get_session() -> Generator[Session, None, None]:
        with Session(engine) as local_session:
            yield local_session

    app.dependency_overrides[get_session] = override_get_session
    client = TestClient(app)
    return client, session


def _seed_scheme(session: Session) -> Scheme:
    scheme = Scheme(
        isin="INF000000001",
        amfi_code="123456",
        name="Test Scheme",
        type="EQUITY",
        latest_nav=100.0,
    )
    session.add(scheme)
    session.commit()
    session.refresh(scheme)
    return scheme


def test_get_scheme_enrichment_cache_hit(monkeypatch) -> None:
    client, session = _new_test_client()
    try:
        scheme = _seed_scheme(session)
        session.add(
            FundEnrichment(
                scheme_id=scheme.id,
                fund_name="Cached Scheme",
                fetched_at=datetime.utcnow(),
                latest_nav_api=99.9,
            )
        )
        session.commit()

        fetch_calls = {"count": 0}

        def _fake_fetch(_isin: str):
            fetch_calls["count"] += 1
            return _enrichment_payload()

        monkeypatch.setattr("app.api.scheme.fetch_fund_intelligence", _fake_fetch)

        response = client.get("/api/scheme/123456/enrichment")

        assert response.status_code == 200
        assert response.json()["fund_name"] == "Cached Scheme"
        assert fetch_calls["count"] == 0
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_get_scheme_enrichment_cache_expired_triggers_refresh(monkeypatch) -> None:
    client, session = _new_test_client()
    try:
        scheme = _seed_scheme(session)
        session.add(
            FundEnrichment(
                scheme_id=scheme.id,
                fund_name="Stale Scheme",
                fetched_at=datetime.utcnow() - timedelta(days=8),
                latest_nav_api=80.0,
            )
        )
        session.commit()

        monkeypatch.setattr("app.api.scheme.should_purge", lambda _date: True)
        monkeypatch.setattr(
            "app.api.scheme.fetch_fund_intelligence",
            lambda _isin: _enrichment_payload(nav=201.5),
        )

        response = client.get("/api/scheme/123456/enrichment")

        assert response.status_code == 200
        payload = response.json()
        assert payload["latest_nav_api"] == 201.5
        assert payload["fund_name"] == "Test Scheme"
        assert payload["sectors"][0]["sector_name"] == "Financial Services"

        rows = session.exec(
            select(FundEnrichment).where(FundEnrichment.scheme_id == scheme.id)
        ).all()
        assert len(rows) == 1
        assert rows[0].latest_nav_api == 201.5
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_get_scheme_enrichment_force_refresh(monkeypatch) -> None:
    client, session = _new_test_client()
    try:
        scheme = _seed_scheme(session)
        session.add(
            FundEnrichment(
                scheme_id=scheme.id,
                fund_name="Old Scheme",
                fetched_at=datetime.utcnow(),
                latest_nav_api=88.0,
            )
        )
        session.commit()

        monkeypatch.setattr("app.api.scheme.should_purge", lambda _date: False)
        monkeypatch.setattr(
            "app.api.scheme.fetch_fund_intelligence",
            lambda _isin: _enrichment_payload(nav=301.5),
        )

        response = client.get("/api/scheme/123456/enrichment?force=true")

        assert response.status_code == 200
        payload = response.json()
        assert payload["latest_nav_api"] == 301.5
        assert payload["fund_name"] == "Test Scheme"
    finally:
        app.dependency_overrides.clear()
        session.close()
