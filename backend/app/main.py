"""FastAPI application entry point."""
import asyncio
import json
import logging
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Set

from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import settings
from .database import engine, Base, SessionLocal

# Import routers
from .routers import auth, dashboard, sessions, users, libraries, items, history, notifications, settings as settings_router, backup

# Import services
from .services.jellyfin import JellyfinClient
from .services.websocket import JellyfinWebSocketListener
from .services.activity_processor import ActivityProcessor
from .services.session_tracker import SessionTracker
from .services.notification.dispatcher import NotificationDispatcher
from .services.scheduler import SchedulerService
from .services.session_poller import SessionPoller

# Configure logging with file handler so /settings/logs can read them
import os
from logging.handlers import RotatingFileHandler

log_dir = os.path.join(settings.data_dir, "logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "jellyview.log")

file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s:%(name)s - %(message)s'))

# Configure root logger
root_logger = logging.getLogger()
root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
root_logger.addHandler(file_handler)

# Also ensure the app logger is configured
app_logger = logging.getLogger("app")
app_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))




logger = logging.getLogger(__name__)


def get_jellyfin_config_from_db() -> tuple[str, str]:
    """Load Jellyfin URL and API key from the database.

    Returns:
        Tuple of (url, api_key). Returns empty strings if not configured.
    """
    db = SessionLocal()
    try:
        from .models.settings import AppSettings
        config_entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
        if config_entry:
            config = json.loads(config_entry.value)
            return config.get("url", ""), config.get("api_key", "")
    except Exception as e:
        logger.error(f"Failed to load Jellyfin config from DB: {e}")
    finally:
        db.close()
    return "", ""


class SSEEvent(BaseModel):
    """Schema for SSE event data."""
    event_type: str
    event_id: Optional[str] = None
    data: dict
    timestamp: datetime


class SSEManager:
    """Manages SSE connections and event broadcasting."""

    def __init__(self):
        """Initialize the SSE manager."""
        self._connections: dict[str, asyncio.Queue] = {}
        self._client_filters: dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def add_connection(
        self,
        client_id: str,
        event_types: Set[str],
    ) -> asyncio.Queue:
        """Add a new SSE connection.

        Args:
            client_id: Unique identifier for the client
            event_types: Set of event types the client is subscribed to

        Returns:
            Queue for sending events to this client
        """
        async with self._lock:
            queue = asyncio.Queue()
            self._connections[client_id] = queue
            self._client_filters[client_id] = event_types
            logger.info(f"SSE connection added: {client_id}, types: {event_types}")
        return queue

    async def remove_connection(self, client_id: str) -> None:
        """Remove an SSE connection.

        Args:
            client_id: Unique identifier for the client
        """
        async with self._lock:
            if client_id in self._connections:
                del self._connections[client_id]
            if client_id in self._client_filters:
                del self._client_filters[client_id]
            logger.info(f"SSE connection removed: {client_id}")

    async def broadcast_event(self, event_type: str, data: dict) -> None:
        """Broadcast an event to all connected clients.

        Args:
            event_type: Type of event to broadcast
            data: Event data payload
        """
        event = SSEEvent(
            event_type=event_type,
            event_id=str(uuid.uuid4()),
            data=data,
            timestamp=datetime.utcnow(),
        )

        async with self._lock:
            disconnected_clients = []
            for client_id, queue in self._connections.items():
                subscribed_types = self._client_filters.get(client_id, set())
                # If client is subscribed to this event type or all events
                if "*" in subscribed_types or event_type in subscribed_types:
                    try:
                        await queue.put_nowait(event)
                    except asyncio.QueueFull:
                        logger.warning(f"Queue full for client {client_id}")
                    except Exception as e:
                        logger.error(f"Error sending to client {client_id}: {e}")
                        disconnected_clients.append(client_id)

            # Clean up disconnected clients
            for client_id in disconnected_clients:
                await self.remove_connection(client_id)

    async def get_connection_count(self) -> int:
        """Get the current number of active connections.

        Returns:
            Number of active SSE connections
        """
        async with self._lock:
            return len(self._connections)


# Global SSE manager instance
sse_manager = SSEManager()


def format_sse_event(event: SSEEvent) -> str:
    """Format an SSE event for transmission.

    Args:
        event: The SSE event to format

    Returns:
        Formatted SSE message string
    """
    data = event.model_dump_json()
    return f"event: {event.event_type}\ndata: {data}\n\n"


async def event_generator(
    client_id: str,
    event_types: Set[str],
) -> AsyncGenerator[str, None]:
    """Generate SSE events for a connected client.

    Args:
        client_id: Unique identifier for the client
        event_types: Set of event types to filter for

    Yields:
        Formatted SSE event strings
    """
    try:
        queue = await sse_manager.add_connection(client_id, event_types)

        # Send initial connection event
        yield format_sse_event(
            SSEEvent(
                event_type="connection",
                event_id=str(uuid.uuid4()),
                data={"client_id": client_id, "status": "connected"},
                timestamp=datetime.utcnow(),
            )
        )

        while True:
            # Wait for new events with timeout to check for disconnection
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield format_sse_event(event)
            except asyncio.TimeoutError:
                # Send keepalive comment to keep connection alive
                yield ": keepalive\n\n"
    except asyncio.CancelledError:
        logger.info(f"Client {client_id} disconnected (cancelled)")
    except Exception as e:
        logger.error(f"Error in event generator for {client_id}: {e}")
    finally:
        await sse_manager.remove_connection(client_id)


# Global service instances
jellyfin_client: Optional[JellyfinClient] = None
websocket_listener: Optional[JellyfinWebSocketListener] = None
activity_processor: Optional[ActivityProcessor] = None
session_tracker: Optional[SessionTracker] = None
notification_dispatcher: Optional[NotificationDispatcher] = None
background_scheduler: Optional[SchedulerService] = None
session_poller: Optional[SessionPoller] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager.

    Handles startup and shutdown events.
    """
    global jellyfin_client, websocket_listener, activity_processor, session_tracker, notification_dispatcher, background_scheduler, session_poller

    # Startup: Create database tables and initialize services
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Migrate: add columns that may not exist in older DBs
    import sqlite3
    try:
        conn = sqlite3.connect(settings.db_url.replace("sqlite:///", "").replace("sqlite://", ""))
        cursor = conn.cursor()
        # Add 'name' column to notification_rules if missing
        cursor.execute("PRAGMA table_info(notification_rules)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'name' not in columns:
            cursor.execute("ALTER TABLE notification_rules ADD COLUMN name VARCHAR(255) DEFAULT ''")
            conn.commit()
            logger.info("Migrated notification_rules: added 'name' column")
        conn.close()
    except Exception as e:
        logger.warning(f"DB migration check failed (non-fatal): {e}")

    try:
        # Load Jellyfin config from database (where setup endpoint saves it)
        db_url, db_api_key = get_jellyfin_config_from_db()
        jellyfin_url = db_url or settings.jellyfin_url
        jellyfin_api_key = db_api_key or settings.jellyfin_api_key
        # Get verify_ssl from DB config (default True for backward compat)
        verify_ssl = True
        try:
            from .models.settings import AppSettings
            cfg_db = SessionLocal()
            try:
                entry = cfg_db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
                if entry:
                    verify_ssl = json.loads(entry.value).get("verify_ssl", True)
            finally:
                cfg_db.close()
        except Exception:
            pass

        # Initialize Jellyfin client
        jellyfin_client = JellyfinClient(
            base_url=jellyfin_url,
            api_key=jellyfin_api_key,
        )
        logger.info(f"Jellyfin client initialized with URL: {jellyfin_url}")

        # Initialize session tracker
        session_tracker = SessionTracker(SessionLocal())
        logger.info("Session tracker initialized")

        # Initialize notification dispatcher
        notification_dispatcher = NotificationDispatcher(SessionLocal())
        logger.info("Notification dispatcher initialized")

        # Initialize activity processor
        activity_processor = ActivityProcessor(
            session_tracker=session_tracker,
            notification_dispatcher=notification_dispatcher,
        )
        logger.info("Activity processor initialized")

        # Initialize WebSocket listener with SSL setting from DB
        websocket_listener = JellyfinWebSocketListener(
            jellyfin_client=jellyfin_client,
            verify_ssl=verify_ssl,
        )
        logger.info("WebSocket listener initialized")

        # Initialize session poller (HTTP fallback for playback events)
        session_poller = SessionPoller(
            jellyfin_client=jellyfin_client,
            poll_interval=5.0,
        )
        logger.info("Session poller initialized")

        # Initialize background scheduler
        background_scheduler = SchedulerService(
            jellyfin_client=jellyfin_client,
        )
        logger.info("Background scheduler initialized")

        # Start WebSocket listener if configured
        websocket_task = None
        if jellyfin_url and jellyfin_api_key:
            try:
                await websocket_listener.connect()

                # Register activity processor as callback for all supported events
                for event_type in websocket_listener.SUPPORTED_EVENTS:
                    def _make_cb(et):
                        async def _cb(data):
                            await activity_processor.process_event(et, data)
                        return _cb
                    callback = _make_cb(event_type)
                    websocket_listener.register_callback(event_type, callback)
                logger.info("Registered activity processor callbacks for WebSocket events")

                asyncio.create_task(websocket_listener.start_listener())
                logger.info("WebSocket listener started")
            except Exception as e:
                logger.warning(f"WebSocket connection not available: {e}")

            # Always start session poller as primary or fallback for playback events
            try:
                def _make_cb(et):
                        async def _cb(data):
                            await activity_processor.process_event(et, data)
                        return _cb
                    callback = _make_cb(event_type)
                    session_poller.register_callback(event_type, callback)
                await session_poller.start()
                logger.info("Session poller started")
            except Exception as e:
                logger.error(f"Failed to start session poller: {e}")
        else:
            logger.warning("Jellyfin URL or API key not configured, skipping WebSocket connection")

        # Start background scheduler if configured
        if jellyfin_url and jellyfin_api_key:
            background_scheduler.start()
            # Trigger initial sync immediately
            logger.info("Triggering initial sync...")
            asyncio.create_task(background_scheduler.sync_users())
            asyncio.create_task(background_scheduler.sync_libraries())
            asyncio.create_task(background_scheduler.sync_history())
            logger.info("Background scheduler started with initial sync triggered")
        else:
            logger.warning("Jellyfin URL or API key not configured, skipping background scheduler")

        yield

    finally:
        # Shutdown: Clean up resources and services
        logger.info("Shutting down services...")

        # Stop WebSocket listener
        if websocket_listener:
            await websocket_listener.disconnect()
            logger.info("WebSocket listener stopped")

        # Stop background scheduler
        if background_scheduler:
            await background_scheduler.shutdown()
            logger.info("Background scheduler stopped")

        # Stop session poller
        if session_poller:
            await session_poller.stop()
            logger.info("Session poller stopped")

        # Close SSE connections
        connection_count = await sse_manager.get_connection_count()
        if connection_count > 0:
            logger.info(f"Closing {connection_count} SSE connections")

        logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="JellyView API",
    description="Self-hosted Jellyfin server statistics viewer",
    version="0.1.0",
    lifespan=lifespan,
)


# Register routers
app.include_router(auth.router, tags=["Authentication"])
app.include_router(dashboard.router, tags=["Dashboard"])
app.include_router(sessions.router, tags=["Sessions"])
app.include_router(users.router, tags=["Users"])
app.include_router(libraries.router, tags=["Libraries"])
app.include_router(items.router, tags=["Items"])
app.include_router(history.router, tags=["History"])
app.include_router(notifications.router, tags=["Notifications"])
app.include_router(settings_router.router, tags=["Settings"])
app.include_router(backup.router, tags=["Backup"])


@app.get("/")
async def root():
    """Root endpoint for API health check."""
    return {
        "name": "JellyView",
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api/sse")
async def sse_endpoint(
    event_types: Optional[str] = Query(
        default="*",
        description="Comma-separated list of event types (session,notification,library,item). Use * for all.",
    ),
):
    """Server-Sent Events endpoint for real-time updates.

    Clients can connect to this endpoint to receive real-time events
    from the JellyView system. Events are filtered by the event_types
    query parameter.

    Event Types:
        - session: Session events (play, pause, stop, etc.)
        - notification: Notification events
        - library: Library events (new library, update, delete)
        - item: Item events (new item, update, delete)

    Example:
        # Subscribe to all events
        GET /api/sse?event_types=*

        # Subscribe to specific events
        GET /api/sse?event_types=session,notification
    """
    # Parse event types filter
    if event_types == "*":
        subscribed_types = {"*"}
    else:
        subscribed_types = set(
            [t.strip() for t in event_types.split(",") if t.strip()]
        )

    # Validate event types
    valid_types = {"*", "session", "sessions", "notification", "library", "item"}
    invalid_types = subscribed_types - valid_types
    if invalid_types:
        raise ValueError(
            f"Invalid event types: {', '.join(invalid_types)}. "
            f"Valid types: {', '.join(valid_types)}"
        )

    # Generate unique client ID
    client_id = str(uuid.uuid4())

    # Return streaming response with SSE events
    return StreamingResponse(
        event_generator(client_id, subscribed_types),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


# Helper function for activity processor integration
async def emit_session_event(event_data: dict) -> None:
    """Emit a session event to all subscribed clients.

    This function should be called by the activity processor when
    session-related events occur.

    Args:
        event_data: Dictionary containing session event data
    """
    await sse_manager.broadcast_event("session", event_data)


async def emit_notification_event(event_data: dict) -> None:
    """Emit a notification event to all subscribed clients.

    This function should be called by the activity processor when
    notification-related events occur.

    Args:
        event_data: Dictionary containing notification event data
    """
    await sse_manager.broadcast_event("notification", event_data)


async def emit_library_event(event_data: dict) -> None:
    """Emit a library event to all subscribed clients.

    This function should be called by the activity processor when
    library-related events occur.

    Args:
        event_data: Dictionary containing library event data
    """
    await sse_manager.broadcast_event("library", event_data)


async def emit_item_event(event_data: dict) -> None:
    """Emit an item event to all subscribed clients.

    This function should be called by the activity processor when
    item-related events occur.

    Args:
        event_data: Dictionary containing item event data
    """
    await sse_manager.broadcast_event("item", event_data)
