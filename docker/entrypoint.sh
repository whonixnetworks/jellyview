#!/bin/bash
set -e

# Function to handle signals
cleanup() {
    echo "Received shutdown signal, stopping services..."
    if [ -n "$uvicorn_pid" ]; then
        kill -TERM "$uvicorn_pid" 2>/dev/null || true
        wait "$uvicorn_pid" 2>/dev/null || true
    fi
    nginx -s stop 2>/dev/null || true
    echo "Services stopped."
    exit 0
}

# Set signal handlers
trap cleanup SIGTERM SIGINT

# Print environment information
echo "=========================================="
echo "Starting JellyView"
echo "=========================================="
echo "Data directory: ${DATA_DIR:-/app/data}"
echo "Jellyfin URL: ${JELLYFIN_URL:-http://localhost:8096}"
echo "Timezone: ${TZ:-UTC}"
echo "Log level: ${LOG_LEVEL:-INFO}"
echo "=========================================="

# Ensure data directory exists
mkdir -p "${DATA_DIR:-/app/data}"

# Set timezone if specified
if [ -n "$TZ" ]; then
    echo "Setting timezone to $TZ"
    ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime
    echo "$TZ" > /etc/timezone
fi

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Start nginx in background
echo "Starting nginx..."
nginx -g "daemon off;" &
nginx_pid=$!

# Wait for nginx to be ready
echo "Waiting for nginx to start..."
sleep 2

# Check if nginx started successfully
if ! kill -0 "$nginx_pid" 2>/dev/null; then
    echo "ERROR: Failed to start nginx"
    exit 1
fi

echo "Nginx started (PID: $nginx_pid)"

# Start uvicorn
echo "Starting uvicorn..."
cd /app/backend

# Build uvicorn command
UVICORN_CMD="uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level $(echo ${LOG_LEVEL:-info} | tr '[:upper:]' '[:lower:]')"

# Add workers if specified (default to 1)
if [ -n "$UVICORN_WORKERS" ]; then
    UVICORN_CMD="$UVICORN_CMD --workers $UVICORN_WORKERS"
fi

# Run uvicorn
echo "Executing: $UVICORN_CMD"
eval $UVICORN_CMD &
uvicorn_pid=$!

# Wait for uvicorn to be ready
echo "Waiting for uvicorn to start..."
sleep 3

# Check if uvicorn started successfully
if ! kill -0 "$uvicorn_pid" 2>/dev/null; then
    echo "ERROR: Failed to start uvicorn"
    kill -TERM "$nginx_pid" 2>/dev/null || true
    exit 1
fi

echo "Uvicorn started (PID: $uvicorn_pid)"
echo ""
echo "=========================================="
echo "JellyView is ready!"
echo "=========================================="

# Monitor processes
while true; do
    # Check if nginx is still running
    if ! kill -0 "$nginx_pid" 2>/dev/null; then
        echo "ERROR: Nginx process died"
        if [ -n "$uvicorn_pid" ]; then
            kill -TERM "$uvicorn_pid" 2>/dev/null || true
            wait "$uvicorn_pid" 2>/dev/null || true
        fi
        exit 1
    fi

    # Check if uvicorn is still running
    if ! kill -0 "$uvicorn_pid" 2>/dev/null; then
        echo "ERROR: Uvicorn process died"
        nginx -s stop 2>/dev/null || true
        exit 1
    fi

    # Wait a bit before checking again
    sleep 5
done
