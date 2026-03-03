# Mutual Fund Analyzer (MFA)

A personal portfolio analyzer for Indian mutual funds. Upload your CAMS/KARVY Consolidated Account Statement (CAS) PDF and get portfolio analytics (XIRR, current value, fund-wise breakdown, and enrichment insights).

## ⚡ Quick Setup

```bash
# One-liner (no repo clone needed)
curl -fsSL https://raw.githubusercontent.com/itsddpanda/Private_fund_analyzer/PRODUCTION/setup.sh | bash -s -- docker

# Or clone first
# git clone https://github.com/itsddpanda/Private_fund_analyzer.git
# cd Private_fund_analyzer
# chmod +x setup.sh && ./setup.sh
```

### Setup Modes

| Mode | Command | Behavior |
|------|---------|----------|
| `docker` | `./setup.sh docker` | Uses `docker-compose.prod.yml` and pulls pre-built images from GHCR. |
| `local` | `./setup.sh local` | Uses `docker-compose.yml` and builds backend/frontend from local source. |
| `dev` | `./setup.sh dev` | Runs backend + frontend directly on host without Docker. |

## 🚢 Deployment Compose Behavior

### `docker-compose.yml` (local source compose)

- Intended for local development and source-based validation.
- Builds images from local `backend/` and `frontend/` directories.
- Exposes backend directly on host (`localhost:8001`) and frontend on host (`localhost:3001`).

### `docker-compose.prod.yml` (production-style compose)

- Intended for deployment using pre-built GHCR images.
- **Does not expose backend to host**; backend is only reachable on the internal Docker network.
- Frontend is the only host-exposed service and performs internal API rewrites/proxying to backend.
- For production smoke checks, use frontend URL and API paths through frontend routing.

## 📦 Tech Stack

| Layer     | Technology |
| --------- | ---------- |
| Backend   | FastAPI + SQLModel + SQLite |
| Frontend  | Next.js 14 (App Router) |
| Parsing   | casparser |
| Container | Docker Compose |

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:////data/mfa.db` | SQLite database path (inside Docker volume) |
| `CORS_ORIGINS` | `http://localhost:3001,http://127.0.0.1:3001` | Comma-separated allowed origins |
| `FUND_DAAS_API_KEY` | `sk_test_123` | API key for fund enrichment provider |

## 🧭 Request Flow (Architecture)

```text
[Browser]
   |
   v
[Next.js Frontend]
   |  /api/* (rewrite/proxy)
   v
[FastAPI Backend]
   |-- CAS parsing + transaction normalization
   |-- NAV & scheme services
   |-- Enrichment cache check
   |      | cache hit -> return DB DTO
   |      | cache miss/expired/force -> call DaaS -> parse -> persist -> return DTO
   v
[SQLite + local data files]
```

## 🏥 Health Check

```bash
curl http://localhost:8001/api/health
# {"status": "ok", "service": "mfa-backend"}
```

## ⚙️ Operational Notes (Fund Intelligence)

- **Single mode**: `GET /api/scheme/{amfi_code}/enrichment`
  - Validates scheme ISIN before calling DaaS.
  - Returns `422` for invalid ISIN.
- **Bulk prefetch mode**: `POST /api/scheme/enrichment/prefetch`
  - Accepts `isins`, `batch_size`, and `throttle_seconds`.
  - Uses comma-separated ISIN batches.
  - Batch size max: 50.
