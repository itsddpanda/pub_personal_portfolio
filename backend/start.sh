#!/bin/bash

# Start cron service in background
if ! service cron start; then
    echo "Error: Failed to start cron service." >&2
    exit 1
fi

# Export environment variables for cron
printenv | grep -v "no_proxy" >> /etc/environment

# Init DB
echo "Initializing database..."
python -c "from app.db.engine import create_db_and_tables; create_db_and_tables()"
sqlite3 /data/mfa.db "PRAGMA journal_mode=WAL;"

# Run initial sync on startup so data is fresh
echo "Running initial NAV sync..."
/usr/local/bin/python /app/scripts/sync_amfi.py

# Run the main uvicorn application
exec uvicorn main:app --host 0.0.0.0 --port 8001 --workers 2

