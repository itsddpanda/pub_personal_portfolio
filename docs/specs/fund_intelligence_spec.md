# Fund Intelligence — Scoring & Evaluation Specification

**Version:** 1.0  
**Date:** 2026-02-25  
**Status:** Approved (Planning Only)

---

## 1. Purpose

This document is the **permanent reference** for every evaluation mechanism, score formula, signal mapping, and interpretation rule used by the Fund Intelligence Engine. All logic described here is computed dynamically — **no scores, verdicts, or signals are stored directly in the database**. They are always derived as functions of the stored data columns at query time.

---

## 2. Foundational Rules

| Rule | Description |
|---|---|
| **No third-party attribution** | The words "Moneycontrol", "scrape", "scrapped", "DaaS" must **never** appear in code, UI, database, logs, API responses, or documentation within the MFA project. The data source is referred to only as "Fund Intelligence API" internally. |
| **Scores are computed, never stored** | Pillar scores, composite scores, and signal codes are **always** calculated at runtime from the raw metric columns. The database stores only the raw data points. |
| **Signals are codes, not text** | Signals are stored/transmitted as integer codes (e.g., `1`, `2`, `3`, `4`) and mapped to human-readable labels only in the frontend presentation layer. |
| **Score display is gated** | The scoring analysis is not shown directly on page load. It is accessed via a user action (dropdown, link, or toggle). Only users with a valid API key allocation get scoring. |
| **Cache lifecycle = API expiry + 7 days** | Cached fund data and all derived analysis auto-deletes 7 days after the API key expiration date. |
| **Advisory only** | The system never says "SELL" or "SWITCH". The strongest signal is "REVIEW". Every analysis page shows: *"This analysis is based on historical data and does not constitute investment advice. Past performance does not guarantee future results."* |

---

## 3. The Four Pillars

### 3.1 Pillar 1: Returns (Weight: 30%)

**Question answered:** *"Is my fund delivering competitive returns?"*

**Why it matters:** Raw returns are the first thing any investor checks. But raw CAGR in isolation is meaningless — a fund with 15% CAGR sounds great until you learn the category average is 18%. The delta (outperformance vs. category) is the real signal.

#### Input Metrics

| Metric | Source Column | Used For |
|---|---|---|
| Fund CAGR 3Y | `performance.cagr.3Y` | Primary return measure (3Y smooths out noise) |
| Fund CAGR 5Y | `performance.cagr.5Y` | Long-term consistency check |
| Category Avg CAGR 3Y | `risk_metrics.returns.cat_avg_3y` | Benchmark for comparison |
| Category Avg CAGR 5Y | `risk_metrics.returns.cat_avg_5y` | Long-term benchmark |
| Category Min 3Y | `risk_metrics.returns.cat_min_3y` | Normalization floor |
| Category Max 3Y | `risk_metrics.returns.cat_max_3y` | Normalization ceiling |

#### Score Formula

```
returns_3y_score = normalize(fund_cagr_3y, cat_min_3y, cat_max_3y)
returns_5y_score = normalize(fund_cagr_5y, cat_min_5y, cat_max_5y)

pillar_1_score = (returns_3y_score × 0.6) + (returns_5y_score × 0.4)
```

Where `normalize()`:
```python
def normalize(value: float, cat_min: float, cat_max: float) -> float:
    """Maps a value to 0–100 based on category range."""
    if cat_max == cat_min:
        return 50.0  # No spread = neutral
    raw = ((value - cat_min) / (cat_max - cat_min)) * 100
    return max(0.0, min(100.0, raw))  # Clamp to 0–100
```

#### Interpretation for User

| Score Range | What It Means |
|---|---|
| 75–100 | Fund consistently outperforms category across both 3Y and 5Y horizons |
| 50–74 | Returns are at or slightly above category average — adequate |
| 30–49 | Trailing the category — needs monitoring; may recover or may indicate structural issue |
| 0–29 | Significant underperformance — the fund is delivering bottom-quartile returns |

#### SIP Returns (Supplementary Display)

SIP returns are shown for informational context but **do not feed into the score**. They answer: *"What would a ₹10,000/month SIP investor have actually earned?"* — more realistic than lump-sum CAGR for retail investors.

---

### 3.2 Pillar 2: Risk-Adjusted Quality (Weight: 30%)

**Question answered:** *"Am I being adequately compensated for the risk I'm taking?"*

**Why it matters:** Two funds with identical 15% CAGR are not equal if one had 8% volatility and the other had 20%. The Sharpe and Sortino ratios reveal whether the returns are due to skill or just excessive risk-taking.

#### Input Metrics

| Metric | Source Column | Inversion? |
|---|---|---|
| Fund Sharpe 3Y | `risk_metrics.sharpe_ratio.3y` | No (higher = better) |
| Category Avg Sharpe 3Y | `risk_metrics.sharpe_ratio.cat_avg_3y` | — |
| Cat Min/Max Sharpe 3Y | `risk_metrics.sharpe_ratio.cat_min_3y / cat_max_3y` | — |
| Fund Sortino 3Y | `risk_metrics.sortino_ratio.3y` | No (higher = better) |
| Category Avg Sortino 3Y | `risk_metrics.sortino_ratio.cat_avg_3y` | — |
| Cat Min/Max Sortino 3Y | `risk_metrics.sortino_ratio.cat_min_3y / cat_max_3y` | — |

#### Score Formula

```
sharpe_score = normalize(fund_sharpe_3y, cat_min_sharpe_3y, cat_max_sharpe_3y)
sortino_score = normalize(fund_sortino_3y, cat_min_sortino_3y, cat_max_sortino_3y)

pillar_2_score = (sharpe_score × 0.6) + (sortino_score × 0.4)
```

Sharpe gets 60% weight because it's the industry standard; Sortino gets 40% because it penalizes only downside risk (more investor-friendly).

#### Interpretation for User

| Score Range | What It Means |
|---|---|
| 75–100 | Outstanding risk-adjusted returns — the fund manager is generating returns efficiently |
| 50–74 | Adequate risk-return profile — getting fair compensation for risk taken |
| 30–49 | Suboptimal — similar returns are available at lower risk in the category |
| 0–29 | Poor — taking more risk than peers but delivering less return per unit of risk |

#### Cross-Signal with Pillar 1

| Returns Score | Risk Quality Score | Insight Shown to User |
|---|---|---|
| High | High | "Strong performance with efficient risk management" |
| High | Low | "High returns, but at disproportionate risk. Suitable for aggressive investors." |
| Low | High | "Conservative, stable management. Returns may lag in bull markets." |
| Low | Low | "Underperforming on both return and risk dimensions." |

---

### 3.3 Pillar 3: Cost Efficiency (Weight: 20%)

**Question answered:** *"Am I overpaying for this fund's management?"*

**Why it matters:** Expense ratio is the one metric that **guaranteed** reduces returns. Even 0.5% difference, compounded over 10 years on a ₹5L investment, results in ~₹42,000 less.

#### Input Metrics

| Metric | Source Column | Inversion? |
|---|---|---|
| Fund Expense Ratio | `overview.expense_ratio` | **Yes** (lower = better) |
| Peer Median Expense Ratio | Calculated: `median(peers[].expense_ratio)` | — |
| Peer Min Expense Ratio | Calculated: `min(peers[].expense_ratio)` | — |
| Peer Max Expense Ratio | Calculated: `max(peers[].expense_ratio)` | — |

#### Score Formula

```
# Inverted: lower expense = higher score
cost_score = normalize_inverted(fund_expense, peer_min_expense, peer_max_expense)
```

Where `normalize_inverted()`:
```python
def normalize_inverted(value: float, range_min: float, range_max: float) -> float:
    """Lower value = higher score."""
    if range_max == range_min:
        return 50.0
    raw = ((range_max - value) / (range_max - range_min)) * 100
    return max(0.0, min(100.0, raw))
```

#### Cost Drag Display (Supplementary)

The UI calculates and displays the real ₹ impact:

```python
def cost_drag(expense_delta: float, investment: float, years: int, cagr: float) -> float:
    """
    Shows how much more you'd have with a lower-cost fund.
    expense_delta = fund_expense - peer_median_expense
    """
    with_fund = investment * ((1 + (cagr - expense_delta) / 100) ** years)
    with_peer = investment * ((1 + cagr / 100) ** years)
    return with_peer - with_fund
```

Example UI: *"Your fund's expense ratio is 0.5% above peer median. On ₹5,00,000 over 10 years, this costs ≈ ₹42,000 in lost returns."*

#### Interpretation for User

| Score Range | What It Means |
|---|---|
| 75–100 | Among the cheapest in its category — cost-efficient |
| 50–74 | Average cost — acceptable if returns justify it |
| 30–49 | Above-average cost — review if returns are proportionally higher |
| 0–29 | Expensive — significant cost drag. Lower-cost peers may deliver similar returns. |

---

### 3.4 Pillar 4: Consistency (Weight: 20%)

**Question answered:** *"Can I trust this fund's track record, or is it a one-off?"*

**Why it matters:** A fund that returned +40% one year and -20% the next gives the same CAGR as a steady +10%/year fund, but the experience is completely different. Consistency measures predictability.

#### Input Metrics

| Metric | Source Column | Inversion? |
|---|---|---|
| Fund Std Dev 3Y | `risk_metrics.risk_std_dev.3y` | **Yes** (lower = more consistent) |
| Category Avg Std Dev 3Y | `risk_metrics.risk_std_dev.cat_avg_3y` | — |
| Cat Min/Max Std Dev 3Y | `risk_metrics.risk_std_dev.cat_min_3y / cat_max_3y` | — |
| Fund Beta 3Y | `risk_metrics.beta.3y` | Special (see below) |
| Category Avg Beta 3Y | `risk_metrics.beta.cat_avg_3y` | — |

#### Score Formula

```
# Lower std dev = more consistent = higher score
std_dev_score = normalize_inverted(fund_std_dev_3y, cat_min_std_dev_3y, cat_max_std_dev_3y)

# Beta: closer to 1.0 = neutral; deviation from 1.0 = less predictable
beta_deviation = abs(fund_beta_3y - 1.0)
cat_max_beta_dev = max(abs(cat_max_beta_3y - 1.0), abs(cat_min_beta_3y - 1.0))
beta_score = normalize_inverted(beta_deviation, 0.0, cat_max_beta_dev)

pillar_4_score = (std_dev_score × 0.6) + (beta_score × 0.4)
```

#### Interpretation for User

| Score Range | What It Means |
|---|---|
| 75–100 | Highly predictable returns with low volatility — suitable for conservative investors |
| 50–74 | Moderate volatility — expected for market-tracking funds |
| 30–49 | Above-average swings — may test patience during downturns |
| 0–29 | Highly volatile — returns are unpredictable; only suitable for high-risk-tolerance investors |

#### Beta Interpretation Table (Displayed to User)

| Beta Value | Label |
|---|---|
| < 0.8 | "Dampens market swings — defensive" |
| 0.8–1.2 | "Moves with the market — neutral" |
| 1.2–1.5 | "Amplifies market moves — moderately aggressive" |
| > 1.5 | "Highly market-sensitive — aggressive" |

---

## 4. Composite Score & Signal Codes

### Composite Score Formula

```python
def composite_score(pillars: dict) -> float:
    """
    pillars = {
        "returns": {"score": float | None, "weight": 0.30},
        "risk_quality": {"score": float | None, "weight": 0.30},
        "cost": {"score": float | None, "weight": 0.20},
        "consistency": {"score": float | None, "weight": 0.20},
    }
    Pillars with None score are excluded; weights are redistributed.
    """
    active = {k: v for k, v in pillars.items() if v["score"] is not None}
    if not active:
        return None  # Cannot score

    total_weight = sum(v["weight"] for v in active.values())
    score = sum(
        (v["score"] * v["weight"] / total_weight)
        for v in active.values()
    )
    return round(score, 1)
```

### Signal Code Mapping

| Code | Score Range | Label (Frontend Only) | Color |
|---|---|---|---|
| `4` | 75–100 | STRONG HOLD | `#10B981` (emerald-500) |
| `3` | 50–74 | HOLD | `#6EE7B7` (emerald-300) |
| `2` | 30–49 | WATCH | `#F59E0B` (amber-500) |
| `1` | 0–29 | REVIEW | `#EF4444` (red-500) |

```python
def score_to_signal_code(score: float | None) -> int | None:
    if score is None:
        return None
    if score >= 75:
        return 4
    if score >= 50:
        return 3
    if score >= 30:
        return 2
    return 1
```

> [!IMPORTANT]
> The API response returns **only the code** (e.g., `"signal": 3`). The frontend maps code → label → color. The label strings "STRONG HOLD", "HOLD", "WATCH", "REVIEW" exist only in the frontend rendering layer.

---

## 5. Portfolio Composition Analysis

### 5.1 Asset Allocation

**Data columns:** `equity_alloc`, `bond_alloc`, `cash_alloc`, `other_alloc`

**Value to user:** Shows whether the fund's actual positioning matches its stated category mandate.

| Observation | Insight Shown |
|---|---|
| Equity fund with >15% cash | "Fund is holding significant cash — may indicate defensive positioning or upcoming deployment" |
| Debt fund with >5% equity | "Fund has equity exposure beyond its category norm" |
| Cash allocation < 2% | "Fully deployed — indicates high conviction" |

### 5.2 Concentration Risk

**Data columns:** `top_5_stk_wt`, `top_10_stk_wt`, `number_of_holdings`

| Metric | Threshold | Signal |
|---|---|---|
| Top 5 weight > 35% | High | "⚠️ High Concentration — top 5 holdings represent over a third of the portfolio" |
| Top 5 weight > 25% | Moderate | "Moderately concentrated portfolio" |
| Top 5 weight ≤ 25% | Low | "Well diversified across holdings" |
| Holdings count < 25 | — | "Focused strategy — fewer, higher-conviction picks" |
| Holdings count > 60 | — | "Broad strategy — highly diversified, index-like" |

### 5.3 Top Holdings Table

Displays: `stock_name`, `sector`, `weighting`, `market_value`

- Sorted by `weighting` descending
- Top 10 shown by default, expandable to full list
- Sectors aggregated into a separate sector breakdown summary

---

## 6. Peer Comparison Logic

### Ranking Methodology

Peers from the API are re-ranked using a **simplified composite** of available data:

```python
def peer_rank_score(peer: dict) -> float:
    """Simple peer ranking: higher is better."""
    return_score = float(peer.get("return", {}).get("3y", 0) or 0)
    expense_penalty = float(peer.get("expense_ratio", 0) or 0) * 10
    volatility_penalty = float(peer.get("std_deviation", 0) or 0)
    return return_score - expense_penalty - volatility_penalty
```

### Display Rules

- User's fund highlighted with a ★ accent and distinct row color
- Sorted by `peer_rank_score` descending (best first)
- Columns: Fund Name, AUM, 1Y, 3Y, 5Y, Expense Ratio, Std Deviation
- Funds with better rank score AND lower expense ratio than user's fund are tagged with a subtle "Worth Comparing" indicator — **not a recommendation**, just a data flag

---

## 7. Fundamentals Interpretation

Fundamentals data availability varies by fund type. If a metric is not available, show `"-"` (never hide the section).

### Equity Fund Metrics

| Metric | Value Range | Interpretation |
|---|---|---|
| **P/E Ratio** | < Category Avg | "Value-oriented portfolio — stocks are priced conservatively" |
| | > Category Avg by >20% | "Growth-oriented portfolio — premium valuations" |
| | Within ±20% of Category | "Blended portfolio — mix of value and growth" |
| **P/B Ratio** | < 1.0 | "Below book value — potentially undervalued holdings" |
| | 1.0–3.0 | "Fair valuation range" |
| | > 3.0 | "Premium-valued holdings — growth expectations priced in" |

### Debt Fund Metrics

| Metric | Interpretation |
|---|---|
| **YTM** | Compared against current RBI repo rate. YTM > repo + 2% → "Attractive yield premium". YTM ≈ repo → "Low-risk, low-yield positioning" |
| **Modified Duration** | < 1 year → "Very low interest rate sensitivity". 1–3 years → "Moderate". > 3 years → "High — vulnerable to rate hikes" |
| **Credit Quality** | AAA → "Highest safety — sovereign/PSU grade". AA → "High quality". Below AA → "Higher yield but elevated credit risk" |

---

## 8. Data Validation Engine

Cross-validation runs as a **separate engine** (`validation_engine.py`) and writes validation status back to the data tables.

### Validation Status Column

Every enrichment record has a column: `validation_status` (integer)

| Code | Meaning |
|---|---|
| `0` | Not yet validated |
| `1` | Validated — all checks passed |
| `2` | Partial match — minor discrepancies (NAV delta 1–5%) |
| `3` | Validation failed — significant discrepancy (NAV delta >5%) |

### Validation Checks

| Check ID | What | How | Result Column |
|---|---|---|---|
| `V1` | NAV accuracy | Compare enrichment `latest_nav` vs MFA's own `scheme.latest_nav` | `nav_validation_status` (0/1/2/3) |
| `V2` | Name match | Fuzzy match enrichment `fund_name` vs MFA's `scheme.name` | `name_validation_status` (0/1/2/3) |
| `V3` | Data freshness | Check if `fetched_at` + enrichment age > 45 days | `freshness_status` (0/1/2/3) |

```python
def validate_nav(enrichment_nav: float, mfa_nav: float) -> int:
    """Returns validation status code."""
    if mfa_nav is None or mfa_nav == 0:
        return 0  # Cannot validate
    delta_pct = abs(enrichment_nav - mfa_nav) / mfa_nav * 100
    if delta_pct <= 1.0:
        return 1  # Match
    if delta_pct <= 5.0:
        return 2  # Minor discrepancy
    return 3  # Significant mismatch
```

### UI Treatment

| Validation Status | UI Indicator |
|---|---|
| `0` (Not validated) | No indicator shown |
| `1` (Passed) | Subtle ✅ checkmark on data freshness footer |
| `2` (Partial) | Amber badge: "⚠️ Minor data variance detected" |
| `3` (Failed) | Red badge: "⚠️ Data may be outdated — last verified: [date]" |

---

## 9. Cache Lifecycle & Auto-Purge

### Lifecycle Rules

```
Cache Creation  → fetched_at = now()
Cache Valid     → Until 7th of the NEXT month from fetched_at
                  OR API key expiry + 7 days (whichever is SOONER)
Cache Expired   → Auto-delete enrichment record + ALL child records
                  (performance, risk, holdings, peers)
                  + Scoring/analysis becomes unavailable
```

### Auto-Purge Logic

```python
from datetime import date, timedelta

def should_purge(fetched_at: date, api_key_expiry: date) -> bool:
    """Determines if cached data should be hard-deleted."""
    today = date.today()
    
    # Rule 1: API key expired + 7 days grace
    if api_key_expiry and today > api_key_expiry + timedelta(days=7):
        return True  # Hard delete
    
    # Rule 2: Monthly refresh anchor (7th of next month)
    if fetched_at.month == 12:
        next_anchor = date(fetched_at.year + 1, 1, 7)
    else:
        next_anchor = date(fetched_at.year, fetched_at.month + 1, 7)
    
    if today >= next_anchor:
        return True  # Stale, needs re-fetch (soft expiry)
    
    return False
```

### Purge Cascade

On purge, delete in order:
1. `fund_holding` (FK → enrichment)
2. `fund_peer` (FK → enrichment)
3. `fund_risk_metrics` (FK → enrichment)
4. `fund_performance` (FK → enrichment)
5. `fund_enrichment` (parent)

---

## 10. Error Messages (User-Facing)

| Scenario | Code | User-Facing Message |
|---|---|---|
| Data ready | `200` | *(No message — render data)* |
| Being calculated | `503` | "Analysis data is being prepared. Estimated wait: ~3 minutes." |
| Quota / server load | `429` | "The data servers are under load. Your current request to get data is ignored. Contact Support." |
| Auth failure | `401` | "Analysis temporarily unavailable. Please contact support." |
| Network unreachable | Timeout | Cached: "Using previously cached data from [date]." / No cache: "Analysis unavailable. Check your connection." |
| No data for ISIN | `404` | "No fund intelligence data available for this scheme." |
| Partial data | `200` partial | Available sections rendered; unavailable metrics show `"-"` |

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-02-25 | Agent | Initial specification created |
