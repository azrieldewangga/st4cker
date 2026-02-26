FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY st4cker_skill.py .
COPY nlu.py .
COPY llm_nlu.py .
COPY ai_responder.py .
COPY memory.py .
COPY message_gen.py .
COPY context.py .
COPY tools.py .
COPY attendance_nlu.py .
COPY course_manager_nlu.py .
COPY smart_reminder_client.py .

# Create data directory for memory
RUN mkdir -p /app/data

# Environment
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Jakarta

EXPOSE 8000

CMD ["uvicorn", "st4cker_skill:app", "--host", "0.0.0.0", "--port", "8000"]
