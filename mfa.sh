#!/bin/bash

# Configuration
DEFAULT_BASE="main"

# --- Functions ---

sync_branches() {
    echo "Syncing branches with origin..."
    git fetch --all --prune
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "Updating current branch: $CURRENT_BRANCH"
    git pull origin "$CURRENT_BRANCH"
    echo "Pruning remote-tracking branches..."
    git remote prune origin
    echo "Done."
}

github_workflow() {
    while true; do
        echo ""
        echo "=== GitHub Workflow ==="
        echo "1. Create PR into $DEFAULT_BASE (auto-filled from commits)"
        echo "2. Create PR into custom branch"
        echo "3. View PR status"
        echo "4. Push current branch (force-with-lease)"
        echo "5. Sync branches from Origin"
        echo "6. Exit"
        read -p "Choose option [1-6]: " gopt
        case $gopt in
            1) gh pr create --base "$DEFAULT_BASE" --fill; break ;;
            2) 
                read -p "Enter base branch: " base_branch
                gh pr create --base "$base_branch" --fill
                break ;;
            3) gh pr status; break ;;
            4) git push origin $(git rev-parse --abbrev-ref HEAD) --force-with-lease; break ;;
            5) sync_branches; break ;;
            6) exit 0 ;;
            *) echo "Invalid option" ;;
        esac
    done
}

# --- Main Logic ---

echo "============================================="
echo " MFA GitHub Workflow Manager "
echo "============================================="
github_workflow
