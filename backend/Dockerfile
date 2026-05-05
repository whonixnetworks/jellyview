# Stage 1: Build frontend
FROM node:20-slim AS build-frontend

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend dependencies
FROM python:3.12-slim AS backend-deps

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Production
FROM python:3.12-slim AS production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create data directory
RUN mkdir -p /app/data

# Copy Python dependencies from backend-deps stage
COPY --from=backend-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend-deps /usr/local/bin /usr/local/bin

# Copy backend application
COPY backend/ ./backend/

# Copy built frontend from build-frontend stage
COPY --from=build-frontend /app/frontend/dist /app/frontend/dist

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose ports
EXPOSE 80

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    DATA_DIR=/app/data \
    JELLYFIN_URL=http://localhost:8096 \
    TZ=UTC \
    LOG_LEVEL=INFO

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start both nginx and uvicorn
ENTRYPOINT ["/app/entrypoint.sh"]
