import os
import requests
import json

api_key = os.getenv("FUND_DAAS_API_KEY", "sk_test_123")
url = "https://money-calc-gateway.ddpanda.workers.dev/api/v1/fund/pro/INF109K012R6"
headers = {"Authorization": f"Bearer {api_key}"}
response = requests.get(url, headers=headers)
print(response.status_code)
print(json.dumps(response.json(), indent=2))
