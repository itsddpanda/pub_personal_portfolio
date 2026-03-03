import json

from app.services.fund_intelligence import parse_enrichment_response


def _payload() -> dict:
    return {
        "fund_name": "Contract Fund",
        "latest_nav": "123.45",
        "equity_alloc": "70.1",
        "debt_alloc": "20.2",
        "cash_alloc": "9.7",
        "fund_performance_history": [
            {
                "recorded_at": "2025-01-31",
                "cagr_metrics": {
                    "cagr": {
                        "1 Year": "11.1",
                        "3 Years": "12.2",
                        "5 Years": "13.3",
                    },
                    "cagr_rank_in_cat": {
                        "1 Year": "4",
                        "3 Years": "7",
                        "5 Years": "9",
                    },
                    "cagr_cat_avg": {"1 Year": 8.1},
                },
                "risk_metrics": {
                    "returns": {
                        "1y": "9.1",
                        "3y": "10.2",
                        "5y": "11.3",
                    }
                },
            }
        ],
        "fund_holdings": [
            {
                "stock_name": "ABC Ltd",
                "sector": "Financial Services",
                "weighting": "4.2",
                "market_value": "200.5",
                "change_1m": "0.3",
                "holdings_history": [{"per": "Dec-24", "weightage": 4.1}],
            }
        ],
        "fund_sectors": [
            {
                "sector_name": "Financial Services",
                "weighting": "35.5",
                "market_value": "1234.5",
                "change_1m": "0.8",
            },
            {
                "sector_name": "Technology",
                "weighting": "12.3",
                "market_value": "500.0",
                "change_1m": "-0.1",
            },
        ],
        "fund_peers": [{"fund_name": "Peer A", "peer_isin": "INF0000000P1"}],
        "fund_managers": [{"manager_name": "Jane Doe", "role": "Lead Manager"}],
    }


def test_parse_enrichment_response_contract_fields_and_relationships() -> None:
    payload = _payload()
    enrichment = parse_enrichment_response(scheme_id=42, data=payload)

    assert enrichment.scheme_id == 42
    assert enrichment.fund_name == "Contract Fund"
    assert enrichment.latest_nav_api == 123.45
    assert enrichment.equity_alloc == 70.1
    assert enrichment.debt_alloc == 20.2
    assert enrichment.cash_alloc == 9.7

    assert enrichment.performance is not None
    assert enrichment.risk_metrics is not None
    assert enrichment.performance.cagr_1y == 11.1
    assert enrichment.performance.cagr_rank_1y == 4
    assert json.loads(enrichment.performance.cagr_cat_avg) == {"1 Year": 8.1}

    assert len(enrichment.holdings) == 1
    assert enrichment.holdings[0].sector == "Financial Services"
    assert json.loads(enrichment.holdings[0].holdings_history) == [
        {"per": "Dec-24", "weightage": 4.1}
    ]

    assert len(enrichment.sectors) == 2
    sector_names = {sector.sector_name for sector in enrichment.sectors}
    assert sector_names == {"Financial Services", "Technology"}
    assert enrichment.sectors[0].weighting is not None

    assert len(enrichment.peers) == 1
    assert enrichment.peers[0].fund_name == "Peer A"

    assert len(enrichment.managers) == 1
    assert enrichment.managers[0].manager_name == "Jane Doe"
