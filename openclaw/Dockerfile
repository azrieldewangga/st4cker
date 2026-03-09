FROM python:3.11-slim

# Install Chromium dependencies (minimal set)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    curl \
    gnupg \
    git \
    gcc \
    libpq-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy OpenClaw from local
COPY openclaw-node /usr/local/lib/node_modules/openclaw
COPY openclaw-bin /usr/local/bin/openclaw
RUN chmod +x /usr/local/bin/openclaw

# Verify OpenClaw
RUN openclaw --version

# Copy all Python files
COPY st4cker_skill.py .
COPY nlu.py .
COPY llm_nlu.py .
COPY ai_responder.py .
COPY context.py .
COPY memory.py .
COPY message_gen.py .
COPY tools.py .
COPY attendance_nlu.py .
COPY course_manager_nlu.py .
COPY smart_reminder_client.py .
COPY smart_reminder_subagent.py .
COPY reminder_scheduler.py .
COPY reminder_integration.py .
COPY course_mapping.py .

# Create data directory
RUN mkdir -p /app/data

# Create openclaw config directory
RUN mkdir -p /root/.config/openclaw

# Expose port
EXPOSE 8000

# Run the server
CMD ["uvicorn", "st4cker_skill:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
