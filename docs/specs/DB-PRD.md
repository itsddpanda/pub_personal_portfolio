# Mutual Fund Analyzer — Database Requirements Document (DB-PRD)

**Version:** 1.0
**Date:** 2026-02-26
**Status:** Active

This document outlines the database tables, fields, and descriptions for the Mutual Fund Analyzer. The application relies on an SQLite database (`/data/mfa.db`) using WAL mode for performance.

---

## 1. Current Database Schema

### 1.1 Shared Reference Data

#### `amc` (Asset Management Companies)
Extracted automatically from CAS parsing.
- `id` (int, PK)
- `name` (str, Index)
- `code` (str, Unique)

#### `scheme` (Mutual Fund Schemes)
Core entity matching ISINs to AMFI codes for external integrations.
- `id` (int, PK)
- `isin` (str, Unique, Index)
- `amfi_code` (str, nullable)
- `name` (str)
- `type` (str) - e.g., EQUITY, DEBT
- `advisor` (str, nullable) - DIRECT, REGULAR
- `amc_id` (int, FK -> amc.id)
- `fund_house` (str, nullable)
- `scheme_category` (str, nullable)
- `scheme_type` (str, nullable)
- `latest_nav` (float, nullable)
- `latest_nav_date` (date, nullable)
- `valuation_date` (date, nullable) - Snapshot from CAS
- `valuation_value` (float, nullable) - Snapshot from CAS
- `last_history_sync` (date, nullable) - Backfill tracking throttle

#### `navhistory` (Chronological NAV Data)
Historical NAV points for portfolio charting.
- `id` (int, PK)
- `scheme_id` (int, FK -> scheme.id)
- `date` (date)
- `nav` (float)
*(Unique constraint on `scheme_id`, `date`)*

#### `systemstate` (Background Sync tracking)
Key-value store for global states like the AMFI bulk sync status.
- `key` (str, PK)
- `value` (str)
- `updated_at` (datetime)

### 1.2 Private User Data

#### `user` (Profiles)
Auto-created from PANs found in uploaded CAS.
- `id` (UUID, PK)
- `name` (str)
- `pan` (str, Unique, Index)
- `pin_hash` (str, nullable) - SHA-256
- `created_at` (datetime)

#### `portfolio` (User Portfolios)
Ties folios and transactions to a specific User profile.
- `id` (int, PK)
- `user_id` (UUID, FK -> user.id)
- `name` (str)

#### `folio` (Accounts with AMC)
- `id` (int, PK)
- `portfolio_id` (int, FK -> portfolio.id)
- `amc_id` (int, FK -> amc.id)
- `folio_number` (str)

#### `transaction` (Ledger Entries)
Deduplicated via deterministic composite hash.
- `id` (str, PK) - Generating block: SHA-256(PAN|ISIN|Date|Amount|Type|Units)
- `folio_id` (int, FK -> folio.id)
- `scheme_id` (int, FK -> scheme.id)
- `date` (date)
- `type` (str) - e.g., PURCHASE, REDEMPTION
- `amount` (float)
- `units` (float)
- `nav` (float)
- `balance` (float, nullable)

---

## 2. Active Database Schema (Fund Intelligence)

The following tables support the Fund Intelligence engine. Metrics are cached and auto-purged based on API key expiration + 7 days, or monthly anchors.

#### `fundenrichment` (Parent Entity)
Stores the API fetch payload snapshot and governs lifecycle.
- `id` (int, PK)
- `scheme_id` (int, FK -> scheme.id, Unique)
- `fund_name` (str) - Sourced from API
- `fetched_at` (datetime)
- `validation_status` (int) - 0: Unvalidated, 1: Passed, 2: Partial, 3: Failed
- `nav_validation_status` (int)
- `name_validation_status` (int)
- `freshness_status` (int)
- `expense_ratio` (float, nullable)
- `equity_alloc` (float, nullable)
- `debt_alloc` (float, nullable)
- `cash_alloc` (float, nullable)
- `other_alloc` (float, nullable)

#### `fundperformance`
- `id` (int, PK)
- `enrichment_id` (int, FK -> fundenrichment.id, Unique)
- `returns_1y` (float, nullable)
- `returns_3y` (float, nullable)
- `returns_5y` (float, nullable)
- `returns_tooltip` (str, nullable)
- `cagr_1y` (float, nullable)
- `cagr_3y` (float, nullable)
- `cagr_5y` (float, nullable)
- `cagr_tooltip` (str, nullable)

#### `fundriskmetrics`
- `id` (int, PK)
- `enrichment_id` (int, FK -> fundenrichment.id, Unique)
- `cat_avg_1y / 3y / 5y` (float, nullable)
- `cat_min_1y / 3y / 5y` (float, nullable)
- `cat_max_1y / 3y / 5y` (float, nullable)
- `sharpe_ratio_1y / 3y / 5y` (float, nullable)
- `sharpe_ratio_tooltip` (str, nullable)
- `sortino_ratio_1y / 3y / 5y` (float, nullable)
- `sortino_ratio_tooltip` (str, nullable)
- `risk_std_dev_1y / 3y / 5y` (float, nullable)
- `risk_std_dev_tooltip` (str, nullable)
- `beta_1y / 3y / 5y` (float, nullable)
- `beta_tooltip` (str, nullable)

#### `fundholding` (Concentration & Allocation)
- `id` (int, PK)
- `enrichment_id` (int, FK -> fundenrichment.id, Index)
- `stock_name` (str)
- `sector` (str, nullable)
- `weighting` (float, nullable)
- `market_value` (float, nullable)

#### `fundpeer` (Peer Comparison Ranking)
- `id` (int, PK)
- `enrichment_id` (int, FK -> fundenrichment.id, Index)
- `fund_name` (str)
- `peer_isin` (str, nullable)
- `expense_ratio` (float, nullable)
- `std_deviation` (float, nullable)
- `return_3y` (float, nullable)
