#!/bin/bash

# Start cron service in background
if ! service cron start; then
    echo "Error: Failed to start cron service." >&2
    exit 1
fi

# Init DB
echo "Initializing database..."
python -c "from app.db.engine import create_db_and_tables; create_db_and_tables()"
sqlite3 data/mfa.db "PRAGMA journal_mode=WAL;"

# Run the main uvicorn application
exec uvicorn main:app --host 0.0.0.0 --port 8001 --workers 2
