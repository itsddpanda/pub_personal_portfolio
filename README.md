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
| Backend | `ghcr.io/itsddpanda/private_fund_analyzer-backend:latest` |
| Frontend | `ghcr.io/itsddpanda/private_fund_analyzer-frontend:latest` |

The backend API is available at `http://localhost:8001/api`.  
API docs (Swagger UI) at `http://localhost:8001/docs`.

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
