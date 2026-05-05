#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${IMAGE_NAME:-jellyview}"
CONTAINER_NAME="${CONTAINER_NAME:-jellyview}"
HOST_PORT="${HOST_PORT:-8080}"
DATA_VOLUME="${DATA_VOLUME:-jellyview-data}"

# Parse command line arguments
DETACH=0
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detach)
            DETACH=1
            shift
            ;;
        -p|--port)
            HOST_PORT="$2"
            shift 2
            ;;
        -n|--name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -d, --detach       Run container in background"
            echo "  -p, --port PORT    Host port to expose (default: 8080)"
            echo "  -n, --name NAME    Container name (default: jellyview)"
            echo "  -h, --help         Show this help message"
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
echo "Starting Production Mode"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if image exists
if ! docker image inspect "${IMAGE_NAME}" > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker image '${IMAGE_NAME}' not found${NC}"
    echo -e "${YELLOW}Please build the image first using: docker/build.sh${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env from .env.example${NC}"
        echo -e "${YELLOW}Please edit .env with your actual values before running${NC}"
    else
        echo -e "${RED}Error: Neither .env nor .env.example found${NC}"
        exit 1
    fi
fi

# Check if container is already running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}Container '${CONTAINER_NAME}' already exists${NC}"
    if [ "${FORCE_RESTART:-0}" = "1" ]; then
        echo -e "${YELLOW}Stopping and removing existing container...${NC}"
        docker stop "${CONTAINER_NAME}" > /dev/null 2>&1 || true
        docker rm "${CONTAINER_NAME}" > /dev/null 2>&1 || true
    else
        echo -e "${YELLOW}Use FORCE_RESTART=1 to restart, or docker/stop.sh to stop first${NC}"
        read -p "Do you want to recreate the container? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker stop "${CONTAINER_NAME}" > /dev/null 2>&1 || true
            docker rm "${CONTAINER_NAME}" > /dev/null 2>&1 || true
        else
            echo -e "${GREEN}Starting existing container...${NC}"
            docker start "${CONTAINER_NAME}"
            echo -e "${GREEN}=========================================="
            echo "Container started successfully!"
            echo "=========================================="
            echo -e "${GREEN}Container: ${CONTAINER_NAME}${NC}"
            echo -e "${GREEN}URL: http://localhost:${HOST_PORT}${NC}"
            exit 0
        fi
    fi
fi

# Build docker run command
DOCKER_CMD="docker run --name ${CONTAINER_NAME}"

# Add detach flag
if [ "${DETACH}" = "1" ]; then
    DOCKER_CMD="${DOCKER_CMD} -d"
fi

# Add port mapping
DOCKER_CMD="${DOCKER_CMD} -p ${HOST_PORT}:80"

# Add volume mapping
DOCKER_CMD="${DOCKER_CMD} -v ${DATA_VOLUME}:/app/data"

# Add restart policy
DOCKER_CMD="${DOCKER_CMD} --restart unless-stopped"

# Add environment variables
if [ -f .env ]; then
    # Load .env file and pass as environment variables
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        # Remove any surrounding quotes from value
        value=$(echo "$value" | sed 's/^["'\'']//' | sed 's/["'\'']$//')
        DOCKER_CMD="${DOCKER_CMD} -e ${key}=${value}"
    done < .env
fi

# Add image name
DOCKER_CMD="${DOCKER_CMD} ${IMAGE_NAME}"

# Run the container
echo -e "${GREEN}Starting container...${NC}"
echo -e "${GREEN}Image: ${IMAGE_NAME}${NC}"
echo -e "${GREEN}Container: ${CONTAINER_NAME}${NC}"
echo -e "${GREEN}Port: ${HOST_PORT} -> 80${NC}"
echo ""

if eval ${DOCKER_CMD}; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "Container started successfully!"
    echo "=========================================="
    echo -e "${GREEN}Container: ${CONTAINER_NAME}${NC}"
    echo -e "${GREEN}URL: http://localhost:${HOST_PORT}${NC}"
    if [ "${DETACH}" = "1" ]; then
        echo -e "${YELLOW}Running in detached mode${NC}"
        echo -e "${YELLOW}To view logs: docker logs -f ${CONTAINER_NAME}${NC}"
        echo -e "${YELLOW}To stop: docker/stop.sh${NC}"
    fi
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "Failed to start container!"
    echo "=========================================="
    exit 1
fi
