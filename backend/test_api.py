import os
import requests
api_key = os.getenv("FUND_DAAS_API_KEY")
resp = requests.get("https://money-calc-gateway.ddpanda.workers.dev/api/v1/fund/pro/INF209KB1E84", headers={"Authorization": f"Bearer {api_key}"})
import json
print(json.dumps(resp.json(), indent=2))
