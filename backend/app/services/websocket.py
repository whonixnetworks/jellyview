"""Jellyfin WebSocket listener service for real-time event notifications."""
import asyncio
import json
import logging
from typing import Any, Callable, Dict, Optional, Set
import websockets
from websockets.exceptions import ConnectionClosed, ConnectionClosedError

from .jellyfin import JellyfinClient, JellyfinClientError

logger = logging.getLogger(__name__)


class JellyfinWebSocketError(Exception):
    """Custom exception for WebSocket errors."""
    pass


class JellyfinWebSocketListener:
    """WebSocket listener for Jellyfin server events."""

    # Supported Jellyfin WebSocket event types
    SUPPORTED_EVENTS = {
        "PlaybackStart",
        "PlaybackProgress",
        "PlaybackStopped",
        "SessionStarted",
        "SessionEnded",
        "LibraryAdded",
        "LibraryUpdated",
        "LibraryRemoved",
        "UserAdded",
        "UserUpdated",
        "UserDeleted",
        "UserPasswordChanged",
        "ServerRestarting",
        "ServerRestartCompleted",
    }

    def __init__(self, jellyfin_client: JellyfinClient, verify_ssl: bool = True) -> None:
        """Initialize the WebSocket listener.

        Args:
            jellyfin_client: JellyfinClient instance for authentication
            verify_ssl: Whether to verify SSL certificates (set False for self-signed certs)
        """
        self.jellyfin_client = jellyfin_client
        self.verify_ssl = verify_ssl
        self._websocket: Optional[websockets.WebSocketClientProtocol] = None
        self._connected = False
        self._stop_event = asyncio.Event()
        self._reconnect_delay = 5
        self._max_reconnect_attempts = 10
        self._event_callbacks: Dict[str, Set[Callable]] = {
            event_type: set() for event_type in self.SUPPORTED_EVENTS
        }
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._listener_task: Optional[asyncio.Task] = None

    async def connect(self) -> None:
        """Connect to Jellyfin WebSocket server.

        Connects to ws://jellyfin:8096/socket and sends authentication token.

        Raises:
            JellyfinWebSocketError: If connection fails
        """
        # Parse base URL to extract host
        base_url = self.jellyfin_client.base_url
        ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_url}/socket?api_key={self.jellyfin_client.api_key}"

        logger.info(f"Connecting to Jellyfin WebSocket at {ws_url}")

        import ssl
        if self.verify_ssl:
            ssl_context = ssl.create_default_context()
        else:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            logger.debug("SSL verification disabled for WebSocket connection")

        try:
            self._websocket = await websockets.connect(
                ws_url,
                close_timeout=10,
                ping_interval=20,
                ping_timeout=20,
                ssl=ssl_context,
            )
            self._connected = True
            logger.info("WebSocket connected and authenticated")

        except ConnectionClosedError as e:
            error_msg = f"WebSocket connection closed: {e}"
            logger.error(error_msg)
            self._connected = False
            raise JellyfinWebSocketError(error_msg) from e
        except Exception as e:
            error_msg = f"Failed to connect to WebSocket: {e}"
            logger.error(error_msg)
            self._connected = False
            raise JellyfinWebSocketError(error_msg) from e

    async def disconnect(self) -> None:
        """Disconnect from WebSocket server.

        Gracefully closes the WebSocket connection and stops listener task.
        """
        logger.info("Disconnecting from WebSocket")
        self._stop_event.set()

        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None

        if self._websocket:
            try:
                await self._websocket.close()
                logger.info("WebSocket connection closed")
            except Exception as e:
                logger.warning(f"Error closing WebSocket: {e}")
            finally:
                self._websocket = None

        self._connected = False
        self._stop_event.clear()

    async def listen(self) -> None:
        """Listen for WebSocket messages and emit events.

        Continuously receives messages, parses JSON, and emits events to
        registered callbacks. Handles connection errors with automatic reconnection.

        Raises:
            JellyfinWebSocketError: If listening fails after all reconnection attempts
        """
        if not self._connected or not self._websocket:
            raise JellyfinWebSocketError("WebSocket not connected")

        reconnect_attempts = 0

        while not self._stop_event.is_set():
            try:
                async for message in self._websocket:
                    if self._stop_event.is_set():
                        break

                    try:
                        data = json.loads(message)
                        await self._process_message(data)
                        reconnect_attempts = 0  # Reset on successful message

                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse JSON message: {e}")
                    except Exception as e:
                        logger.error(f"Error processing message: {e}")
                    else:
                        # Debug: log all received message types
                        logger.info(f"WS received: {data.get('MessageType')} | Data keys: {list(data.get('Data', {}).keys()) if isinstance(data.get('Data'), dict) else type(data.get('Data'))}")

            except ConnectionClosed as e:
                logger.warning(f"WebSocket connection closed: {e}")

                if self._stop_event.is_set():
                    break

                # Attempt reconnection
                reconnect_attempts += 1
                if reconnect_attempts > self._max_reconnect_attempts:
                    error_msg = "Max reconnection attempts exceeded"
                    logger.error(error_msg)
                    self._connected = False
                    raise JellyfinWebSocketError(error_msg)

                logger.info(f"Reconnecting... (attempt {reconnect_attempts}/{self._max_reconnect_attempts})")
                await asyncio.sleep(self._reconnect_delay)

                try:
                    await self.connect()
                    logger.info("Reconnected successfully")
                except JellyfinWebSocketError as e:
                    logger.error(f"Reconnection failed: {e}")
                    await asyncio.sleep(self._reconnect_delay)

            except Exception as e:
                logger.error(f"Unexpected error in listen loop: {e}")
                if self._stop_event.is_set():
                    break
                await asyncio.sleep(1)

    async def _process_message(self, data: Dict[str, Any]) -> None:
        """Process incoming WebSocket message.

        Args:
            data: Parsed JSON message data
        """
        message_type = data.get("MessageType")

        if not message_type:
            logger.debug("Received message without MessageType")
            return

        logger.info(f"[WS EVENT] MessageType={message_type} | Supported={message_type in self.SUPPORTED_EVENTS} | Data={data.get('Data')}")

        # Filter to only process supported events
        if message_type not in self.SUPPORTED_EVENTS:
            logger.debug(f"Ignoring unsupported event type: {message_type}")

        # Put message in queue for async processing
        await self._message_queue.put({
            "event_type": message_type,
            "data": data.get("Data", {}),
        })

        logger.debug(f"Received event: {message_type}")

        # Emit to registered callbacks
        await self._emit_event(message_type, data.get("Data", {}))

    async def _emit_event(self, event_type: str, event_data: Dict[str, Any]) -> None:
        """Emit event to all registered callbacks.

        Args:
            event_type: Type of event to emit
            event_data: Event payload data
        """
        callbacks = self._event_callbacks.get(event_type, set())

        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event_data)
                else:
                    callback(event_data)
            except Exception as e:
                logger.error(f"Error in event callback for {event_type}: {e}")

    def register_callback(self, event_type: str, callback: Callable) -> None:
        """Register a callback function for specific event type.

        Args:
            event_type: Event type to listen for
            callback: Async or sync function to call when event occurs

        Raises:
            ValueError: If event_type is not supported
        """
        if event_type not in self.SUPPORTED_EVENTS:
            raise ValueError(f"Unsupported event type: {event_type}")

        self._event_callbacks[event_type].add(callback)
        logger.debug(f"Registered callback for {event_type}")

    def unregister_callback(self, event_type: str, callback: Callable) -> None:
        """Unregister a callback function for specific event type.

        Args:
            event_type: Event type to stop listening for
            callback: Callback function to remove
        """
        if event_type in self._event_callbacks:
            self._event_callbacks[event_type].discard(callback)
            logger.debug(f"Unregistered callback for {event_type}")

    async def start_listener(self) -> None:
        """Start the listener task.

        Creates and starts an async task that listens for WebSocket messages.
        """
        if self._listener_task and not self._listener_task.done():
            logger.warning("Listener task already running")
            return

        self._listener_task = asyncio.create_task(self.listen())
        logger.info("Listener task started")

    async def get_next_message(self) -> Optional[Dict[str, Any]]:
        """Get next message from the message queue.

        Returns:
            Dictionary with 'event_type' and 'data' keys, or None if queue is empty
        """
        try:
            return await asyncio.wait_for(self._message_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            return None

    def is_connected(self) -> bool:
        """Check if WebSocket is connected.

        Returns:
            True if connected, False otherwise
        """
        return self._connected and self._websocket is not None

    async def wait_until_connected(self, timeout: float = 30.0) -> bool:
        """Wait until WebSocket is connected.

        Args:
            timeout: Maximum time to wait in seconds

        Returns:
            True if connected within timeout, False otherwise
        """
        start_time = asyncio.get_event_loop().time()

        while not self.is_connected():
            if asyncio.get_event_loop().time() - start_time > timeout:
                return False
            await asyncio.sleep(0.1)

        return True
