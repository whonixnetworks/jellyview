"""Activity processor service for handling Jellyfin WebSocket events."""
import logging
from typing import Any, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ActivityProcessor:
    """Processes activity events from Jellyfin WebSocket.

    This class handles incoming events from the WebSocket listener,
    coordinates with the session tracker for state updates,
    triggers notifications via the dispatcher, and logs all activities.
    """

    # Event types from Jellyfin WebSocket
    EVENT_STREAM_START = "PlaybackStart"
    EVENT_STREAM_STOP = "PlaybackStopped"
    EVENT_STREAM_PAUSE = "PlaybackProgress"  # Jellyfin sends progress with pause state
    EVENT_STREAM_RESUME = "PlaybackProgress"  # Jellyfin sends progress with resume state
    EVENT_TRANSCODING_START = "PlaybackProgress"
    EVENT_TRANSCODING_HW = "PlaybackProgress"
    EVENT_ITEM_ADDED = "LibraryAdded"
    EVENT_USER_CREATED = "UserAdded"
    EVENT_SERVER_UPDATE_AVAILABLE = "ServerRestarting"
    EVENT_SERVER_DOWN = "ServerRestarting"
    EVENT_SERVER_UP = "ServerRestartCompleted"

    def __init__(
        self,
        session_tracker: Optional[Any] = None,
        notification_dispatcher: Optional[Any] = None,
    ) -> None:
        """Initialize the activity processor.

        Args:
            session_tracker: Session tracker instance for managing session state
            notification_dispatcher: Notification dispatcher for sending notifications
        """
        self.session_tracker = session_tracker
        self.notification_dispatcher = notification_dispatcher
        logger.info("ActivityProcessor initialized")

    def process_event(self, event_type: str, event_data: Dict[str, Any]) -> bool:
        """Main event processing method.

        Routes events to appropriate handler methods based on event type.

        Args:
            event_type: Type of event (e.g., PlaybackStart, PlaybackStopped)
            event_data: Event data dictionary containing event details

        Returns:
            True if event was processed successfully, False otherwise
        """
        try:
            logger.debug(f"Processing event: {event_type}")

            # Route event to appropriate handler
            if event_type == "PlaybackStart":
                self.handle_playback_start(event_data)
            elif event_type == "PlaybackStopped":
                self.handle_playback_stop(event_data)
            elif event_type == "PlaybackProgress":
                self.handle_playback_progress(event_data)
            elif event_type == "SessionStarted":
                self.handle_session_started(event_data)
            elif event_type == "SessionEnded":
                self.handle_session_ended(event_data)
            elif event_type == "LibraryAdded":
                self.handle_item_added(event_data)
            elif event_type == "UserAdded":
                self.handle_user_created(event_data)
            elif event_type == "ServerRestarting":
                self.handle_server_down(event_data)
            elif event_type == "ServerRestartCompleted":
                self.handle_server_up(event_data)
            else:
                logger.warning(f"Unknown event type: {event_type}")
                return False

            # Log activity
            self._log_activity(event_type, event_data)

            # Trigger notifications (async — schedule as task if in async context)
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self.trigger_notifications(event_type, event_data))
            except RuntimeError:
                # No running loop, run synchronously
                asyncio.run(self.trigger_notifications(event_type, event_data))

            logger.info(f"Successfully processed event: {event_type}")
            return True

        except Exception as e:
            logger.error(f"Error processing event {event_type}: {e}", exc_info=True)
            return False

    def handle_playback_start(self, data: Dict[str, Any]) -> None:
        """Process playback start event.

        Args:
            data: Playback event data including session info, user, item, etc.
        """
        logger.debug(f"Handling playback start: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.start_session(data)
                logger.debug("Session tracker updated for playback start")
            except Exception as e:
                logger.error(f"Error updating session tracker for playback start: {e}")

        # Also handle session started
        self.handle_session_started(data)

    def handle_playback_progress(self, data: Dict[str, Any]) -> None:
        """Process playback progress updates.

        Handles pause, resume, and transcoding state changes.

        Args:
            data: Progress event data with position ticks, duration, etc.
        """
        logger.debug(f"Handling playback progress: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.update_progress(data)
                logger.debug("Session tracker updated for progress")
            except Exception as e:
                logger.error(f"Error updating session tracker for progress: {e}")

        # Check for pause/resume state and fire sub-event notifications
# Support both Jellyfin WebSocket format (EventName="pause"/"unpause") and
        # session poller format (is_paused=bool in PlaybackProgress events)
        event_name = data.get("EventName") or data.get("event_name") or ""
        if event_name == "pause":
            self.handle_playback_pause(data)
            self._fire_sub_event_notification("stream_pause", data)
        elif event_name == "unpause":
            self.handle_playback_resume(data)
            self._fire_sub_event_notification("stream_resume", data)

        # Check for transcoding and fire transcode notification
        play_method = data.get("PlayMethod")
        if play_method == "Transcode":
            transcode_reasons = data.get("TranscodeReasons", "")
            if "HardwareAcceleration" in str(transcode_reasons) or "HW" in str(transcode_reasons):
                self.handle_transcoding_hw(data)
                self._fire_sub_event_notification("transcoding_hw", data)
            else:
                self.handle_transcoding_start(data)
                self._fire_sub_event_notification("transcoding_start", data)

    def _fire_sub_event_notification(self, notification_type: str, data: Dict[str, Any]) -> None:
        """Fire a notification for a sub-event detected within PlaybackProgress.

        This is called in addition to the main PlaybackProgress notification,
        so rules matching more specific events like transcoding_start also fire.

        Args:
            notification_type: The notification event type (e.g., 'transcoding_start')
            data: The original event data
        """
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.trigger_notifications_direct(notification_type, data))
        except RuntimeError:
            asyncio.run(self.trigger_notifications_direct(notification_type, data))

    async def trigger_notifications_direct(self, event_type: str, data: Dict[str, Any]) -> None:
        """Send a notification with an already-mapped event type (no Jellyfin mapping).

        Unlike trigger_notifications, this does not apply EVENT_TYPE_MAP.
        Data keys are still normalized for template variable substitution.

        Args:
            event_type: Already-mapped notification event type (e.g., 'transcoding_start')
            data: Event data to send to notifiers
        """
        if not self.notification_dispatcher:
            logger.debug("No notification dispatcher configured, skipping notifications")
            return

        # Normalize data keys for template variables
        normalized_data = self._normalize_event_data(data)

        try:
            result = await self.notification_dispatcher.dispatch(event_type, normalized_data)
            logger.debug(f"Triggered direct notification for {event_type}: {result}")
        except Exception as e:
            logger.error(f"Error triggering direct notification for {event_type}: {e}")

    def handle_playback_stop(self, data: Dict[str, Any]) -> None:
        """Process playback stop event.

        Args:
            data: Stop event data including final position and duration
        """
        logger.debug(f"Handling playback stop: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.end_session(data)
                logger.debug("Session tracker updated for playback stop")
            except Exception as e:
                logger.error(f"Error updating session tracker for playback stop: {e}")

        # Also handle session ended
        self.handle_session_ended(data)

    def handle_session_started(self, data: Dict[str, Any]) -> None:
        """Process session start event.

        Args:
            data: Session event data including user, device, connection info
        """
        logger.debug(f"Handling session started: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.initialize_session(data)
                logger.debug("Session tracker initialized for session start")
            except Exception as e:
                logger.error(f"Error initializing session tracker for session start: {e}")

    def handle_session_ended(self, data: Dict[str, Any]) -> None:
        """Process session end event.

        Args:
            data: Session end event data with session details
        """
        logger.debug(f"Handling session ended: {data.get('SessionId', 'unknown')}")

        # Session ended is handled by playback_stop, but can be called independently
        if self.session_tracker:
            try:
                self.session_tracker.finalize_session(data)
                logger.debug("Session tracker finalized for session end")
            except Exception as e:
                logger.error(f"Error finalizing session tracker for session end: {e}")

    def handle_playback_pause(self, data: Dict[str, Any]) -> None:
        """Process playback pause event.

        Args:
            data: Pause event data with session info
        """
        logger.debug(f"Handling playback pause: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.pause_session(data)
                logger.debug("Session tracker updated for pause")
            except Exception as e:
                logger.error(f"Error updating session tracker for pause: {e}")

    def handle_playback_resume(self, data: Dict[str, Any]) -> None:
        """Process playback resume event.

        Args:
            data: Resume event data with session info
        """
        logger.debug(f"Handling playback resume: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.resume_session(data)
                logger.debug("Session tracker updated for resume")
            except Exception as e:
                logger.error(f"Error updating session tracker for resume: {e}")

    def handle_transcoding_start(self, data: Dict[str, Any]) -> None:
        """Process transcoding start event.

        Args:
            data: Transcoding event data with codec info, hardware accel, etc.
        """
        logger.debug(f"Handling transcoding start: {data.get('SessionId', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.update_transcoding(data)
                logger.debug("Session tracker updated for transcoding start")
            except Exception as e:
                logger.error(f"Error updating session tracker for transcoding: {e}")

    def handle_transcoding_hw(self, data: Dict[str, Any]) -> None:
        """Process hardware transcoding event.

        Args:
            data: Hardware transcoding event data with transcode hw type
        """
        logger.debug(f"Handling hardware transcoding: {data.get('TranscodeReason', 'unknown')}")

        # Update session tracker if available
        if self.session_tracker:
            try:
                self.session_tracker.update_hw_transcoding(data)
                logger.debug("Session tracker updated for hardware transcoding")
            except Exception as e:
                logger.error(f"Error updating session tracker for hardware transcoding: {e}")

    def handle_item_added(self, data: Dict[str, Any]) -> None:
        """Process item added event.

        Args:
            data: Item event data with item details, library info, etc.
        """
        logger.debug(f"Handling item added: {data.get('Name', 'unknown')}")

        # Item events don't affect session tracker
        # They may trigger notifications for new content alerts

    def handle_user_created(self, data: Dict[str, Any]) -> None:
        """Process user created event.

        Args:
            data: User event data with username, user ID, etc.
        """
        logger.debug(f"Handling user created: {data.get('Name', 'unknown')}")

        # User events don't affect session tracker
        # They may trigger notifications for new user alerts

    def handle_server_update_available(self, data: Dict[str, Any]) -> None:
        """Process server update available event.

        Args:
            data: Server event data with new version information
        """
        logger.debug("Handling server update available")

        # Server events don't affect session tracker
        # They may trigger notifications for update alerts

    def handle_server_down(self, data: Dict[str, Any]) -> None:
        """Process server down event.

        Args:
            data: Server event data with error information
        """
        logger.warning("Handling server down - Jellyfin server unreachable")

        # Server events don't affect session tracker
        # They may trigger notifications for server down alerts

    def handle_server_up(self, data: Dict[str, Any]) -> None:
        """Process server up event.

        Args:
            data: Server event data with server information
        """
        logger.info("Handling server up - Jellyfin server back online")

        # Server events don't affect session tracker
        # They may trigger notifications for server up alerts

    # Map Jellyfin WebSocket event types to notification rule event types
    EVENT_TYPE_MAP = {
        "PlaybackStart": "stream_start",
        "PlaybackStopped": "stream_stop",
        "PlaybackProgress": "stream_progress",
        "SessionStarted": "session_start",
        "SessionEnded": "session_end",
        "LibraryAdded": "item_added",
        "LibraryUpdated": "library_updated",
        "LibraryRemoved": "library_removed",
        "UserAdded": "user_created",
        "UserUpdated": "user_updated",
        "UserDeleted": "user_deleted",
        "UserPasswordChanged": "user_password_changed",
        "ServerRestarting": "server_down",
        "ServerRestartCompleted": "server_up",
    }

    # Sub-events detected within PlaybackProgress and mapped to notification types
    PROGRESS_SUB_EVENT_MAP = {
        "pause": "stream_pause",
        "unpause": "stream_resume",
        "transcode": "transcoding_start",
        "transcode_hw": "transcoding_hw",
    }

    # Normalize Jellyfin WebSocket data keys to template-friendly variable names
    # Maps Jellyfin PascalCase keys to snake_case template variables
    DATA_KEY_MAP = {
        "UserName": "username",
        "UserId": "user_id",
        "ItemName": "item_title",
        "ItemType": "item_type",
        "ItemId": "item_id",
        "SessionId": "session_id",
        "PlayMethod": "play_method",
        "TranscodeReasons": "transcode_reasons",
        "NowPlayingItem": "now_playing_item",
        "LibraryName": "library_name",
        "DeviceName": "device_name",
        "ClientName": "client_name",
        "ApplicationName": "application_name",
        "TranscodingInfo": "transcoding_info",
    }

    def _normalize_event_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize Jellyfin event data to include template-friendly keys.

        Adds snake_case keys alongside the original PascalCase keys so that
        templates like {username}, {item_title}, etc. resolve correctly.

        Args:
            data: Raw Jellyfin WebSocket event data

        Returns:
            Data dict with additional normalized keys
        """
        result = dict(data)

        # Map top-level Jellyfin keys to template variable names.
        # Support BOTH PascalCase (Jellyfin WebSocket) and snake_case (session poller).
        for jellyfin_key, template_var in self.DATA_KEY_MAP.items():
            if jellyfin_key in data and template_var not in result:
                result[template_var] = data[jellyfin_key]
        # Also map snake_case input keys that aren't in DATA_KEY_MAP
        REVERSE_KEY_MAP = {
            "user_name": "username",
            "now_playing_item": "now_playing_item",
            "play_method": "play_method",
        }
        for snake_key, template_var in REVERSE_KEY_MAP.items():
            if snake_key in data and template_var not in result:
                result[template_var] = data[snake_key]

        # Extract transcoding details for template variables
        # Check both PascalCase (WebSocket) and snake_case (session poller)
        play_method = data.get("PlayMethod") or data.get("play_method") or ""
        if play_method == "Transcode":
            result["transcode_codec"] = ""
            result["hw_accel"] = ""

            transcode_info = data.get("TranscodingInfo", {})
            if isinstance(transcode_info, dict):
                result["transcode_codec"] = transcode_info.get("VideoCodec", transcode_info.get("AudioCodec", ""))
                hw_type = transcode_info.get("HardwareAccelerationType", "")
                if hw_type:
                    result["hw_accel"] = hw_type

            # Also check TranscodeReasons for HW accel info
            transcode_reasons = str(data.get("TranscodeReasons", ""))
            if "HardwareAcceleration" in transcode_reasons or "HW" in transcode_reasons:
                if not result["hw_accel"]:
                    result["hw_accel"] = "Hardware"

        # Flatten NowPlayingItem if present (Jellyfin sends item details nested).
        # Support both PascalCase (WebSocket) and snake_case (session poller).
        now_playing = data.get("NowPlayingItem") or data.get("now_playing_item") or {}
        if isinstance(now_playing, dict) and now_playing:
            if "Name" in now_playing and "item_title" not in result:
                result["item_title"] = now_playing["Name"]
            if "Type" in now_playing and "item_type" not in result:
                result["item_type"] = now_playing["Type"]
            if "Id" in now_playing and "item_id" not in result:
                result["item_id"] = now_playing["Id"]
            if "SeriesName" in now_playing:
                result["series_name"] = now_playing["SeriesName"]
                result["item_title"] = f"{now_playing['SeriesName']} - {now_playing.get('Name', '')}"

        return result

    async def trigger_notifications(self, event_type: str, data: Dict[str, Any]) -> None:
        """Send event to notification dispatcher for matching rules.

        Maps Jellyfin event types (e.g., PlaybackStart) to notification
        event types (e.g., stream_start) and normalizes data keys for
        template variable substitution.

        Args:
            event_type: Type of event to dispatch
            data: Event data to send to notifiers
        """
        if not self.notification_dispatcher:
            logger.debug("No notification dispatcher configured, skipping notifications")
            return

        # Map Jellyfin event type to notification event type
        notification_event_type = self.EVENT_TYPE_MAP.get(event_type, event_type.lower())

        # Normalize data keys for template variables
        normalized_data = self._normalize_event_data(data)

        try:
            result = await self.notification_dispatcher.dispatch(notification_event_type, normalized_data)
            logger.debug(f"Triggered notifications for event {event_type} -> {notification_event_type}: {result}")
        except Exception as e:
            logger.error(f"Error triggering notifications for event {event_type}: {e}")

    def _log_activity(self, event_type: str, data: Dict[str, Any]) -> None:
        """Log activity event for audit trail.

        Args:
            event_type: Type of event
            data: Event data
        """
        # Extract relevant info for logging
        session_id = data.get("SessionId", "N/A")
        user = data.get("UserName", data.get("UserId", "N/A"))
        item = data.get("ItemName", "N/A")

        log_data = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": session_id,
            "user": user,
            "item": item,
            "data": data,
        }

        logger.info(f"Activity logged: {event_type} | User: {user} | Item: {item} | Session: {session_id}")
