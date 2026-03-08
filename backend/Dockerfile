FROM python:3.11-slim

# Set locale for consistent behavior and to avoid deprecation warnings
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app

# Install dependencies including tzdata for timezone support
RUN apt-get update && apt-get install --no-install-recommends -y curl sqlite3 cron tzdata && rm -rf /var/lib/apt/lists/*


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# ensure config is explicitly included and identifiable
COPY config/ ./config/
# move fallback NAVdata
COPY /app/data/NAVAll.txt /data/

COPY start.sh /app
COPY crontab /app/crontab

RUN chmod +x /app/start.sh && sed -i 's/\r$//' /app/start.sh

CMD ["/app/start.sh"]
