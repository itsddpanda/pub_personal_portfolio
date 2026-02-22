# Mutual Fund Analyzer — Product Requirements Document

**Version:** 1.4.3
**Date:** 2026-02-18
**Last Updated:** 2026-02-22
**Status:** Production Released

## 1. Executive Summary
A privacy-first, offline-capable web application for Indian investors to track and analyze their mutual fund portfolios. It parses Consolidated Account Statements (CAS) locally, manages multi-user portfolios using a unique PAN-based identity system, and provides deep insights (XIRR, FIFO cost basis) without sending sensitive data to external servers.

### Personas
- **The Privacy-Conscious Investor:** Zero tolerance for uploading financial data to cloud/third-party servers.
- **The Household CFO:** Manages portfolios for self, spouse, and parents on a single device, requiring clean separation of data.

## 2. Verified Constraints & Technical Discovery
| Dimension | Constraint | Source |
|---|---|---|
| **CAS Parsing** | Must use **Python `casparser`** library. JS alternatives are immature or API-dependent. | Technical Discovery |
| **State Management** | "Active User" state is client-side (`localStorage`). Backend is stateless for "Login". | User Requirement |
| **Authentication** | No cloud auth. "Login" = Client holding a specific `user_id`. | Technical Constraint |
| **Security** | "Logout" is a client-side session clear. Data remains in SQLite. | Technical Constraint |
| **Transaction Types** | Transaction type strings use underscores (`SWITCH_OUT`, `PURCHASE_SIP`), not spaces. | RCA: Type Mismatch Bug |

## 3. Hardened Requirements & Edge Cases
| Scenario | Handling Strategy |
|---|---|
| **Invalid Password** | Immediate error return from parser; no lockout. |
| **PAN Mismatch** | If loaded CAS PAN != Active User PAN → Prompt to switch profile or create new user. |
| **Gap in Data** | If Transaction Cost is missing → Use CAS-provided "Total Cost" for summary. |
| **API Failure** | If `mfapi.in` is down/offline → Show last known NAV + "Stale Data" warning. |
| **Deduplication** | **Strict Composite Key:** `SHA-256(PAN\|ISIN\|Date\|Amount\|Type\|Units)`. Synthetic `OPENING_BALANCE` is skipped if prior history exists.|
| **Opening Balance** | If a scheme has `units.open > 0` but no transactions, a synthetic `OPENING_BALANCE` transaction is created. |
| **Opening Balance Reconciliation** | When real historical transactions are imported that precede an existing `OPENING_BALANCE`, the synthetic entry is **deleted** to prevent double-counting. See [RCA: Reconciliation](file:///home/panda/mfa/docs/rca/RCA_CONSOLIDATED.md) and [RCA: Dedup Conflict](file:///home/panda/mfa/docs/rca/RCA_CAS_Deduplication_Bug.md). |
| **Switching User** | Select from Dropdown. If User B has a PIN → Prompt for PIN. Success → Update `localStorage`. |
| **Forgotten PIN** | MVP Scope: No "Reset". User must re-upload CAS to regenerate/reset, or manual DB intervention. |
| **Zero Users** | `GET /api/users/` returns empty list. Home Page shows default "Get Started". |
| **Negative Units** | Outflow transactions (SWITCH_OUT, REDEMPTION) store negative units. Analytics must use `abs()`. See [RCA](file:///home/panda/mfa/docs/rca/RCA_CONSOLIDATED.md). |
| **Scheme Name Cleaning** | ISIN suffix (` - ISIN: ...`) is stripped from scheme names during CAS import. |

## 4. Architecture & Stack
**Rationale:** Chosen for local-first robustness and Python ecosystem access.
- **Docker Compose:** Orchestrates the stack.
- **Backend:** Python (FastAPI) — key for `casparser` integration + PIN endpoints. Background `cron` for AMFI sync.
- **Frontend:** Next.js 14 (React) — TypeScript, lucide-react icons, Global Navbar.
- **Database:** SQLite (WAL Mode) — file-based persistence at `/data/mfa.db`.

> See [ARCHITECTURE.md](file:///home/panda/mfa/docs/specs/mutual_fund_analyzer_ARCHITECTURE.md) for full data model, API reference, and workflows.

### Data Model (ERD Simplified)
- `User` (id, name, pan, **pin_hash**)
- `Portfolio` (id, user_id)
- `AMC` (id, name, code)
- `Scheme` (isin, name, amfi_code, amc_id, latest_nav, valuation_date, valuation_value)
- `Transaction` (id=Hash, date, units, amount, nav, balance, type)
- `NavHistory` (scheme_id, date, nav)
- `SystemState` (key, value, updated_at)

## 5. API Reference (Actual Endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/upload` | `x-user-id` (optional) | Upload CAS PDF + Password. Max 10MB. |
| `POST` | `/api/schemes/{amfi_code}/backfill` | — | Manually backfill NAV history via `mfapi.in`. |
| `GET` | `/api/schemes/{amfi_code}/history` | — | Historical NAV data for chart rendering. |
| `POST` | `/api/sync-nav` | `x-user-id` (required) | Force sync: runs AMFI bulk script + mfapi.in fallback. Returns updated summary. |
| `GET` | `/api/status/sync`| — | Get AMFI background cron job sync status. |
| `GET` | `/api/analytics/summary` | `x-user-id` (required) | Portfolio summary: invested, current, XIRR, holdings. |
| `GET` | `/api/users/` | — | List all users `{id, name, is_pin_set}`. |
| `POST` | `/api/users/{id}/verify-pin` | — | Validate PIN. |
| `POST` | `/api/users/{id}/set-pin` | — | Set/update 4-digit PIN. |
| `GET` | `/api/health` | — | Health check. |

## 6. Epics & User Stories
### Epic 1: Core Infrastructure
- **1.1:** [Done] Setup Docker Compose (FastAPI + Next.js + SQLite). `Priority: Must Have`

### Epic 2: CAS Processing
- **2.1:** [Done] Upload & Parse CAS PDF (Password protected). `Priority: Must Have`
- **2.2:** [Done] Transaction Deduplication via Composite Key. `Priority: Must Have`
- **2.3:** [Done] Synthetic Opening Balance + **Reconciliation on multi-CAS import**. `Priority: Must Have`
- **2.4:** [Done] Scheme Name Cleaning (strip ISIN suffix). `Priority: Should Have`
- **2.5:** [Done] AMC Extraction & Normalization. `Priority: Should Have`

### Epic 3: Portfolio Management
- **3.1:** [Done] Auto-create User Profile from PAN in CAS. `Priority: Must Have`
- **3.2:** [Done] Profile Warning on PAN Mismatch. `Priority: Should Have`
- **3.3:** [Done] **Global Navbar:** Persistent top bar with Home/Dashboard/Upload links. `Priority: Must Have`
- **3.4:** [Done] **User Listing & Menu:** Switch users via dropdown. `Priority: Must Have`
- **3.5:** [Done] **Logout:** Clear session from browser. `Priority: Must Have`
- **3.6:** [Done] **Re-Login UX:** Display user selection cards on Home and Navbar even if logged out. `Priority: Must Have`

### Epic 4: Market Data Sync
- **4.1:** [Done] Fetch Live NAVs via AMFI Bulk Text file. `Priority: Must Have`
- **4.2:** [Done] Auto-sync NAV via background cron job (12-hour interval). `Priority: Should Have`

### Epic 5: Analytics
- **5.1:** [Done] Dashboard with Total Value & XIRR. `Priority: Must Have`
- **5.2:** [Done] Holdings Table. `Priority: Should Have`
- **5.3:** [Done] **FIFO Cost Basis** for accurate Invested Value. `Priority: Must Have`

### Epic 6: Offline Capability
- **6.1:** [Done] Local `casparser` processing. `Priority: Must Have`
- **6.2:** [Done] Graceful failure when offline. `Priority: Should Have`

### Epic 7: Frontend Interface
- **7.1:** [Done] Upload Page (PDF + Password) with 3-phase progress. `Priority: Must Have`
- **7.2:** [Done] Dashboard View (KPI Cards + Holdings + Async Status). `Priority: Must Have`
- **7.3:** [Done] Smart Home Redirect (logged-in detection / user select). `Priority: Should Have`
- **7.4:** [Done] Password Toggle on upload form. `Priority: Nice to Have`

### Epic 8: Security
- **8.1:** [Done] **PIN Protection:** Optional 4-digit PIN (SHA-256 hashed). `Priority: Should Have`

### Epic 9: Enhancements (V1.2)

#### Feature 9.1: Direct Profile Creation
- **Story 9.1.1:** As a user uploading a CAS for a new PAN, I want the system to prompt me to create a new profile immediately so that I don't have to manually log out first.
  - *AC:* If PAN not in DB during upload, prompt "CAS belongs to new user. Create & switch?".
  - *AC:* If accepted, parse CAS, create User/Portfolio, set `localStorage` active user, and redirect to Dashboard.
  - *Priority:* Must Have | *Size:* M

#### Feature 9.2: NAV Status Transparency
- **Story 9.2.1:** As a user, I want to see the exact date of my NAV data and have a button to force a sync so that I know exactly how fresh my data is.
  - *AC:* Replace "NAV Data: Live" with "Latest NAV Date: {Max Date from portfolio holdings}".
  - *AC:* Add "Force Sync" button that triggers `POST /api/sync-nav` or equivalent to explicitly run the AMFI fetch.
  - *Priority:* Must Have | *Size:* S

#### Feature 9.3: Reliable AMFI Sync
- **Story 9.3.1:** [Done] As a user, I want all my active schemes to sync their NAVs correctly so that I don't see missing data on my dashboard.
  - *AC:* Fix `sync_amfi.py` parser logic which is currently skipping valid schemes like `146130` despite them being present in `NAVAll.txt`.
  - *Priority:* Must Have | *Size:* S

### Epic 10: Invested Value Accuracy & UX (V1.3)

#### Feature 10.1: Estimated Holdings Transparency
- **Story 10.1.1:** [Done] As a user, I want to see a warning on the dashboard when my invested value may be understated, so that I understand the data limitation.
  - *AC:* Backend returns `has_estimated_holdings: true` and `estimated_schemes_count: N` in the analytics summary when any scheme has `OPENING_BALANCE` transactions.
  - *AC:* Dashboard shows a dismissible amber banner: "Some holdings were carried forward without transaction history. Invested Value may be understated. Upload a full-history CAS to fix this."
  - *Priority:* Must Have | *Size:* S

- **Story 10.1.2:** [Done] As a user, I want to see which specific schemes have estimated invested values, so I know exactly what's affected.
  - *AC:* In the holdings table, schemes with `OPENING_BALANCE` show a "⚠️ Estimated" badge next to their invested value.
  - *Priority:* Should Have | *Size:* S

#### Feature 10.2: Upload Guidance
- **Story 10.2.1:** [Done] As a user, I want guidance on the upload page about downloading the right type of CAS, so I can get accurate data from the start.
  - *AC:* Upload page shows a tip: "For accurate invested value, download a Detailed CAS from inception (not just the last year)".
  - *Priority:* Must Have | *Size:* XS

#### Feature 10.3: Resolution Feedback
- **Story 10.3.1:** [Done] As a user who has just uploaded a full-history CAS after a partial one, I want feedback that my data has been corrected.
  - *AC:* After upload + reconciliation, if OPENING_BALANCE entries were deleted, show a success toast: "Full transaction history imported! Invested value updated for X schemes."
  - *Priority:* Should Have | *Size:* S

### Epic 11: Portfolio Charting & Deep Analytics (V1.4)

#### Feature 11.1: 10-Year NAV History
- **Story 11.1.1:** [Done] As a user, I want to see historical NAV charts for my holdings, so I can visualize performance over time.
  - *AC:* Store dense NAV history (daily) for all held schemes via `mfapi.in` async fetches.
  - *AC:* Provide an API endpoint (`/api/schemes/{amfi_code}/history`) for historical NAV data per scheme.
  - *AC:* Provide an interactive frontend `recharts` component with 1Y, 3Y, 5Y, and MAX toggles.
  - *Priority:* Could Have | *Size:* L | *Status:* ✅ Implemented


### Epic 12: Architecture & Stability Hardening (V1.3.1)

#### Feature 12.1: Stale Data Reliability
- **Story 12.1.1:** [Done] As an Investor, I want the system to aggressively sync NAV data if it is older than 3 days, so that my portfolio valuations remain accurate.
- **Story 12.1.2:** [Done] As an Investor, I want to see a visual warning (Critical Failure banner) if my NAV data is dangerously out of date, so that I don't make decisions on stale data.

#### Feature 12.2: Upload Transparency
- **Story 12.2.1:** [Done] As an Investor, I want to see exactly how many transactions were imported versus skipped in the success message, so I know my upload was processed accurately.

#### Feature 12.3: Bug Fixes & Stability (PR Review Responses)
- **Story 12.3.1:** [Done] As a System, I want the dashboard polling interval to be safe from infinite loops.
- **Story 12.3.2:** [Done] As a User, I expect the UI to remain stable when I resolve a PAN mismatch. 
- **Story 12.3.3:** [Done] As an application, I want all frontend API calls to use the configured API_BASE instead of hardcoded URIs.
- **Story 12.3.4:** [Done] As a Developer, I want Docker container booting to explicitly fail if cron fails.
- **Story 12.3.5:** [Done] As an Investor viewing Estimated Holdings, I want to be redirected correctly and shown "No Data" instead of a crash.
- **Story 12.3.6:** [Done] As a Developer, I want debug files to represent all transactions to verify CAS parsing correctly.

### Epic 13: Dashboard Drilldown Views (V1.3.2)

#### Feature 13.1: KPI Card Drilldowns
- **Story 13.1.1:** [Done] As a user, I want the titles of the KPI cards (Current Value, Invested Value, etc.) to be clickable links, so that I understand they lead to more detailed breakdowns.
- **Story 13.1.2:** [Done] As a user, when I click "Current Value", I want to see a dedicated view explaining exactly how my Current Value is calculated (Units × Latest NAV for each active scheme), so that the math is transparent.

### Epic 14: Per-Scheme XIRR (V1.3.2)

#### Feature 14.1: Individual Scheme Analytics
- **Story 14.1.1:** [Done] As an investor, I want to see the accurate XIRR for each individual scheme on the XIRR Drilldown page, so I can truly compare performance between funds.
- **Story 14.1.2:** [Done] As a System, I must NOT display XIRR for schemes held for less than 1 year (displaying Absolute Return instead) to prevent mathematical distortion.
- **Story 14.1.3:** [Done] As a System, I must accurately calculate XIRR for "Dead Funds" (0 balance) by terminating the calculation on the date of the final redemption, not today's date.
- **Story 14.1.4:** [Done] As a System, I must NOT display XIRR for "Estimated" schemes missing transaction history, as the mathematical result would be fictional.

### Epic 15: Scheme Details & Ledger (V1.4.0)

#### Feature 15.1: Scheme Navigation & Header
- **Story 15.1.1:** [Done] As a User, when I click on a Scheme Name anywhere in the application, I want to be routed to a dedicated `/scheme/[amfi_code]` page.
- **Story 15.1.2:** [Done] As a User, I want the header to display the Scheme Name, Fund House, Category, and isolated KPI metrics (Invested, Current, XIRR) just for this fund.

#### Feature 15.2: The Transaction Ledger
- **Story 15.2.1:** [Done] As an Auditor, I want to see a chronological table of all transactions for the scheme.
- **Story 15.2.2:** [Done] As an Auditor, I want the ledger to compute and display a running "Unit Balance" after every transaction, so I can see exactly how my units accumulated or depleted over time.

#### Feature 15.3: Dual-Source NAV Backfill (V1.4.1)
- **Story 15.3.1:** [Done] As a System, I must throttle strict 10-year historical backfills (`mfapi.in`) to only occur when a scheme has a massive data gap (>30 days) or is completely new to the DB, minimizing unnecessary 3,000-row fetches.
- **Story 15.3.2:** [Done] As a System, I must execute routine maintenance backfills (1 to 30 days gap) using the ultra-fast AMFI single-day portal (`DownloadNAVHistoryReport_Po.aspx?frmdt=`) to surgically fetch exact missing dates without downloading massive arrays.
- **Story 15.3.3:** [Done] As a System, I must eliminate slow N+1 Database `SELECT EXISTS` loops during inserts by leveraging SQLite's `UNIQUE` constraint and memory-slicing logic to achieve instant bulk UPSERTS.

#### Open Items (Parked for Future Architecture)
- **Feature 15.4: Cloud Sector & Holdings Integration:** Web scraping Morningstar is too fragile for the live app. A standalone "Cloud Registry" must be built offline to compile this data and serve it as static JSON for the app to consume.

### Epic 16: Transparency, Sync Orchestration & Debug Dumps (V1.3.3)

#### Feature 16.1: Sync Optimization
- **Story 16.1.1:** As a System, I want the background AMFI NAV Sync to use an internal caching mechanism (e.g. `nav_sync_last_run`) so that duplicate cron executions do not unnecessarily fetch and parse data within a 4-hour window.
- **Story 16.1.2:** As a User, when I click "Force Sync", I want the dashboard polling logic to gracefully update the UI the moment the server finishes so that I don't have to manually refresh the browser.

#### Feature 16.2: UX & Copy Improvements
- **Story 16.2.1:** As a prospect, when I first open the app with no users in the DB, the dropdown should read "Upload CAS to create user" rather than "No users found" to guide my next action.
- **Story 16.2.2:** As an Investor looking at XIRR, the disclaimer text must accurately assert that per-scheme calculations *are* now explicitly supported (Epic 14) removing legacy disclaimers about global calculations.

#### Feature 16.3: CAS Parser Tooling
- **Story 16.3.1:** As a Developer, I want to regain the ability to inspect raw CAS schemas. Whenever a user uploads a statement, the system must write the debug `cas_schema.json` and `cas_import.json` dumps safely into the local `data/` volume.

---

## Changelog
| Date | Changed by | What changed | Reason |
|---|---|---|---|
| 2026-02-18 | Agent | Initial V1.0 Creation | Project Kickoff |
| 2026-02-20 | new-gen-sa | Added Phase 3 (Multi-User, Navbar, PIN) | Feature Expansion |
| 2026-02-20 | Agent | Fixed analytics bugs (type mismatch, FIFO drain) | Bug Fixes |
| 2026-02-20 | Agent | Auto NAV sync via AMFI cron, 3-phase UX, Re-login UX | Feature Expansion (Reqs 2 & 3) |
| 2026-02-21 | new-gen-sa | V1.2 Enhancements: Direct Profile Creation, Latest NAV Date UI, Manual Sync Button & Bug Fix | End-User Feedback |
| 2026-02-20 | new-gen-sa | V1.3 Backlog: Epic 10 (Invested Value Accuracy UX), Epic 11 (10-Year NAV History — Parked) | Bug Report RCA + Feature Planning |
| 2026-02-21 | new-gen-sa | Implemented V1.3.1 Audit Fixes | Addressed stale data reporting, PR review bugs, hardcoded routes, and cron docker stability |
| 2026-02-21 | new-gen-sa | Implemented V1.3.2 Epics 13 & 14 | Built KPI drilldown pages and implemented per-scheme XIRR computation algorithm. |
| 2026-02-21 | new-gen-sa | Added Epic 15 (Scheme Details & Ledger) | Formally merged Epic 15 PRD into main PRD. |
| 2026-02-21 | new-gen-sa | Built V1.3.3 Enhancements | Implemented sync caching, fixed UI refresh race conditions, refined UX copy, and resolved CAS debug dumps natively. |
| 2026-02-21 | Agent | V1.3.4: Fixed CAS Dedup Bug | Implemented history-aware synthetic balance skipping and refined reconciliation date logic. |
| 2026-02-22 | Agent | V1.4.0: 10-Year NAV History | Implemented Feature 11.1 providing deep NAV backfills and interactive Recharts visualizations. |
| 2026-02-22 | Agent | V1.4.1: Dual-Source Router | Refactored backfill to dynamically route to AMFI vs mfapi.in, and hardened `NavHistory` with SQLite `UNIQUE` constraints and `INSERT OR IGNORE` bulk queries. |
| 2026-02-22 | Agent | V1.4.2: Backend Stability | Fixed `RequestsDependencyWarning` by pinning dependencies and resolved locale deprecation warnings in Docker/cron. |
| 2026-02-22 | Agent | V1.4.3: Modernization Release | Merged UI Modernization (Dark Mode/Theme Toggle), synchronized repo branches, and resolved CI/CD linting/formatting bottlenecks. |
