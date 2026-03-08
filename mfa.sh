#!/bin/bash

# Configuration
DEFAULT_BASE="main"

# --- Functions ---

sync_branches() {
    PREV_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "Syncing with origin..."
    
    # 1. Switch to main and update
    git checkout "$DEFAULT_BASE"
    git fetch --all --prune
    git pull origin "$DEFAULT_BASE"
    
    # 2. Cleanup previous branch if not main
    if [ "$PREV_BRANCH" != "$DEFAULT_BASE" ]; then
        echo "Dropping local branch: $PREV_BRANCH"
        git branch -D "$PREV_BRANCH"
    fi
    
    echo "Pruning remote-tracking branches..."
    git remote prune origin
    
    # 3. Optional new branch creation
    echo ""
    read -p "Enter new branch name to start fresh (leave empty to stay on $DEFAULT_BASE): " new_branch
    if [ -n "$new_branch" ]; then
        git checkout -b "$new_branch"
        echo "Switched to new branch: $new_branch"
    else
        echo "Staying on $DEFAULT_BASE."
    fi
    
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
