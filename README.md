# Mutual Fund Analyzer (MFA)

A personal portfolio analyzer for Indian mutual funds. Upload your CAMS/KARVY Consolidated Account Statement (CAS) PDF and get instant portfolio analytics — XIRR, current value, fund-wise breakdown, and more.

---

## 🐳 Deploy with Pre-built Docker Images (Recommended)

No code checkout or build required. Just download and run.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) >= 24
- [Docker Compose](https://docs.docker.com/compose/) >= 2.20

### Steps

```bash
# 1. Download the production compose file
curl -LO https://github.com/itsddpanda/Private_fund_analyzer/releases/latest/download/docker-compose.prod.yml

# 2. Create a data directory for the database
mkdir -p data

# 3. Create the backend environment file
curl -LO https://raw.githubusercontent.com/itsddpanda/Private_fund_analyzer/PRODUCTION/backend/.env.example
mv .env.example .env
# Edit .env if needed (defaults work out of the box)

# 4. Pull and start the app
docker compose -f docker-compose.prod.yml up -d

# 5. Open the app
open http://localhost:3001
```

The backend API is available at `http://localhost:8001/api`.  
API docs (Swagger UI) at `http://localhost:8001/docs`.

### Docker Images

| Image | URL |
|-------|-----|
| Backend | `ghcr.io/itsddpanda/private_fund_analyzer-backend:latest` |
| Frontend | `ghcr.io/itsddpanda/private_fund_analyzer-frontend:latest` |

---

## 📦 Tech Stack

| Layer     | Technology          |
| --------- | ------------------- |
| Backend   | FastAPI + SQLite    |
| Frontend  | Next.js 14 (App Router) |
| Parsing   | casparser           |
| Container | Docker Compose      |

---

## 🚀 Build from Source (Docker Compose)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) >= 24
- [Docker Compose](https://docs.docker.com/compose/) >= 2.20

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/itsddpanda/Private_fund_analyzer.git && cd Private_fund_analyzer

# 2. Create backend environment file
cp backend/.env.example backend/.env

# 3. Create frontend environment file (optional overrides)
touch frontend/.env.local

# 4. Build and start both services
docker compose up --build

# 5. Open the app
open http://localhost:3001
```

---

## 🛠 Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable        | Default                             | Description                          |
| --------------- | ----------------------------------- | ------------------------------------ |
| `DATABASE_URL`  | `sqlite:///./mfa.db`                | SQLite database path                 |
| `CORS_ORIGINS`  | `http://localhost:3001,...`         | Comma-separated allowed origins      |

### Frontend (`frontend/.env.local`)

| Variable               | Default                        | Description              |
| ---------------------- | ------------------------------ | ------------------------ |
| `NEXT_PUBLIC_API_URL`  | *(via Next.js rewrite)*        | Backend API base URL     |

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
├── docker-compose.yml       # Build from source
├── docker-compose.prod.yml  # Deploy from pre-built images
└── data/                    # SQLite database (gitignored)
```

---

## 🏥 Health Check

```bash
curl http://localhost:8001/api/health
# {"status": "ok", "service": "mfa-backend"}
```
