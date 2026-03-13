# OpenClaw Redeploy Script for Windows (local testing)
# Usage: .\deploy.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 OpenClaw Redeploy Script (Windows)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running in correct directory
if (-not (Test-Path "st4cker_skill.py")) {
    Write-Host "❌ Error: Must run from openclaw directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Step 1: Building Docker image..." -ForegroundColor Yellow
docker build -t st4cker-openclaw:latest .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🛑 Step 2: Stopping old container..." -ForegroundColor Yellow
docker stop openclaw 2>$null
docker rm openclaw 2>$null

Write-Host ""
Write-Host "▶️ Step 3: Starting new container..." -ForegroundColor Yellow

# Load env from parent .env if exists
$envFile = "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "Env:$key" -Value $value
        }
    }
}

docker run -d `
    --name openclaw `
    -p 127.0.0.1:8001:8000 `
    -e TZ=Asia/Jakarta `
    -e ST4CKER_API_URL=$env:ST4CKER_API_URL `
    -e ST4CKER_API_KEY=$env:ST4CKER_API_KEY `
    -e OPENCLAW_API_KEY=$env:OPENCLAW_API_KEY `
    -e MOONSHOT_API_KEY=$env:MOONSHOT_API_KEY `
    st4cker-openclaw:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start container!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Step 4: Waiting for service to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "🧪 Step 5: Health check..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "http://localhost:8001/health" -ErrorAction SilentlyContinue

if ($health.status -eq "ok") {
    Write-Host "✅ OpenClaw is healthy!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Health check failed, checking logs..." -ForegroundColor Red
    docker logs openclaw --tail 20
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Redeploy complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Status:"
docker ps --filter "name=openclaw" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""
Write-Host "📝 Logs (last 10 lines):"
docker logs openclaw --tail 10 2>$null
Write-Host ""
Write-Host "💡 Quick commands:"
Write-Host "  - View logs: docker logs -f openclaw"
Write-Host "  - Restart: docker restart openclaw"
Write-Host "  - Stop: docker stop openclaw"
Write-Host ""
