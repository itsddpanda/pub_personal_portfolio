#!/bin/bash

# Start cron service in background
service cron start

# Run the main uvicorn application
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
