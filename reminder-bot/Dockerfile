FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Kita pakai script sederhana untuk jalanin dua proses
CMD python heartbeat.py & python messenger.py
