#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="${CONTAINER_NAME:-jellyview}"
DEV_CONTAINER_NAME="${DEV_CONTAINER_NAME:-jellyview-dev}"
PROJECT_NAME="${PROJECT_NAME:-jellyview-dev}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
REMOVE_VOLUMES=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=1
            shift
            ;;
        -a|--all)
            STOP_ALL=1
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --volumes     Remove associated volumes (CAUTION: data will be lost)"
            echo "  -a, --all         Stop all JellyView containers (including dev)"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Print script header
echo "=========================================="
echo "Stopping Containers"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Function to stop and remove a container
stop_container() {
    local name=$1
    local remove_volumes=$2

    if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
        echo -e "${YELLOW}Stopping container: ${name}${NC}"
        docker stop "${name}" > /dev/null 2>&1 || echo -e "${YELLOW}Container ${name} was not running${NC}"

        if [ "${remove_volumes}" = "1" ]; then
            echo -e "${YELLOW}Removing container: ${name}${NC}"
            docker rm "${name}" > /dev/null 2>&1 || echo -e "${YELLOW}Failed to remove container ${name}${NC}"
        else
            echo -e "${YELLOW}Removing container: ${name}${NC}"
            docker rm "${name}" > /dev/null 2>&1 || echo -e "${YELLOW}Failed to remove container ${name}${NC}"
        fi
        echo -e "${GREEN}Container ${name} stopped and removed${NC}"
    else
        echo -e "${YELLOW}Container ${name} not found${NC}"
    fi
}

# Stop production container
echo -e "${GREEN}Checking for production containers...${NC}"
stop_container "${CONTAINER_NAME}" 0

# Stop development containers if --all flag is set
if [ "${STOP_ALL:-0}" = "1" ]; then
    echo -e "${GREEN}Checking for development containers...${NC}"

    # Stop dev container if running directly
    stop_container "${DEV_CONTAINER_NAME}" 0

    # Stop docker-compose dev containers
    if [ -f "${COMPOSE_FILE}" ]; then
        if docker-compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" ps | grep -q "Up\|Exit"; then
            echo -e "${YELLOW}Stopping docker-compose dev containers...${NC}"
            if [ "${REMOVE_VOLUMES}" = "1" ]; then
                docker-compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" down -v
            else
                docker-compose -f "${COMPOSE_FILE}" -p "${PROJECT_NAME}" down
            fi
            echo -e "${GREEN}Docker-compose dev containers stopped${NC}"
        else
            echo -e "${YELLOW}No docker-compose dev containers running${NC}"
        fi
    fi
fi

# Remove volumes if requested
if [ "${REMOVE_VOLUMES}" = "1" ]; then
    echo ""
    echo -e "${YELLOW}=========================================="
    echo "WARNING: Removing volumes will delete all data!"
    echo "=========================================="
    read -p "Are you sure you want to remove volumes? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Removing volumes...${NC}"

        # Remove named volumes
        VOLUMES_TO_REMOVE=$(docker volume ls -q | grep -E "jellyview|${PROJECT_NAME}" || true)
        if [ -n "$VOLUMES_TO_REMOVE" ]; then
            echo "$VOLUMES_TO_REMOVE" | xargs -r docker volume rm
            echo -e "${GREEN}Volumes removed${NC}"
        else
            echo -e "${YELLOW}No volumes found to remove${NC}"
        fi
    else
        echo -e "${GREEN}Volumes kept${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Cleanup complete!"
echo "=========================================="
exit 0
