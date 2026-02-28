import asyncio
from app.services.fund_intelligence import parse_enrichment_response

# Mock DaaS response
data = {
    "fund_name": "Test Fund",
    "fund_peers": [
        {
            "peer_isin": "INF209K01XX1",  # Known to be 'Aditya Birla Sun Life Flexi Cap Fund...'
            "peer_name": None,  # Simulate missing
            "fund_name": None,
            "cagr_3y": 15.5
        },
        {
            "peer_isin": "INF090I01FK3",  # Known 'Franklin India Flexi Cap Fund...'
            "cagr_3y": 12.0
        }
    ]
}

enrichment = parse_enrichment_response(1, data)

for peer in enrichment.peers:
    print(f"ISIN: {peer.peer_isin} -> Name: {peer.fund_name}")

