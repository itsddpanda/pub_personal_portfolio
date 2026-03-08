#!/bin/bash

# Configuration
DEFAULT_BASE="main"

# --- Functions ---

github_workflow() {
    while true; do
        echo ""
        echo "=== GitHub Workflow ==="
        echo "1. Create PR into $DEFAULT_BASE (auto-filled from commits)"
        echo "2. Create PR into custom branch"
        echo "3. View PR status"
        echo "4. Push current branch (force-with-lease)"
        echo "5. Exit"
        read -p "Choose option [1-5]: " gopt
        case $gopt in
            1) gh pr create --base "$DEFAULT_BASE" --fill; break ;;
            2) 
                read -p "Enter base branch: " base_branch
                gh pr create --base "$base_branch" --fill
                break ;;
            3) gh pr status; break ;;
            4) git push origin $(git rev-parse --abbrev-ref HEAD) --force-with-lease; break ;;
            5) exit 0 ;;
            *) echo "Invalid option" ;;
        esac
    done
}

# --- Main Logic ---

echo "============================================="
echo " MFA GitHub Workflow Manager "
echo "============================================="
github_workflow
