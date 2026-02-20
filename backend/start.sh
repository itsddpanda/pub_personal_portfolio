#!/bin/bash

# Start cron service in background
if ! service cron start; then
    echo "Error: Failed to start cron service." >&2
    exit 1
fi

# Run the main uvicorn application
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
