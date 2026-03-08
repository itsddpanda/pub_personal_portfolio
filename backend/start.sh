#!/bin/bash

# Filter out locale variables for /etc/environment and use /etc/default/locale instead
printenv | grep -v "no_proxy" | grep -vE "^(LANG|LC_|LANGUAGE)" >> /etc/environment
echo "LANG=C.UTF-8" > /etc/default/locale
echo "LC_ALL=C.UTF-8" >> /etc/default/locale

# Init DB
echo "Initializing database..."
python -c "from app.db.engine import create_db_and_tables; create_db_and_tables()"
sqlite3 /data/mfa.db "PRAGMA journal_mode=WAL;"

# Run initial sync on startup so data is fresh
echo "Running initial NAV sync..."
/usr/local/bin/python /app/scripts/sync_amfi.py

# Generate ISIN -> AMFI code map from the freshly downloaded NAVAll.txt
echo "Startup -> Generating ISIN map..."
/usr/local/bin/python -c "from app.utils.master_data import generate_isin_map; generate_isin_map()"

# Install crontab and start cron daemon for scheduled jobs
crontab /app/crontab
cron

# Run the main uvicorn application
exec uvicorn main:app --host 0.0.0.0 --port 8001 --workers 2

