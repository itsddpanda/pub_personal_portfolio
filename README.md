# Mutual Fund Analyzer (MFA)

A personal portfolio analyzer for Indian mutual funds. Upload your CAMS/KARVY Consolidated Account Statement (CAS) PDF and get instant portfolio analytics — XIRR, current value, fund-wise breakdown, and more.

---

## 📦 Tech Stack

| Layer     | Technology          |
| --------- | ------------------- |
| Backend   | FastAPI + SQLite    |
| Frontend  | Next.js 14 (App Router) |
| Parsing   | casparser           |
| Container | Docker Compose      |

---

## 🚀 Quick Start (Docker Compose)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) >= 24
- [Docker Compose](https://docs.docker.com/compose/) >= 2.20

### Steps

```bash
# 1. Clone the repo
git clone <repo-url> && cd mfa

# 2. Create backend environment file
cp backend/.env.example backend/.env
# Edit backend/.env if needed (defaults work for local Docker)

# 3. Create frontend environment file (optional overrides)
touch frontend/.env.local

# 4. Build and start both services
docker compose up --build

# 5. Open the app
open http://localhost:3000
```

The backend API is available at `http://localhost:8000/api`.  
API docs (Swagger UI) at `http://localhost:8000/docs`.

---

## 🛠 Local Development (without Docker)

### Backend

```bash
cd backend

# Create and activate virtual env
python -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env file
cp .env.example .env

# Run dev server
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable        | Default                             | Description                          |
| --------------- | ----------------------------------- | ------------------------------------ |
| `DATABASE_URL`  | `sqlite:///./mfa.db`                | SQLite database path                 |
| `CORS_ORIGINS`  | `http://localhost:3000,...`         | Comma-separated allowed origins      |

### Frontend (`frontend/.env.local`)

| Variable               | Default                        | Description              |
| ---------------------- | ------------------------------ | ------------------------ |
| `NEXT_PUBLIC_API_URL`  | *(via Next.js rewrite)*        | Backend API base URL     |

---

## 🧪 Running Tests

```bash
# From the repo root, with backend venv activated
cd backend && pip install -r requirements.txt
python -m pytest tests/ -v
```

---

## 📁 Project Structure

```
mfa/
├── backend/             # FastAPI application
│   ├── app/
│   │   ├── api/         # Route handlers
│   │   ├── services/    # Business logic (CAS parsing, analytics, NAV)
│   │   ├── models/      # SQLModel ORM models
│   │   └── db/          # Database engine setup
│   ├── tests/           # Unit tests
│   ├── main.py          # App entrypoint
│   └── requirements.txt
├── frontend/            # Next.js application
│   └── src/
├── docker-compose.yml   # Orchestration
└── data/                # SQLite database (gitignored)
```

---

## 🏥 Health Check

```bash
curl http://localhost:8000/api/health
# {"status": "ok", "service": "mfa-backend"}
```
