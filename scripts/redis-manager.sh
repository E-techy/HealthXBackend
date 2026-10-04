#!/usr/bin/env bash

# ==============================================================================
# HealthX Emergency Services - Redis Manager for Apple Silicon (Mac M1/M2/M3)
# ==============================================================================
# Description:
#   Manages Redis instance lifecycle on macOS ARM64 architecture.
#   Uses Homebrew under /opt/homebrew with graceful fallback to native daemon.
#
# Supported Commands:
#   ./scripts/redis-manager.sh install  -> Verifies Homebrew & installs Redis ARM64
#   ./scripts/redis-manager.sh start    -> Boots Redis in background on port 6379
#   ./scripts/redis-manager.sh stop     -> Gracefully stops Redis (pauses instance)
#   ./scripts/redis-manager.sh status   -> Checks process state & issues PING
#   ./scripts/redis-manager.sh kill     -> Force terminates any running Redis PID
#   ./scripts/redis-manager.sh url      -> Prints the connection string for .env
# ==============================================================================

set -e

REDIS_PORT=6379
REDIS_HOST="127.0.0.1"

# ANSI color codes for readable debugging
COLOR_INFO="\033[1;34m"    # Blue
COLOR_STEP="\033[1;33m"    # Yellow
COLOR_SUCCESS="\033[1;32m" # Green
COLOR_ERROR="\033[1;31m"   # Red
COLOR_RESET="\033[0m"

log_info() {
    echo -e "${COLOR_INFO}[INFO]${COLOR_RESET} $1"
}

log_step() {
    echo -e "${COLOR_STEP}[STEP]${COLOR_RESET} $1"
}

log_success() {
    echo -e "${COLOR_SUCCESS}[SUCCESS]${COLOR_RESET} $1"
}

log_error() {
    echo -e "${COLOR_ERROR}[ERROR]${COLOR_RESET} $1"
}

# ------------------------------------------------------------------------------
# Helper: Verify Apple Silicon Environment
# ------------------------------------------------------------------------------
check_environment() {
    log_step "Verifying system architecture..."
    ARCH=$(uname -m)
    if [ "$ARCH" != "arm64" ]; then
        log_info "Running on architecture: $ARCH (Script will still run, but optimized for arm64)"
    else
        log_success "Apple Silicon (ARM64) architecture detected."
    fi

    # Check for Homebrew installation under /opt/homebrew (Apple Silicon standard)
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    if ! command -v brew &> /dev/null; then
        log_error "Homebrew is not installed or not in PATH."
        echo "Please install Homebrew first by running:"
        echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        exit 1
    fi
}

# ------------------------------------------------------------------------------
# Action: Install Redis
# ------------------------------------------------------------------------------
do_install() {
    check_environment

    log_step "Checking if Redis is already installed..."
    if command -v redis-server &> /dev/null; then
        REDIS_VER=$(redis-server --version)
        log_success "Redis is already installed: $REDIS_VER"
        exit 0
    fi

    log_step "Updating Homebrew formula list..."
    brew update

    log_step "Installing Redis via Homebrew (Apple Silicon ARM64 bottle)..."
    brew install redis

    log_success "Redis installation complete."
    do_status
}

# ------------------------------------------------------------------------------
# Action: Start Redis
# ------------------------------------------------------------------------------
do_start() {
    check_environment

    log_step "Checking if Redis is already running on port ${REDIS_PORT}..."
    RUNNING_PID=$(lsof -ti :${REDIS_PORT} || true)

    if [ -n "$RUNNING_PID" ]; then
        log_info "Redis is already active on port ${REDIS_PORT} (PID: ${RUNNING_PID})."
        do_status
        return
    fi

    log_step "Starting Redis service via Homebrew..."
    brew services start redis

    log_step "Waiting for Redis to bind to port ${REDIS_PORT}..."
    sleep 2

    # Verify if port is active
    RUNNING_PID=$(lsof -ti :${REDIS_PORT} || true)
    if [ -z "$RUNNING_PID" ]; then
        log_info "Homebrew service didn't bind port immediately. Falling back to background daemon..."
        redis-server --daemonize yes --port ${REDIS_PORT}
        sleep 1
    fi

    do_status
}

# ------------------------------------------------------------------------------
# Action: Stop Redis (Graceful Pause)
# ------------------------------------------------------------------------------
do_stop() {
    check_environment

    log_step "Stopping Redis instance gracefully..."

    # Try shutting down cleanly via redis-cli if responsive
    if command -v redis-cli &> /dev/null; then
        log_step "Sending SHUTDOWN signal via redis-cli..."
        redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} shutdown nosave 2>/dev/null || true
    fi

    # Stop homebrew service wrapper
    log_step "Stopping Homebrew background service..."
    brew services stop redis 2>/dev/null || true

    sleep 1

    # Check if port is freed
    REMAINING_PID=$(lsof -ti :${REDIS_PORT} || true)
    if [ -n "$REMAINING_PID" ]; then
        log_info "Process still held by PID: ${REMAINING_PID}. Terminating process..."
        kill -15 "${REMAINING_PID}" 2>/dev/null || true
    fi

    log_success "Redis stopped successfully."
}

# ------------------------------------------------------------------------------
# Action: Force Kill Redis
# ------------------------------------------------------------------------------
do_kill() {
    log_step "Looking for any active Redis processes..."

    # Find processes listening on port 6379 or named redis-server
    PIDS=$(pgrep redis-server || true)
    PORT_PID=$(lsof -ti :${REDIS_PORT} || true)
    ALL_PIDS=$(echo "${PIDS} ${PORT_PID}" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

    if [ -z "$ALL_PIDS" ]; then
        log_info "No active Redis processes found."
        return
    fi

    for PID in $ALL_PIDS; do
        log_step "Force killing PID: ${PID} (SIGKILL -9)..."
        kill -9 "${PID}" 2>/dev/null || true
    done

    # Cleanup Homebrew state metadata
    if command -v brew &> /dev/null; then
        brew services stop redis 2>/dev/null || true
    fi

    log_success "All Redis processes killed."
}

# ------------------------------------------------------------------------------
# Action: Check Status & Ping
# ------------------------------------------------------------------------------
do_status() {
    log_step "Inspecting Redis status on ${REDIS_HOST}:${REDIS_PORT}..."

    PID=$(lsof -ti :${REDIS_PORT} || true)

    if [ -n "$PID" ]; then
        log_info "Process is active (PID: ${PID})."

        if command -v redis-cli &> /dev/null; then
            log_step "Sending PING command..."
            PONG=$(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping 2>/dev/null || true)
            if [ "$PONG" == "PONG" ]; then
                log_success "Ping Response: PONG. Redis is healthy."
            else
                log_error "Port is occupied, but Redis did not respond with PONG."
            fi
        fi
    else
        log_info "Redis is currently NOT running (Port ${REDIS_PORT} is free)."
    fi
}

# ------------------------------------------------------------------------------
# Action: Print .env URL
# ------------------------------------------------------------------------------
do_url() {
    echo ""
    echo "=========================================="
    echo "REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}"
    echo "=========================================="
    echo ""
}

# ------------------------------------------------------------------------------
# Command Router
# ------------------------------------------------------------------------------
case "$1" in
    install)
        do_install
        ;;
    start)
        do_start
        do_url
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_stop
        sleep 1
        do_start
        ;;
    kill)
        do_kill
        ;;
    status)
        do_status
        ;;
    url)
        do_url
        ;;
    *)
        echo "Usage: $0 {install|start|stop|restart|kill|status|url}"
        echo ""
        echo "Examples:"
        echo "  $0 install   # Installs Redis on Mac M1 using Homebrew"
        echo "  $0 start     # Starts Redis and checks connectivity"
        echo "  $0 stop      # Gracefully shuts down Redis"
        echo "  $0 kill      # Force kills any hanging Redis process"
        echo "  $0 status    # Checks if Redis is live and responding to PING"
        exit 1
        ;;
esac
