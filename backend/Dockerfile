FROM python:3.11-slim

WORKDIR /app

# Install cron
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Setup cron job to run every 12 hours
RUN echo "0 */12 * * * root /usr/local/bin/python /app/scripts/sync_amfi.py >> /var/log/cron.log 2>&1" > /etc/cron.d/sync_amfi_cron
RUN chmod 0644 /etc/cron.d/sync_amfi_cron
RUN crontab /etc/cron.d/sync_amfi_cron
RUN touch /var/log/cron.log

CMD ["/app/start.sh"]
