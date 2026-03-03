from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api import scheme
from app.models.models import FundEnrichment, FundSector, Scheme
from main import app


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SQLModel.metadata.create_all(engine)


def override_get_session():
    with Session(engine) as session:
        yield session


app.dependency_overrides[scheme.get_session] = override_get_session
client = TestClient(app)


def test_get_scheme_enrichment_includes_sectors():
    with Session(engine) as session:
        target_scheme = session.get(Scheme, 1)
        if not target_scheme:
            target_scheme = Scheme(
                id=1,
                isin="INF000TEST01",
                amfi_code="123456",
                name="Test Scheme",
                type="EQUITY",
            )
            session.add(target_scheme)

        enrichment = session.exec(
            scheme.select(FundEnrichment).where(FundEnrichment.scheme_id == 1)
        ).first()
        if not enrichment:
            enrichment = FundEnrichment(
                scheme_id=1,
                fund_name="Test Scheme",
                fetched_at=datetime.utcnow(),
                validation_status=1,
                nav_validation_status=1,
                name_validation_status=1,
                freshness_status=1,
            )
            session.add(enrichment)
            session.flush()

        existing_sector = session.exec(
            scheme.select(FundSector).where(FundSector.enrichment_id == enrichment.id)
        ).first()
        if not existing_sector:
            session.add(
                FundSector(
                    enrichment_id=enrichment.id,
                    sector_name="Financial Services",
                    weighting=31.2,
                    market_value=1000.0,
                    change_1m=0.6,
                )
            )

        session.commit()

    response = client.get("/api/scheme/123456/enrichment")

    assert response.status_code == 200
    payload = response.json()
    assert "sectors" in payload
    assert len(payload["sectors"]) > 0
    assert payload["sectors"][0]["sector_name"] == "Financial Services"
