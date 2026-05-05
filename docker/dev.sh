#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="${PROJECT_NAME:-jellyview-dev}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"

# Print script header
echo "=========================================="
echo "Starting Development Mode"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env from .env.example${NC}"
        echo -e "${YELLOW}Please edit .env with your actual values${NC}"
    else
        echo -e "${RED}Error: Neither .env nor .env.example found${NC}"
        exit 1
    fi
fi

# Check if dev compose file exists, if not create it
if [ ! -f "${COMPOSE_FILE}" ]; then
    echo -e "${YELLOW}Creating development docker-compose file...${NC}"
    cat > "${COMPOSE_FILE}" << 'EOF'
services:
  jellyview:
    build:
      context: .
      dockerfile: Dockerfile.dev
      target: development
    container_name: jellyview-dev
    ports:
      - "8080:80"
      - "8001:8000"
    volumes:
      - ./backend:/app/backend
      - ./frontend:/app/frontend
      - jellyview-dev-data:/app/data
    environment:
      - JELLYFIN_URL=${JELLYFIN_URL:-http://localhost:8096}
      - JELLYFIN_API_KEY=${JELLYFIN_API_KEY}
      - TZ=${TZ:-UTC}
      - LOG_LEVEL=${LOG_LEVEL:-DEBUG}
      - HISTORY_RETENTION_DAYS=${HISTORY_RETENTION_DAYS:-365}
      - PYTHONUNBUFFERED=1
    restart: unless-stopped
    stdin_open: true
    tty: true

volumes:
  jellyview-dev-data:
    driver: local
EOF
    echo -e "${GREEN}Created ${COMPOSE_FILE}${NC}"
fi

# Stop existing containers if running
if docker-compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" ps | grep -q "Up"; then
    echo -e "${YELLOW}Stopping existing development containers...${NC}"
    docker-compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" down
fi

# Build and start containers
echo -e "${GREEN}Building and starting development containers...${NC}"

if docker-compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" up --build; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "Development mode started successfully!"
    echo "=========================================="
    echo -e "${GREEN}Backend API: http://localhost:8001${NC}"
    echo -e "${GREEN}Frontend: http://localhost:8080${NC}"
    echo -e "${YELLOW}To stop: docker/stop.sh${NC}"
    echo -e "${YELLOW}To view logs: docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} logs -f${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "Failed to start development mode!"
    echo "=========================================="
    exit 1
fi
