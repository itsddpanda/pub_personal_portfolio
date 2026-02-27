#!/bin/bash

# Configuration
COMPOSE_FILE="docker-compose.test.yml"

build_frontend() {
    echo "Building frontend..."
    cd ~/mfa/frontend && npm run build
    cd ..
}

while true; do
    echo "============================================="
    echo " Docker Management for MFA (Test Environment) "
    echo "============================================="
    echo "1. Docker down (without data)"
    echo "2. Docker down (with data - destroys volumes)"
    echo "3. Option 1 + Recreate containers"
    echo "4. Option 2 + Recreate containers"
    echo "5. Start containers only (up -d --build)"
    echo "6. Option 1 + Build Frontend + Recreate containers"
    echo "7. Option 2 + Build Frontend + Recreate containers"
    echo "8. View backend container logs (tail -f)"
    echo "9. Exit"
    echo "---------------------------------------------"
    read -p "Choose an option [1-9]: " option

    case $option in
        1)
            echo "[Option 1] Bringing down docker containers (keeping data)..."
            docker compose -f "$COMPOSE_FILE" down
            break
            ;;
        2)
            echo "[Option 2] Bringing down docker containers and destroying volumes..."
            docker compose -f "$COMPOSE_FILE" down -v
            break
            ;;
        3)
            echo "[Option 3] Bringing down + Recreating containers..."
            echo "[Option 3] Bringing down containers..."
            docker compose -f "$COMPOSE_FILE" down
            echo "[Option 3] Recreating containers..."
            docker compose -f "$COMPOSE_FILE" up -d --build
            break
            ;;
        4)
            echo "[Option 4] Destroying volumes + Recreating containers..."
            echo "[Option 4] Destroying volumes..."
            docker compose -f "$COMPOSE_FILE" down -v
            echo "[Option 4] Recreating containers..."
            docker compose -f "$COMPOSE_FILE" up -d --build
            break
            ;;
        5)
            echo "[Option 5] Starting docker containers..."
            docker compose -f "$COMPOSE_FILE" up -d --build
            break
            ;;
        6)
            echo "[Option 6] Down + Build Frontend + Recreate..."
            echo "[Option 6] Bringing down containers..."
            docker compose -f "$COMPOSE_FILE" down
            echo "[Option 6] Building frontend..."
            build_frontend
            echo "[Option 6] Recreating containers..."
            docker compose -f "$COMPOSE_FILE" up -d --build
            break
            ;;
        7)
            echo "[Option 7] Down (destroy data) + Build Frontend + Recreate..."
            echo "[Option 7] Destroying volumes..."
            docker compose -f "$COMPOSE_FILE" down -v
            echo "[Option 7] Building frontend..."
            build_frontend
            echo "[Option 7] Recreating containers..."
            docker compose -f "$COMPOSE_FILE" up -d --build
            break
            ;;
        8)
            echo "[Option 8] Viewing backend container logs..."
            docker compose -f "$COMPOSE_FILE" logs -f backend
            break
            ;;
        9)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            ;;
    esac
done
