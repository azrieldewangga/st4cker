FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    httpx \
    pydantic

# Copy application
COPY st4cker_skill.py .
COPY nlu.py .
COPY message_gen.py .
COPY context.py .
COPY tools.py .
COPY attendance_nlu.py .
COPY course_manager_nlu.py .
COPY smart_reminder_client.py .

# Environment
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Jakarta

EXPOSE 8000

CMD ["python", "st4cker_skill.py"]
