#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${IMAGE_NAME:-jellyview}"
DOCKERFILE="${DOCKERFILE:-backend/Dockerfile}"
BUILD_CONTEXT="${BUILD_CONTEXT:-.}"

# Print script header
echo "=========================================="
echo "Building Docker Image: ${IMAGE_NAME}"
echo "=========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Using .env.example as template.${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env from .env.example${NC}"
        echo -e "${YELLOW}Please edit .env with your actual values before running the application.${NC}"
    else
        echo -e "${RED}Error: Neither .env nor .env.example found${NC}"
        exit 1
    fi
fi

# Build arguments
BUILD_ARGS=""

# Check if we want to build without cache
if [ "${NO_CACHE:-0}" = "1" ]; then
    echo -e "${YELLOW}Building without cache...${NC}"
    BUILD_ARGS="--no-cache"
fi

# Check if we want to build with BuildKit
if [ "${USE_BUILDKIT:-1}" = "1" ]; then
    echo -e "${GREEN}Using Docker BuildKit${NC}"
    export DOCKER_BUILDKIT=1
fi

# Build the image
echo -e "${GREEN}Building image: ${IMAGE_NAME}${NC}"
echo -e "${GREEN}Dockerfile: ${DOCKERFILE}${NC}"
echo -e "${GREEN}Context: ${BUILD_CONTEXT}${NC}"
echo ""

if docker build \
    ${BUILD_ARGS} \
    -t "${IMAGE_NAME}" \
    -f "${DOCKERFILE}" \
    "${BUILD_CONTEXT}"; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "Build successful!"
    echo "=========================================="
    echo -e "${GREEN}Image: ${IMAGE_NAME}${NC}"
    echo -e "${GREEN}To run the container, use: docker/prod.sh${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "Build failed!"
    echo "=========================================="
    exit 1
fi
