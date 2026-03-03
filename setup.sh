#!/usr/bin/env bash
# =============================================================================
# Mutual Fund Analyzer — Setup Script
# Usage:
#   ./setup.sh          → Interactive mode (prompts for docker or local)
#   ./setup.sh docker   → Deploy using pre-built Docker images (recommended)
#   ./setup.sh local    → Build and run from source using Docker Compose
#   ./setup.sh dev      → Local development (no Docker)
# =============================================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

REPO_BASE="https://github.com/itsddpanda/Private_fund_analyzer"
RAW_BASE="https://raw.githubusercontent.com/itsddpanda/Private_fund_analyzer/PRODUCTION"

# =============================================================================
# Version Checks
# =============================================================================
check_docker() {
  if ! command -v docker &>/dev/null; then
    error "Docker not found. Install from https://docs.docker.com/get-docker/"
  fi
  DOCKER_VER=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0")
  DOCKER_MAJOR=$(echo "$DOCKER_VER" | cut -d. -f1)
  if [ "$DOCKER_MAJOR" -lt 24 ]; then
    warn "Docker $DOCKER_VER found but >= 24 is recommended."
  else
    success "Docker $DOCKER_VER"
  fi

  if ! docker compose version &>/dev/null; then
    error "Docker Compose plugin not found. Install from https://docs.docker.com/compose/"
  fi
  COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "0")
  success "Docker Compose $COMPOSE_VER"
}

check_python() {
  if ! command -v python3 &>/dev/null; then
    error "Python 3.9+ is required. Install from https://www.python.org/"
  fi
  PY_VER=$(python3 -c 'import sys; print(".".join(map(str,sys.version_info[:2])))')
  PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
  PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
  if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 9 ]; }; then
    error "Python $PY_VER found but 3.9+ required."
  fi
  success "Python $PY_VER"
}

check_node() {
  if ! command -v node &>/dev/null; then
    error "Node.js 18+ is required. Install from https://nodejs.org/"
  fi
  NODE_VER=$(node --version | tr -d 'v')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    error "Node.js $NODE_VER found but 18+ required."
  fi
  success "Node.js $NODE_VER"
}

# =============================================================================
# Setup: Backend .env
# =============================================================================
setup_backend_env() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    info "Creating $env_file from example..."
    if [ -f "backend/.env.example" ]; then
      cp backend/.env.example "$env_file"
    else
      curl -fsSL "$RAW_BASE/backend/.env.example" -o "$env_file"
    fi
    success "Created $env_file (review and edit if needed)"
  else
    success "$env_file already exists — skipping"
  fi
}

# =============================================================================
# Mode: Docker (pre-built images from GHCR)
# =============================================================================
mode_docker() {
  echo ""
  info "=== Mode: Deploy with Pre-built Docker Images ==="
  check_docker

  # Download docker-compose.prod.yml if not present
  if [ ! -f "docker-compose.prod.yml" ]; then
    info "Downloading docker-compose.prod.yml..."
    curl -fsSL "$REPO_BASE/releases/latest/download/docker-compose.prod.yml" -o docker-compose.prod.yml
    success "Downloaded docker-compose.prod.yml"
  else
    success "docker-compose.prod.yml already exists"
  fi

  setup_backend_env ".env"

  info "Pulling configured images and starting services..."
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d

  local frontend_url="http://localhost:3001"
  info "Running post-start frontend check at ${frontend_url} ..."
  if curl -fsS --max-time 10 "$frontend_url" >/dev/null; then
    success "Frontend is reachable at ${frontend_url}"
  else
    warn "Frontend check failed at ${frontend_url}."
    warn "Hints: run 'docker compose -f docker-compose.prod.yml ps' and 'docker compose -f docker-compose.prod.yml logs frontend --tail 100'."
    warn "If running remotely, verify port 3001 firewall/security-group access and reverse-proxy rules."
  fi

  echo ""
  success "MFA production stack is running!"
  echo -e "  Frontend: ${GREEN}${frontend_url}${NC}"
  echo -e "  Note: backend API is internal-only in docker-compose.prod.yml unless you explicitly add a backend ports mapping."
}

# =============================================================================
# Mode: Local (build from source using Docker Compose)
# =============================================================================
mode_local() {
  echo ""
  info "=== Mode: Build from Source (Docker Compose) ==="
  check_docker

  # Clone if we're not already inside the repo
  if [ ! -f "docker-compose.yml" ]; then
    info "Cloning repository..."
    git clone "$REPO_BASE.git" mfa
    cd mfa
  fi

  setup_backend_env "backend/.env"
  mkdir -p data

  info "Building and starting services (this may take a few minutes)..."
  docker compose up --build -d

  echo ""
  success "MFA is running!"
  echo -e "  Frontend: ${GREEN}http://localhost:3001${NC}"
  echo -e "  API docs: ${GREEN}http://localhost:8001/docs${NC}"
}

# =============================================================================
# Mode: Dev (no Docker — direct Python + Node)
# =============================================================================
mode_dev() {
  echo ""
  info "=== Mode: Local Development (no Docker) ==="
  check_python
  check_node

  setup_backend_env "backend/.env"

  # Backend venv
  if [ ! -d "backend/.venv" ]; then
    info "Creating Python virtual environment..."
    python3 -m venv backend/.venv
  fi
  info "Installing backend dependencies..."
  backend/.venv/bin/pip install -q --upgrade pip
  backend/.venv/bin/pip install -q -r backend/requirements.txt
  success "Backend dependencies installed"

  # Frontend
  info "Installing frontend dependencies..."
  (cd frontend && npm ci --silent)
  success "Frontend dependencies installed"

  echo ""
  success "Dev environment ready!"
  echo ""
  echo "  Start backend:"
  echo "    cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8001"
  echo ""
  echo "  Start frontend (new terminal):"
  echo "    cd frontend && npm run dev"
}

# =============================================================================
# Interactive / Entrypoint
# =============================================================================
MODE="${1:-}"

if [ -z "$MODE" ]; then
  echo ""
  echo -e "${BLUE}Mutual Fund Analyzer — Setup${NC}"
  echo "------------------------------"
  echo "  1) docker  — Deploy using pre-built images (recommended, no build needed)"
  echo "  2) local   — Build from source using Docker Compose"
  echo "  3) dev     — Local development (Python + Node, no Docker)"
  echo ""
  read -rp "Choose setup mode [1/2/3]: " CHOICE
  case "$CHOICE" in
    1|docker) MODE="docker" ;;
    2|local)  MODE="local"  ;;
    3|dev)    MODE="dev"    ;;
    *) error "Invalid choice. Run with: ./setup.sh [docker|local|dev]" ;;
  esac
fi

case "$MODE" in
  docker) mode_docker ;;
  local)  mode_local  ;;
  dev)    mode_dev    ;;
  *) error "Unknown mode '$MODE'. Use: docker | local | dev" ;;
esac
