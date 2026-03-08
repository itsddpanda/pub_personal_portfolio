#!/bin/bash

# Configuration
COMPOSE_FILE="docker-compose.yml"
DEFAULT_BASE="main"

# --- Functions ---

build_frontend() {
    echo "Building frontend..."
    cd ~/mfa/frontend && npm run build
    cd ..
}

docker_mgmt() {
    while true; do
        echo ""
        echo "=== Docker Management ==="
        echo "1. Down (keep data)"
        echo "2. Down (destroy volumes)"
        echo "3. Up -d --build (background)"
        echo "4. Rebuild All + Frontend (Option 6 equivalent)"
        echo "5. View Backend Logs"
        echo "6. Back to Main Menu"
        read -p "Choose option [1-6]: " dopt
        case $dopt in
            1) docker compose -f "$COMPOSE_FILE" down; break ;;
            2) docker compose -f "$COMPOSE_FILE" down -v; break ;;
            3) docker compose -f "$COMPOSE_FILE" up -d --build; break ;;
            4) 
                docker compose -f "$COMPOSE_FILE" down
                build_frontend
                docker compose -f "$COMPOSE_FILE" up -d --build
                break ;;
            5) docker compose -f "$COMPOSE_FILE" logs -f backend; break ;;
            6) return ;;
            *) echo "Invalid option" ;;
        esac
    done
}

github_workflow() {
    while true; do
        echo ""
        echo "=== GitHub Workflow ==="
        echo "1. Create PR into $DEFAULT_BASE (filled from commits)"
        echo "2. Create PR into custom branch"
        echo "3. View PR status"
        echo "4. Push current branch (force-with-lease)"
        echo "5. Back to Main Menu"
        read -p "Choose option [1-5]: " gopt
        case $gopt in
            1) gh pr create --base "$DEFAULT_BASE" --fill; break ;;
            2) 
                read -p "Enter base branch: " base_branch
                gh pr create --base "$base_branch" --fill
                break ;;
            3) gh pr status; break ;;
            4) git push origin $(git rev-parse --abbrev-ref HEAD) --force-with-lease; break ;;
            5) return ;;
            *) echo "Invalid option" ;;
        esac
    done
}

# --- Main Logic ---

while true; do
    echo "============================================="
    echo " MFA Consolidated Workflow Manager "
    echo "============================================="
    echo "1. Docker / Container Management"
    echo "2. GitHub / PR Workflow"
    echo "3. Check Backend Health"
    echo "4. Exit"
    echo "---------------------------------------------"
    read -p "Choose an option [1-4]: " option

    case $option in
        1) docker_mgmt ;;
        2) github_workflow ;;
        3) 
            echo "Checking backend health..."
            docker compose ps backend
            echo "Latest logs:"
            docker compose logs --tail 20 backend
            ;;
        4) echo "Exiting..."; exit 0 ;;
        *) echo "Invalid option. Please try again." ;;
    esac
done
