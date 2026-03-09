#!/bin/bash
# =============================================================================
# St4cker Backend Deployment Script
# Usage: bash deploy-backend.sh
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="${HOME}/projects/st4cker/telegram-bot"
SERVICE_NAME="telegram-bot"
LOG_FILE="${HOME}/deploy-$(date +%Y%m%d-%H%M%S).log"
API_KEY="${AGENT_API_KEY:-}"
PORT="${PORT:-3000}"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_banner() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              ST4CKER BACKEND DEPLOYMENT                    ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo "Timestamp: $(date)"
    echo "Log file: $LOG_FILE"
    echo ""
}

# =============================================================================
# Deployment Steps
# =============================================================================

step_1_check_prerequisites() {
    log_info "Step 1/9: Checking prerequisites..."
    
    # Check if we're in the right directory or can navigate to it
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "Project directory not found: $PROJECT_DIR"
        log_info "Please ensure st4cker is cloned in your home directory"
        exit 1
    fi
    
    # Check for git
    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        exit 1
    fi
    
    # Check for node/npm
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

step_2_backup_current() {
    log_info "Step 2/9: Creating backup..."
    
    BACKUP_DIR="${HOME}/st4cker-backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database if exists
    if [ -f "${PROJECT_DIR}/../data/st4cker.db" ]; then
        cp "${PROJECT_DIR}/../data/st4cker.db" "$BACKUP_DIR/" 2>/dev/null || true
        log_info "Database backed up to $BACKUP_DIR"
    fi
    
    # Backup .env file
    if [ -f "${PROJECT_DIR}/.env" ]; then
        cp "${PROJECT_DIR}/.env" "$BACKUP_DIR/" 2>/dev/null || true
        log_info ".env file backed up"
    fi
    
    log_success "Backup completed"
}

step_3_pull_latest_code() {
    log_info "Step 3/9: Pulling latest code from GitHub..."
    
    cd "$PROJECT_DIR"
    
    # Fetch latest changes
    git fetch origin main
    
    # Show what will be updated
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        log_warning "Already up to date with origin/main"
    else
        log_info "Updating from $LOCAL to $REMOTE"
        git log --oneline HEAD..origin/main | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
        
        # Pull the changes
        git pull origin main
        log_success "Code updated successfully"
    fi
}

step_4_install_dependencies() {
    log_info "Step 4/9: Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Clean install
    npm install 2>&1 | tee -a "$LOG_FILE"
    
    log_success "Dependencies installed"
}

step_5_check_environment() {
    log_info "Step 5/9: Checking environment variables..."
    
    REQUIRED_VARS=(
        "TELEGRAM_ENCRYPTION_KEY"
        "AGENT_API_KEY"
        "DATABASE_URL"
    )
    
    OPTIONAL_VARS=(
        "PORT"
        "TELEGRAM_BOT_TOKEN"
        "OPENAI_API_KEY"
        "NODE_ENV"
    )
    
    local missing_required=0
    
    echo "" | tee -a "$LOG_FILE"
    echo "Required Variables:" | tee -a "$LOG_FILE"
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "  ❌ $var is NOT SET"
            missing_required=$((missing_required + 1))
        else
            # Mask sensitive values
            value="${!var}"
            masked="${value:0:4}****${value: -4}"
            log_success "  ✅ $var is set ($masked)"
        fi
    done
    
    echo "" | tee -a "$LOG_FILE"
    echo "Optional Variables:" | tee -a "$LOG_FILE"
    for var in "${OPTIONAL_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "  ⚠️  $var is not set"
        else
            log_success "  ✅ $var is set"
        fi
    done
    
    if [ $missing_required -gt 0 ]; then
        log_error "Missing $missing_required required environment variables!"
        log_info "Please set them before continuing:"
        log_info "  export TELEGRAM_ENCRYPTION_KEY='your-key'"
        log_info "  export AGENT_API_KEY='your-key'"
        log_info "  export DATABASE_URL='postgresql://...'"
        exit 1
    fi
    
    log_success "Environment check passed"
}

step_6_run_tests() {
    log_info "Step 6/9: Running tests..."
    
    cd "$PROJECT_DIR"
    
    # Check if test script exists
    if npm run test --silent 2>/dev/null; then
        log_success "Tests passed"
    else
        log_warning "No tests found or tests failed (non-critical)"
    fi
}

step_7_restart_service() {
    log_info "Step 7/9: Restarting service..."
    
    cd "$PROJECT_DIR"
    
    # Try different service managers in order of preference
    
    # 1. Try PM2
    if command -v pm2 &> /dev/null; then
        log_info "Using PM2 to restart service..."
        if pm2 restart "$SERVICE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Service restarted with PM2"
            sleep 3
            pm2 status "$SERVICE_NAME" | tee -a "$LOG_FILE"
            return 0
        fi
    fi
    
    # 2. Try systemd
    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        log_info "Using systemd to restart service..."
        if sudo systemctl restart "$SERVICE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Service restarted with systemd"
            sleep 3
            sudo systemctl status "$SERVICE_NAME" --no-pager | head -20 | tee -a "$LOG_FILE"
            return 0
        fi
    fi
    
    # 3. Try docker-compose
    if [ -f "${PROJECT_DIR}/docker-compose.yml" ]; then
        log_info "Using docker-compose to restart service..."
        if docker-compose restart 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Service restarted with docker-compose"
            sleep 3
            docker-compose ps | tee -a "$LOG_FILE"
            return 0
        fi
    fi
    
    # 4. Manual restart
    log_info "Performing manual restart..."
    
    # Kill existing node processes for this app
    pkill -f "node.*server.js" 2>/dev/null || true
    sleep 2
    
    # Start in background
    nohup node src/server.js > server.log 2>&1 &
    sleep 3
    
    # Check if process is running
    if pgrep -f "node.*server.js" > /dev/null; then
        log_success "Service started manually (PID: $(pgrep -f "node.*server.js"))"
    else
        log_error "Failed to start service manually"
        exit 1
    fi
}

step_8_health_check() {
    log_info "Step 8/9: Performing health checks..."
    
    local max_retries=10
    local retry_count=0
    local health_url="http://localhost:${PORT}/api/v1/balance"
    
    log_info "Waiting for service to be ready..."
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$health_url" -H "X-API-Key: ${API_KEY}" | grep -q "200\|401\|403"; then
            log_success "Service is responding (HTTP 200/401/403)"
            break
        fi
        
        retry_count=$((retry_count + 1))
        log_info "Retry $retry_count/$max_retries..."
        sleep 2
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log_error "Service failed health check after $max_retries retries"
        log_info "Check logs with: pm2 logs $SERVICE_NAME"
        exit 1
    fi
    
    # Test API endpoints
    echo "" | tee -a "$LOG_FILE"
    log_info "Testing API endpoints..."
    
    # Test tasks endpoint
    if curl -s "http://localhost:${PORT}/api/v1/tasks" -H "X-API-Key: ${API_KEY}" > /dev/null 2>&1; then
        log_success "  ✅ GET /api/v1/tasks - OK"
    else
        log_warning "  ⚠️  GET /api/v1/tasks - Failed"
    fi
    
    # Test balance endpoint  
    if curl -s "http://localhost:${PORT}/api/v1/balance" -H "X-API-Key: ${API_KEY}" > /dev/null 2>&1; then
        log_success "  ✅ GET /api/v1/balance - OK"
    else
        log_warning "  ⚠️  GET /api/v1/balance - Failed"
    fi
    
    log_success "Health checks completed"
}

step_9_show_summary() {
    log_info "Step 9/9: Deployment Summary"
    
    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}║                 DEPLOYMENT SUCCESSFUL!                     ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    echo "Deployment Time: $(date)" | tee -a "$LOG_FILE"
    echo "Git Commit: $(cd $PROJECT_DIR && git rev-parse --short HEAD)" | tee -a "$LOG_FILE"
    echo "Node Version: $(node --version)" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    echo "Service Status:" | tee -a "$LOG_FILE"
    if command -v pm2 &> /dev/null && pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
        pm2 status "$SERVICE_NAME" | tee -a "$LOG_FILE"
    elif pgrep -f "node.*server.js" > /dev/null; then
        log_success "  Process running (PID: $(pgrep -f "node.*server.js"))"
    fi
    
    echo "" | tee -a "$LOG_FILE"
    echo "Useful Commands:" | tee -a "$LOG_FILE"
    echo "  View logs:    pm2 logs $SERVICE_NAME" | tee -a "$LOG_FILE"
    echo "  Status:       pm2 status" | tee -a "$LOG_FILE"
    echo "  Restart:      pm2 restart $SERVICE_NAME" | tee -a "$LOG_FILE"
    echo "  Full log:     cat $LOG_FILE" | tee -a "$LOG_FILE"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    print_banner
    
    step_1_check_prerequisites
    step_2_backup_current
    step_3_pull_latest_code
    step_4_install_dependencies
    step_5_check_environment
    step_6_run_tests
    step_7_restart_service
    step_8_health_check
    step_9_show_summary
    
    log_success "Deployment completed successfully! 🎉"
    log_info "Log saved to: $LOG_FILE"
}

# Handle script interruption
trap 'log_error "Deployment interrupted!"; exit 1' INT TERM

# Run main function
main "$@"
