FROM python:3.11-slim

# Set locale for consistent behavior and to avoid deprecation warnings
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app

# Install cron and curl (for healthcheck) with --no-install-recommends to save ~69MB
RUN apt-get update && apt-get install --no-install-recommends -y cron curl sqlite3 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY /data/NAVAll.txt /data/NAVAll.txt
COPY start.sh /app

# Setup cron job to run every 12 hours
RUN echo "0 */12 * * * root . /etc/environment; /usr/local/bin/python /app/scripts/sync_amfi.py >> /var/log/cron.log 2>&1" > /etc/cron.d/sync_amfi_cron
RUN chmod 0644 /etc/cron.d/sync_amfi_cron
RUN touch /var/log/cron.log

RUN chmod +x /app/start.sh && sed -i 's/\r$//' /app/start.sh

CMD ["/app/start.sh"]
