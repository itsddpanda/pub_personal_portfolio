# Mutual Fund Calculation DaaS - API Integration Guide

Welcome to the Mutual Fund Calculation Data-as-a-Service (DaaS) API. This guide will help you integrate our endpoints into your application, allowing you to programmatically fetch comprehensive mutual fund data using ISINs.

## Base URL

Our production Cloudflare Worker URL is:

```
https://money-calc-gateway.ddpanda.workers.dev
```

---

## Endpoint: Get Fund Data

Retrieves advanced mutual fund data for a specific ISIN or triggers background processing for multiple ISINs.

**HTTP Method:** `GET`  
**Path:** `/api/v1/fund/pro/:isin_or_isins`

### Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `isin_or_isins` | `string` | **Yes** | A single ISIN (exactly 12 alphanumeric characters, uppercase) **OR** a comma-separated list of up to 50 ISINs for bulk background pre-fetching (e.g. `ISIN1,ISIN2`). |

### Authentication

This API requires an API key passed as a Bearer token in the `Authorization` header.

**Header Format:**
```http
Authorization: Bearer <YOUR_API_KEY>
```

---

## Example Request

Here is an example of how to make a request to the API using `curl` or standard JavaScript.

### Using `curl`

```bash
curl -X GET "https://money-calc-gateway.ddpanda.workers.dev/api/v1/fund/pro/<YOUR_ISIN_HERE>" \
     -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

### Using JavaScript / TypeScript (`fetch`)

```javascript
const ISIN = "<YOUR_ISIN_HERE>";
const API_KEY = "YOUR_API_KEY_HERE";
const WORKER_URL = "https://money-calc-gateway.ddpanda.workers.dev";

async function getFundData() {
  const response = await fetch(`${WORKER_URL}/api/v1/fund/pro/${ISIN}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error fetching fund data:", data);
    return;
  }

  console.log("Fund Data:", data);
}

getFundData();
```

---

## What to Expect (Responses & Status Codes)

Because this API fetches real-time data on demand, **you must handle the `503 Service Unavailable` status gracefully**. If you request an ISIN that we haven't calculated recently, the API will instantly trigger a background calculation job and ask you to wait.

### 1. Success (`200 OK`)
The fund exists in our database and your quota is valid. The requested quota is consumed.

```json
{
  "isin": "string",
  "code": "string | null",
  "morningstar_id": "string | null",
  "fund_name": "string",
  "scheme_short_name": "string | null",
  "category": "string | null",
  "sub_category": "string | null",
  "fund_type": "string | null",
  "plan_name": "string | null",
  "option_name": "string | null",
  "payout_freq": "string | null",
  "inception_date": "YYYY-MM-DD | null",
  "benchmark": "string | null",
  "riskometer": "string | null",
  "investment_style": "string | null",
  "rating": "string | null",
  "objective": "string | null",
  "is_active": "boolean | null",
  "latest_nav": "number | null",
  "nav_change": "number | null",
  "nav_change_percent": "number | null",
  "nav_date": "YYYY-MM-DD | null",
  "aum_cr": "number | null",
  "expense_ratio": "number | null",
  "turnover_ratio": "number | null",
  "turnover_ratio_cat_avg": "number | null",
  "exit_load": "string | null",
  "lockin_period": "string | null",
  "pe": "number | null",
  "cat_avg_pe": "number | null",
  "pb": "number | null",
  "cat_avg_pb": "number | null",
  "price_sale": "number | null",
  "cat_avg_price_sale": "number | null",
  "price_cash_flow": "number | null",
  "cat_avg_price_cash_flow": "number | null",
  "dividend_yield": "number | null",
  "cat_avg_dividend_yield": "number | null",
  "roe": "number | null",
  "cat_avg_roe": "number | null",
  "yield_to_maturity": "number | null",
  "modified_duration": "number | null",
  "avg_eff_maturity": "number | null",
  "avg_credit_quality_name": "string | null",
  "equity_alloc": "number | null",
  "debt_alloc": "number | null",
  "cash_alloc": "number | null",
  "other_alloc": "number | null",
  "large_cap_wt": "number | null",
  "mid_cap_wt": "number | null",
  "small_cap_wt": "number | null",
  "others_cap_wt": "number | null",
  "number_of_holdings": "number | null",
  "avg_market_cap_cr": "number | null",
  "top_3_sectors_weight": "number | null",
  "top_5_stocks_weight": "number | null",
  "top_10_stocks_weight": "number | null",
  "kbyi": "array | null",
  "calculated_at": "ISO-8601 Timestamp",
  "fund_holdings": [
    {
      "stock_name": "string",
      "sector": "string | null",
      "weighting": "number | null",
      "market_value": "number | null",
      "change_1m": "number | null"
    }
  ],
  "fund_performance_history": [
    {
      "cagr_metrics": "object | null",
      "risk_metrics": "object | null",
      "quarterly_performance": "array | null",
      "best_periods": "object | null",
      "worst_periods": "object | null",
      "sip_returns": "object | null",
      "cagr_cat_avg": "object | null (mirrors cagr_metrics.cagr_cat_avg)",
      "recorded_at": "YYYY-MM-DD | null"
    }
  ],
  "fund_managers": [
    {
      "manager_name": "string",
      "role": "string | null",
      "start_date": "YYYY-MM-DD | null",
      "end_date": "YYYY-MM-DD | null"
    }
  ],
  "fund_peers": [
    {
      "peer_isin": "string | null",
      "peer_name": "string | null",
      "cagr_1y": "number | null",
      "cagr_3y": "number | null",
      "cagr_5y": "number | null",
      "cagr_10y": "number | null",
      "yield_to_maturity": "number | null",
      "modified_duration": "number | null",
      "avg_eff_maturity": "number | null",
      "expense_ratio": "number | null",
      "portfolio_turnover": "number | null",
      "std_deviation": "number | null"
    }
  ],
  "fund_sectors": [
    {
      "sector_name": "string",
      "weighting": "number | null",
      "market_value": "number | null",
      "change_1m": "number | null"
    }
  ]
}
```

### 2. Processing / Background Calculation Triggered (`503 Service Unavailable` or `202 Accepted`)

**For Single ISIN requests (503):** The fund data was not found in our database. A background calculation has been triggered. You must wait and retry the request. The response header `Retry-After` indicates how long to wait (typically 60s).

```json
{
  "status": "processing",
  "message": "Fund data is currently being retrieved. Please retry this request in a few minutes."
}
```

**For Bulk/Comma-Separated ISIN requests (202):** The API acknowledges your list of ISINs and queues them for background processing (fire-and-forget). Your quota is **not** consumed for this queuing operation.

```json
{
  "status": "processing",
  "message": "ISINs queued for background calculation."
}
```

### 3. Quota Exceeded or Invalid Key (`429 Too Many Requests`)
Your API key is either invalid, or you have consumed your allotted quota.

```json
{
  "error": "Quota Exceeded or Invalid API Key. Please check your allocation."
}
```

### 4. Missing Authentication (`401 Unauthorized`)
You forgot to include the `Authorization` header, or it is formatted incorrectly, or your API key is inactive/invalid.

```json
{
  "error": "Missing or invalid Authorization header"
}
```

### 5. Invalid Request (`400 Bad Request`)
You have provided an invalid ISIN format in a bulk request, or exceeded the maximum limit of 50 ISINs per bulk request, or provided no ISINs.

```json
{
  "error": "Bad Request: Maximum 50 ISINs allowed per bulk request"
}
```

### 5. Invalid Endpoint (`404 Not Found`)
The URL path is incorrect or the ISIN is not exactly 12 alphanumeric characters.

```json
{
  "error": "Not Found or Invalid Endpoint"
}
```

### 6. Invalid HTTP Method (`405 Method Not Allowed`)
You attempted to use `POST`, `PUT`, `DELETE`, etc. This API is strictly read-only (`GET`).

```json
{
  "error": "Method Not Allowed. This API is read-only."
}
```

---

## Best Practices for Integration

1. **Implement Retry Logic (Polling):** Since requested ISINs might trigger a 3-minute background calculation, write your application code to catch a `503` status and automatically `setTimeout` to retry the exact same request after the `Retry-After` header interval (or roughly 3 minutes).
2. **Handle CORS:** If you are calling this API directly from a browser (React, Vue, plain JS), CORS is fully supported. Ensure you pass the Authorization header exactly as specified so the `OPTIONS` preflight request succeeds.
3. **Keep Keys Secure:** Never expose your API key in client-side code unless absolutely unavoidable (like an internal dashboard). Proxy the request through your own backend if you are building a public-facing app.

---

## Real-world Example: Response Data (INF917K01RI2)

Below is a live data snapshot for the **HSBC Business Cycles Direct Growth** fund, showcasing the enriched `kbyi` and competitive peer analysis.

```json
{
  "isin": "INF917K01RI2",
  "code": "MCC519",
  "fund_name": "HSBC Business Cycles Direct Growth",
  "category": "Equity",
  "latest_nav": 44.93,
  "aum_cr": 1089.59,
  "expense_ratio": 1.04,
  "kbyi": [
    {
      "topPerformer": {
        "text": "This scheme has consistently delivered the best returns in its Equity - Other category across .",
        "returns": [
          { "tenure": "1Y", "scheme": "15.32", "catAvg": null },
          { "tenure": "3Y", "scheme": "21.36", "catAvg": null },
          { "tenure": "5Y", "scheme": "17.79", "catAvg": null }
        ]
      }
    },
    {
      "costEfficient": {
        "text": "This scheme has one of the lowest Expense Ratio (TER) in its Equity - Other category.",
        "cost": [{ "schemeCost": "1.04", "catAvgCost": "1.33" }]
      }
    },
    {
      "volatilitySD": {
        "text": "This scheme has exhibited a high level of volatility within its Equity - Other category over the past 3 years."
      }
    }
  ],
  "calculated_at": "2026-02-28T22:48:51.133251+00:00",
  "fund_holdings": [
    {
      "stock_name": "ICICI Bank Ltd",
      "sector": "Financial Services",
      "weighting": 10.58,
      "market_value": 115.18,
      "change_1m": 1.23
    },
    { "stock_name": "Reliance Industries Ltd", "sector": "Energy", "weighting": 10.28 }
  ],
  "fund_performance_history": [
    {
      "recorded_at": "2026-02-28",
      "cagr_metrics": {
        "cagr": {
          "1 Year": "15.32",
          "3 Years": "78.76",
          "5 Years": "126.75",
          "10 Years": "353.81"
        },
        "cagr_rank_in_cat": { "1 Year": 68, "3 Years": 26, "5 Years": 18, "10 Years": 9 },
        "cagr_cat_avg": { "1 Year": "13.11", "3 Years": "18.02", "5 Years": "14.73" }
      },
      "quarterly_performance": [
        { "period": "Q1", "return": "5.21" },
        { "period": "Q2", "return": "-1.18" }
      ],
      "best_periods": { "1Y": { "from": "2025-03-01", "to": "2026-02-28", "return": "15.32" } },
      "worst_periods": { "1Y": { "from": "2024-05-01", "to": "2025-04-30", "return": "-7.42" } },
      "sip_returns": { "1Y": "11.2", "3Y": "14.9" },
      "risk_metrics": {
        "returns": { "1y": "15.32", "3y": "21.36", "5y": "17.79" },
        "risk_std_dev": { "1y": "22.73", "3y": "16.77", "5y": "15.58" },
        "sharpe_ratio": { "1y": null, "3y": null, "5y": null }
      }
    }
  ],
  "fund_peers": [
    {
      "peer_isin": "INF917K01RI2",
      "peer_name": "HSBC Business Cycles Direct Growth",
      "cagr_1y": 15.32,
      "cagr_3y": 21.36,
      "cagr_5y": 17.79,
      "cagr_10y": 16.33,
      "std_deviation": 16.77,
      "portfolio_turnover": 17.56
    },
    {
      "peer_isin": "INF109KC1RH9",
      "peer_name": "ICICI Prudential India Opportunities Fund Direct Growth",
      "cagr_1y": 17.29,
      "cagr_3y": 25.02,
      "cagr_5y": 24.26,
      "expense_ratio": 0.66
    }
  ]
}
```
