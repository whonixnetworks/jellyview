<p align="center">
  <img src="icons/jv.png" alt="whonix logo" width="200"/>
</p>

A self-hosted Docker container for viewing Jellyfin server statistics — watch history, library stats, user stats, live sessions with stream control, and event-driven notifications.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Screenshots & Pages](#screenshots--pages)
- [Installation](#installation)
  - [Docker Installation](#docker-installation)
  - [Local Development](#local-development)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Development Guide](#development-guide)
- [Build Instructions](#build-instructions)
- [Contributing](#contributing)
- [License](#license)

## Features

### 📊 Real-Time Dashboard
- Overview statistics (total plays, watch time, active users, media items)
- Live session count with transcoding indicators
- Recent activity feed showing latest playback events
- Top users and media by play count and watch time
- Device breakdown charts showing client usage

### 🔴 Live Sessions Monitoring
- Real-time session monitoring via Server-Sent Events (SSE)
- Stream quality indicators and transcode status
- Playback controls (stop, pause, unpause sessions)
- Send messages to active sessions
- Bandwidth and stream statistics monitoring

### 📈 Analytics & History
- User watch history and detailed statistics
- Library browsing with comprehensive stats
- Historical data with filters and sorting
- Export watch history to CSV
- Visual charts for play patterns over time

### 🔔 Notification System
- Configure multiple notification channels: Telegram, Discord, Email, Webhook
- Set up event rules for stream start/stop, transcoding, etc.
- Custom message templates with dynamic variables
- Notification delivery log with retry mechanism
- Test notifications before deployment

### 💾 Backup & Restore
- Export watch statistics to portable JSON format
- Import with intelligent item matching using ProviderIds
- Dry-run import preview to verify changes
- Import reports with detailed error handling
- Migrate watch history between Jellyfin instances

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12+ / FastAPI |
| **Frontend** | React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS |
| **Database** | SQLite (WAL mode) with SQLAlchemy + Alembic migrations |
| **Charts** | Recharts |
| **Real-time** | WebSocket (Jellyfin → JellyView), SSE (JellyView → browser) |
| **Tasks** | APScheduler (background jobs) |
| **Deployment** | Docker multi-stage build, single container |
| **Web Server** | Nginx (reverse proxy & static file serving) |
| **ASGI Server** | Uvicorn |

### Key Dependencies

#### Backend
- `fastapi` - Modern, fast web framework for building APIs
- `uvicorn` - ASGI server with websocket support
- `sqlalchemy` - SQL toolkit and ORM
- `alembic` - Database migration tool
- `httpx` - Async HTTP client for Jellyfin API
- `websockets` - WebSocket client for Jellyfin events
- `apscheduler` - Background task scheduling
- `aiosmtplib` - Async SMTP for email notifications
- `pydantic-settings` - Settings management

#### Frontend
- `react` - UI library
- `react-router-dom` - Client-side routing
- `recharts` - Charting library
- `axios` - HTTP client
- `@radix-ui/*` - Headless UI components
- `lucide-react` - Icon library
- `tailwindcss` - CSS framework
- `vite` - Build tool and dev server

## Screenshots & Pages

### Dashboard (`/`)
The main dashboard provides an at-a-glance view of your Jellyfin server activity:
- **Top Stats**: Total plays, watch time, active users, total media items
- **Live Sessions**: Active session count with transcode indicators
- **Recent Activity**: Feed of recent playback events
- **Top Content**: Charts showing most played users, items, and libraries
- **Device Breakdown**: Client and device usage statistics

### Live Sessions (`/sessions`)
Real-time monitoring of all active playback sessions:
- Session cards with user, media, and playback info
- Transcode status (DirectPlay vs. Transcoding)
- Stream quality indicators (bitrate, resolution)
- Session controls (stop, pause, unpause)
- Send messages to session clients
- Bandwidth usage monitoring

### Users (`/users`)
Browse and analyze user activity:
- User cards with avatars and summary stats
- Total play count and watch time per user
- Device list and activity patterns
- User detail view with comprehensive statistics
- Timeline of user activity

### User Detail (`/users/:id`)
Detailed view of individual user activity:
- User profile and statistics
- Device breakdown by client
- Watch history timeline
- Top watched items
- Activity patterns over time

### Libraries (`/libraries`)
Browse and analyze media libraries:
- Library cards with summary statistics
- Total items and play count per library
- Library type filtering (Movies, TV Shows, Music)
- Media item breakdown

### Library Detail (`/libraries/:id`)
Detailed view of individual library:
- Library statistics and overview
- Media item grid with filtering
- Top items by play count
- Recent activity

### History (`/history`)
Comprehensive watch history:
- Filterable table of all playback events
- Date range filtering
- User and item filtering
- Export to CSV functionality
- Sorting options

### Recently Added (`/recently-added`)
View recently added media items:
- Sorted by addition date
- Item type indicators
- Quick access to new content

### Notifications (`/notifications`)
Configure notification settings:
- Add/edit/delete notification notifiers (Telegram, Discord, Email, Webhook)
- Configure event rules (stream start, stream stop, transcoding, etc.)
- Custom message templates with variables
- Test notification functionality
- Delivery log with status and retries

### Settings (`/settings`)
Application configuration:
- Jellyfin server connection settings
- Data retention policies
- System settings
- Connection status indicators

### Backup & Restore (`/backup-restore`)
Data management tools:
- Create backups of watch statistics
- View and download existing backups
- Import statistics with preview
- Dry-run mode for testing imports
- Import reports with success/failure details

## Installation

### Docker Installation (Recommended)

The easiest way to run JellyView is using Docker Compose.

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/jellyview.git
cd jellyview
```

2. **Copy and configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your Jellyfin server details:
```env
# Jellyfin Configuration
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your-api-key-here

# Application Settings
DATA_DIR=/app/data
TZ=America/New_York
LOG_LEVEL=INFO
HISTORY_RETENTION_DAYS=365
```

**To get your Jellyfin API key:**
1. Log in to your Jellyfin web interface
2. Go to Dashboard → API Keys
3. Click the "+" button to create a new key
4. Give it a name (e.g., "JellyView")
5. Copy the generated key to your `.env` file

3. **Start the container:**
```bash
docker-compose up -d
```

4. **Access the web UI:**
Open your browser and navigate to `http://localhost:8080`

5. **Check logs (if needed):**
```bash
docker-compose logs -f jellyview
```

### Docker CLI Installation

If you prefer not to use Docker Compose:

```bash
# Build the image
docker build -t jellyview .

# Run the container
docker run -d \
  --name jellyview \
  -p 8080:80 \
  -v jellyview-data:/app/data \
  -e JELLYFIN_URL=http://your-jellyfin-server:8096 \
  -e JELLYFIN_API_KEY=your-api-key-here \
  -e TZ=America/New_York \
  jellyview
```

### Local Development

For development, you can run the frontend and backend separately.

#### Prerequisites

- **Backend**: Python 3.12+
- **Frontend**: Node.js 20+
- **Jellyfin server** with API access

#### Backend Setup

1. **Navigate to the backend directory:**
```bash
cd backend
```

2. **Create a virtual environment:**
```bash
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Create a `.env` file in the backend directory:**
```env
JELLYFIN_URL=http://localhost:8096
JELLYFIN_API_KEY=your-api-key-here
DATA_DIR=./data
TZ=UTC
LOG_LEVEL=INFO
HISTORY_RETENTION_DAYS=365
```

5. **Initialize the database:**
```bash
alembic upgrade head
```

6. **Start the backend server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`

#### Frontend Setup

1. **Navigate to the frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create a `.env` file:**
```env
VITE_API_URL=http://localhost:8000
```

4. **Start the development server:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### Database Migrations

To create new migrations after modifying models:

```bash
cd backend
alembic revision --autogenerate -m "description of changes"
alembic upgrade head
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JELLYFIN_URL` | Jellyfin server URL | `http://localhost:8096` | Yes |
| `JELLYFIN_API_KEY` | Jellyfin API key | - | Yes |
| `DATA_DIR` | Data directory path | `/app/data` | No |
| `TZ` | Timezone | `UTC` | No |
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `HISTORY_RETENTION_DAYS` | Days to retain history | `365` | No |
| `HOST` | Backend host | `0.0.0.0` | No |
| `PORT` | Backend port | `8000` | No |
| `WORKERS` | Uvicorn worker count | `1` | No |
| `VITE_API_URL` | Frontend API URL (build time) | `http://localhost:8000` | No |

### Volume Mounts

When running with Docker, you can mount volumes for persistence:

- `/app/data` - SQLite database and application data

### Network Configuration

By default, JellyView exposes:
- Port `80` (HTTP) - Web UI and API
- Internal port `8000` - Backend API (proxied through nginx)

Ensure your Jellyfin server is accessible from the JellyView container. If running on the same host using Docker, use `http://host.docker.internal:8096` or your server's LAN IP.

### Notification Configuration

Notifications can be configured through the web UI. Each notifier type requires specific settings:

#### Telegram
- Bot Token (from @BotFather)
- Chat ID (user or group ID)

#### Discord
- Webhook URL (from server channel settings)

#### Email
- SMTP server URL (e.g., `smtp.gmail.com:587`)
- SMTP username
- SMTP password
- From email address
- To email address

#### Webhook
- Webhook URL
- HTTP method (GET/POST)
- Custom headers (JSON format)

## API Documentation

JellyView provides a RESTful API documented with FastAPI's automatic documentation.

### Accessing API Documentation

Once the application is running, access the interactive API documentation at:

- **Swagger UI**: `http://localhost:8080/docs`
- **ReDoc**: `http://localhost:8080/redoc`

### API Endpoints

#### Authentication (`/api/auth`)
- `GET /api/auth/status` - Check authentication status

#### Dashboard (`/api/dashboard`)
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/top-users` - Get top users by watch time
- `GET /api/dashboard/top-items` - Get top items by plays
- `GET /api/dashboard/top-libraries` - Get top libraries
- `GET /api/dashboard/recent-activity` - Get recent activity
- `GET /api/dashboard/plays-over-time` - Get plays chart data
- `GET /api/dashboard/device-breakdown` - Get device usage stats

#### Sessions (`/api/sessions`)
- `GET /api/sessions` - List all active sessions
- `GET /api/sessions/{session_id}` - Get session details
- `POST /api/sessions/{session_id}/command` - Send playstate command
- `POST /api/sessions/{session_id}/message` - Send message to client
- `GET /api/sessions/stats` - Get session statistics

#### Users (`/api/users`)
- `GET /api/users` - List all users
- `GET /api/users/{user_id}` - Get user details
- `GET /api/users/{user_id}/activity` - Get user activity
- `GET /api/users/{user_id}/devices` - Get user devices

#### Libraries (`/api/libraries`)
- `GET /api/libraries` - List all libraries
- `GET /api/libraries/{library_id}` - Get library details
- `GET /api/libraries/{library_id}/items` - Get library items
- `GET /api/libraries/{library_id}/stats` - Get library statistics

#### Items (`/api/items`)
- `GET /api/items/{item_id}` - Get item details
- `GET /api/items/{item_id}/history` - Get item playback history

#### History (`/api/history`)
- `GET /api/history` - Get watch history with filters
- `GET /api/history/export` - Export history to CSV

#### Notifications (`/api/notifications`)
- `GET /api/notifiers` - List notification notifiers
- `POST /api/notifiers` - Create notifier
- `PUT /api/notifiers/{notifier_id}` - Update notifier
- `DELETE /api/notifiers/{notifier_id}` - Delete notifier
- `POST /api/notifiers/{notifier_id}/test` - Test notifier
- `GET /api/event-rules` - List event rules
- `POST /api/event-rules` - Create event rule
- `PUT /api/event-rules/{rule_id}` - Update event rule
- `DELETE /api/event-rules/{rule_id}` - Delete event rule

#### Settings (`/api/settings`)
- `GET /api/settings` - Get application settings
- `PUT /api/settings` - Update application settings

#### Backup (`/api/backup`)
- `GET /api/backup` - List backups
- `POST /api/backup` - Create backup
- `GET /api/backup/{backup_id}` - Get backup details
- `DELETE /api/backup/{backup_id}` - Delete backup
- `POST /api/backup/import` - Import from backup
- `POST /api/backup/import/preview` - Preview import

#### SSE Events (`/api/sse`)
- `GET /api/sse?event_types=*` - Subscribe to real-time events

### SSE Event Types

Connect to `/api/sse` to receive real-time updates:

- `session` - Session events (play, pause, stop, etc.)
- `notification` - Notification events
- `library` - Library events (new library, update, delete)
- `item` - Item events (new item, update, delete)

Example SSE connection:

```javascript
const eventSource = new EventSource('/api/sse?event_types=session,notification');

eventSource.addEventListener('session', (event) => {
  const data = JSON.parse(event.data);
  console.log('Session event:', data);
});
```

## Development Guide

### Project Structure

```
jellyview/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Configuration settings
│   │   ├── database.py          # Database connection
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API route handlers
│   │   └── services/            # Business logic
│   ├── alembic/                 # Database migrations
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Backend Docker image
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── main.tsx             # React entry point
│   │   └── App.tsx              # App routing
│   ├── package.json             # Node dependencies
│   ├── vite.config.ts           # Vite configuration
│   └── Dockerfile               # Frontend Docker image
├── docker/
│   ├── nginx.conf               # Nginx configuration
│   └── entrypoint.sh            # Container entrypoint
├── docker-compose.yml           # Docker Compose config
├── .env.example                 # Environment variables template
└── README.md                    # This file
```

### Backend Development

#### Adding a New API Endpoint

1. Create or update the Pydantic schema in `backend/app/schemas/`:
```python
from pydantic import BaseModel

class NewItemSchema(BaseModel):
    name: str
    value: int
```

2. Add the route in `backend/app/routers/`:
```python
from fastapi import APIRouter, Depends
from ..schemas.new_item import NewItemSchema

router = APIRouter(prefix="/api/new-endpoint", tags=["New Endpoint"])

@router.post("/", response_model=NewItemSchema)
async def create_item(item: NewItemSchema):
    # Implementation here
    return item
```

3. Register the router in `backend/app/main.py`:
```python
from .routers import new_endpoint

app.include_router(new_endpoint.router)
```

#### Adding a New Database Model

1. Create the model in `backend/app/models/`:
```python
from sqlalchemy import Column, Integer, String
from ..database import Base

class NewModel(Base):
    __tablename__ = "new_table"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
```

2. Generate and apply migration:
```bash
cd backend
alembic revision --autogenerate -m "Add new model"
alembic upgrade head
```

#### Creating a New Service

Create a service file in `backend/app/services/`:
```python
class NewService:
    def __init__(self, db_session):
        self.db = db_session

    async def do_something(self):
        # Business logic here
        pass
```

### Frontend Development

#### Creating a New Page

1. Create a new page component in `frontend/src/pages/`:
```tsx
import React from 'react';

const NewPage: React.FC = () => {
  return (
    <div>
      <h1>New Page</h1>
      {/* Page content */}
    </div>
  );
};

export default NewPage;
```

2. Add the route in `frontend/src/App.tsx`:
```tsx
import NewPage from './pages/NewPage';

<Route path="/new-page" element={
  <PageWrapper title="New Page">
    <NewPage />
  </PageWrapper>
} />
```

3. Add navigation link in `frontend/src/components/layout/Sidebar.tsx`

#### Creating a New Component

Create components in `frontend/src/components/`:
```tsx
import React from 'react';

interface ComponentProps {
  title: string;
  value: number;
}

const NewComponent: React.FC<ComponentProps> = ({ title, value }) => {
  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-2xl">{value}</p>
    </div>
  );
};

export default NewComponent;
```

#### API Integration

Use axios for API calls:

```tsx
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const fetchData = async () => {
  try {
    const response = await axios.get(`${API_URL}/endpoint`);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};
```

### Testing

#### Backend Tests

Create test files in `backend/tests/`:
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoint():
    response = client.get("/api/endpoint")
    assert response.status_code == 200
```

Run tests:
```bash
cd backend
pytest
```

#### Frontend Tests

Install testing dependencies:
```bash
npm install -D @testing-library/react @testing-library/jest-dom vitest jsdom
```

Create test files:
```tsx
import { render, screen } from '@testing-library/react';
import NewComponent from './NewComponent';

test('renders component', () => {
  render(<NewComponent title="Test" value={42} />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

Run tests:
```bash
npm test
```

### Code Style

#### Backend
- Follow PEP 8 style guidelines
- Use type hints for all function parameters and return values
- Document functions with docstrings
- Use async/await for I/O operations

#### Frontend
- Use functional components with hooks
- Define interfaces for props
- Use TypeScript for type safety
- Follow React best practices

### Debugging

#### Backend Logs

View backend logs when running with Docker:
```bash
docker-compose logs -f jellyview
```

Or locally:
```bash
# Logs will appear in the terminal where uvicorn is running
```

#### Frontend Debugging

The frontend development server includes hot module replacement. Open browser DevTools to inspect components and network requests.

## Build Instructions

### Building the Docker Image

#### Multi-stage Build (Production)

The main Dockerfile builds both frontend and backend in a single optimized image:

```bash
docker build -t jellyview:latest .
```

#### Build Arguments

You can pass build arguments to customize the build:

```bash
docker build \
  --build-arg JELLYFIN_URL=https://your-jellyfin.com \
  --build-arg VITE_API_URL=https://your-jellyview.com \
  -t jellyview:latest \
  .
```

### Building for Development

#### Frontend Only

```bash
cd frontend
npm install
npm run build
```

The built files will be in `frontend/dist/`

#### Backend

No build step required for the backend. Install dependencies and run:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app
```

### Production Deployment

#### Using Docker Compose

1. Update `docker-compose.yml` with your production settings
2. Set environment variables in `.env` or in the compose file
3. Deploy:

```bash
docker-compose -f docker-compose.yml up -d
```

#### Using Kubernetes

Create a Kubernetes deployment (example `k8s/deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jellyview
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jellyview
  template:
    metadata:
      labels:
        app: jellyview
    spec:
      containers:
      - name: jellyview
        image: jellyview:latest
        ports:
        - containerPort: 80
        env:
        - name: JELLYFIN_URL
          value: "http://jellyfin:8096"
        - name: JELLYFIN_API_KEY
          valueFrom:
            secretKeyRef:
              name: jellyview-secrets
              key: api-key
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: jellyview-data
```

#### SSL/TLS Configuration

For production deployment, use a reverse proxy with SSL termination:

**Nginx Example:**

```nginx
server {
    listen 443 ssl http2;
    server_name jellyview.example.com;

    ssl_certificate /etc/ssl/certs/jellyview.crt;
    ssl_certificate_key /etc/ssl/private/jellyview.key;

    location / {
        proxy_pass http://jellyview:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Performance Optimization

#### Database Optimization

- Ensure SQLite is in WAL mode (enabled by default)
- Regularly vacuum the database: `VACUUM;`
- Analyze query performance and add indexes as needed

#### Frontend Optimization

- Build with production mode: `npm run build`
- Enable gzip compression (configured in nginx.conf)
- Use long-term caching for static assets

#### Backend Optimization

- Increase uvicorn workers for production: `--workers 4`
- Use connection pooling for database connections
- Cache frequently accessed data

## Contributing

We welcome contributions to JellyView! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Commit with descriptive messages
5. Push to your fork: `git push origin feature/my-feature`
6. Open a Pull Request

### Pull Request Guidelines

- **Title**: Use a clear, concise title describing the change
- **Description**: Provide a detailed description of changes
- **Testing**: Describe how you tested your changes
- **Documentation**: Update relevant documentation if needed
- **Screenshots**: Include screenshots for UI changes

### Code Review Process

All pull requests are reviewed by maintainers. Be prepared to:

- Make requested changes
- Discuss design decisions
- Address code style issues
- Add tests for new features

### Coding Standards

#### Backend

- Follow PEP 8 style guidelines
- Use meaningful variable and function names
- Add docstrings to all functions and classes
- Write type hints for all parameters and return values
- Keep functions focused and small

#### Frontend

- Use functional components with hooks
- Define interfaces for all props
- Follow React best practices
- Use TypeScript for type safety
- Keep components modular and reusable

### Commit Messages

Follow conventional commits format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(sessions): add session pause functionality

Implement pause/unpause commands for active sessions using
Jellyfin API.

Closes #123

fix(notifications): correct email notification content

Fix template variable parsing in email notifications.
```

### Issue Reporting

When reporting bugs or requesting features:

1. Search existing issues first
2. Use clear, descriptive titles
3. Provide detailed information:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details (OS, versions, etc.)
   - Screenshots or logs if applicable

### Development Setup

See the [Local Development](#local-development) section for setting up your development environment.

### Testing

- Write tests for new features
- Ensure all existing tests pass
- Test on multiple browsers if making frontend changes

### Documentation

- Update README.md for user-facing changes
- Update inline code documentation
- Add comments for complex logic

### Code of Conduct

Be respectful and constructive in all interactions. We're all working to make JellyView better!

## License

To be determined.

---

**JellyView** - Self-hosted Jellyfin server statistics viewer

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/yourusername/jellyview).
