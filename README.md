# Mutual Fund Analyzer (MFA)

A personal portfolio analyzer for Indian mutual funds. Upload your CAMS/KARVY Consolidated Account Statement (CAS) PDF and get instant portfolio analytics — XIRR, current value, fund-wise breakdown, and more.

---

## ⚡ Quick Setup

The easiest way to get started is via the setup script, which handles dependency checks, file creation, and service startup automatically:

```bash
# One-liner (no repo clone needed)
curl -fsSL https://raw.githubusercontent.com/itsddpanda/Private_fund_analyzer/PRODUCTION/setup.sh | bash -s -- docker

# Or clone first and run interactively
git clone https://github.com/itsddpanda/Private_fund_analyzer.git && cd Private_fund_analyzer
chmod +x setup.sh && ./setup.sh
```

**Modes available:**

| Mode | Command | Description |
|------|---------|-------------|
| `docker` | `./setup.sh docker` | Pull pre-built images from GHCR *(recommended)* |
| `local` | `./setup.sh local` | Build from source using Docker Compose |
| `dev` | `./setup.sh dev` | Local development — Python + Node, no Docker |

---

## 🐳 Docker Images

| Image | URL |
|-------|-----|
| Backend | `ghcr.io/itsddpanda/private_fund_analyzer-backend:vX.Y.Z` |
| Frontend | `ghcr.io/itsddpanda/private_fund_analyzer-frontend:vX.Y.Z` |

> Production recommendation: pin immutable image tags (`vX.Y.Z`) in `docker-compose.prod.yml` and use `latest` only when you intentionally want rolling updates.

For source/local mode (`./setup.sh local`), the backend API is available at `http://localhost:8001/api` and docs at `http://localhost:8001/docs`. In production compose mode (`./setup.sh docker`), backend is internal-only by default and frontend is exposed at `http://localhost:3001`.


### Rollback to a Previous Image Tag

If a newly deployed release has issues, switch both services to a prior immutable tag:

```bash
# Example rollback target
export BACKEND_IMAGE_TAG=v1.3.1
export FRONTEND_IMAGE_TAG=v1.3.1
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

You can also place `BACKEND_IMAGE_TAG` and `FRONTEND_IMAGE_TAG` in your shell environment, `.env`, or deployment system variables.

---

## 📦 Tech Stack

| Layer     | Technology          |
| --------- | ------------------- |
| Backend   | FastAPI + SQLite    |
| Frontend  | Next.js 14 (App Router) |
| Parsing   | casparser           |
| Container | Docker Compose      |

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable        | Default                             | Description                          |
| --------------- | ----------------------------------- | ------------------------------------ |
| `DATABASE_URL`  | `sqlite:////data/mfa.db`            | SQLite database path (inside Docker volume) |
| `CORS_ORIGINS`  | `http://localhost:3001,...`         | Comma-separated allowed origins      |

---

## 📁 Project Structure

```
mfa/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/             # Route handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # SQLModel ORM models
│   │   └── db/              # Database engine setup
│   ├── main.py              # App entrypoint
│   └── requirements.txt
├── frontend/                # Next.js application
│   └── src/
├── setup.sh                 # One-step setup script
├── docker-compose.yml       # Build from source
└── docker-compose.prod.yml  # Deploy from pre-built images
```

---

## 🏥 Health Check

```bash
curl http://localhost:8001/api/health
# {"status": "ok", "service": "mfa-backend"}
```

---

## ⚙️ Operational Notes (Fund Intelligence)

### Backend Startup Phases (container)

`backend/start.sh` runs in ordered phases with structured logs:

1. `preflight` — validates required binaries, files, and env vars.
2. `cron` — starts cron and prepares environment propagation.
3. `db_init` — creates tables and enables SQLite WAL mode.
4. `nav_sync` — runs initial NAV sync.
5. `map_generation` — regenerates ISIN→AMFI map from fresh data.
6. `app_boot` — starts uvicorn (`UVICORN_WORKERS`, default `2`).

If any phase fails, startup exits immediately with an actionable error message describing what to fix.

### Startup Troubleshooting

- Inspect recent backend logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs backend --tail 200
  ```
- Confirm required env vars are present (`DATABASE_URL`, `CORS_ORIGINS`).
- Verify image contents if preflight reports missing files/binaries.
- Reduce startup concurrency (if resource constrained):
  ```bash
  export UVICORN_WORKERS=1
  docker compose -f docker-compose.prod.yml up -d
  ```

The Fund Intelligence integration supports two request modes:


- **Single mode** (default user flow): `GET /api/scheme/{amfi_code}/enrichment`
  - Uses the scheme's ISIN and validates it before calling DaaS.
  - Invalid ISIN values return a clear `422` response.
- **Bulk prefetch mode** (internal warmup): `POST /api/scheme/enrichment/prefetch`
  - Accepts a JSON payload with `isins`, `batch_size`, and `throttle_seconds`.
  - Requests are sent as **comma-separated ISIN batches**.
  - Batch size is capped at **50 ISINs per request**.
  - Includes warmup throttling (`429` when too frequent/already running) and structured batch logs for observability.

Example payload:

```json
{
  "isins": ["INF200K01AB1", "INF090I01239"],
  "batch_size": 50,
  "throttle_seconds": 0.3
}
```
