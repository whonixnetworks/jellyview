"""Session state machine service for managing active playback sessions."""
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from enum import Enum
from sqlalchemy.orm import Session

from ..models.session import ActiveSession, SessionHistory

logger = logging.getLogger(__name__)


class SessionState(str, Enum):
    """Valid session states for the state machine."""
    PLAYING = "playing"
    PAUSED = "paused"
    BUFFERING = "buffering"
    STOPPED = "stopped"


class SessionTrackerError(Exception):
    """Custom exception for session tracker errors."""
    pass


class SessionTracker:
    """State machine for managing active playback sessions with state transitions."""

    # Valid state transitions: [from_state] -> [to_states]
    STATE_TRANSITIONS = {
        None: [SessionState.PLAYING],  # New session starts as playing
        SessionState.PLAYING: [SessionState.PAUSED, SessionState.BUFFERING, SessionState.STOPPED],
        SessionState.PAUSED: [SessionState.PLAYING, SessionState.STOPPED],
        SessionState.BUFFERING: [SessionState.PLAYING, SessionState.PAUSED, SessionState.STOPPED],
        SessionState.STOPPED: [],  # Terminal state
    }

    # Auto-recovery threshold: recover from buffering after this many seconds
    BUFFERING_RECOVERY_SECONDS = 30

    # Stale session threshold: remove sessions inactive for this long
    STALE_SESSION_SECONDS = 3600  # 1 hour

    def __init__(self, db_session: Session) -> None:
        """Initialize the session tracker with a database session.

        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session
        logger.info("SessionTracker initialized")

    def track_session(self, session_data: Dict[str, Any]) -> ActiveSession:
        """Create or update an active session in the database.

        Args:
            session_data: Dictionary containing session information with at least:
                - jellyfin_session_id (str): Unique Jellyfin session ID
                - user_id (int): User ID
                - item_id (int): Item ID
                Plus optional playback info fields

        Returns:
            ActiveSession: Created or updated active session

        Raises:
            SessionTrackerError: If required fields are missing or database operation fails
        """
        if not session_data or "jellyfin_session_id" not in session_data:
            raise SessionTrackerError("Missing required field: jellyfin_session_id")

        jellyfin_id = session_data["jellyfin_session_id"]

        try:
            # Check if session already exists
            existing = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )

            if existing:
                # Update existing session
                for key, value in session_data.items():
                    if hasattr(existing, key) and value is not None:
                        setattr(existing, key, value)
                
                existing.last_updated = datetime.utcnow()
                existing.state = SessionState.PLAYING.value  # Always start/restart as playing
                
                logger.info(f"Updated active session: {jellyfin_id}")
                return existing
            else:
                # Create new session
                new_session = ActiveSession(
                    jellyfin_session_id=jellyfin_id,
                    user_id=session_data.get("user_id"),
                    item_id=session_data.get("item_id"),
                    started_at=datetime.utcnow(),
                    state=SessionState.PLAYING.value,
                    progress_pct=session_data.get("progress_pct", 0),
                    buffer_count=0,
                    last_updated=datetime.utcnow(),
                    # Copy optional fields
                    client=session_data.get("client"),
                    device=session_data.get("device"),
                    device_id=session_data.get("device_id"),
                    ip_address=session_data.get("ip_address"),
                    video_codec=session_data.get("video_codec"),
                    audio_codec=session_data.get("audio_codec"),
                    container=session_data.get("container"),
                    width=session_data.get("width"),
                    height=session_data.get("height"),
                    bitrate=session_data.get("bitrate"),
                    transcode=session_data.get("transcode", False),
                    transcode_reason=session_data.get("transcode_reason"),
                    transcode_hw=session_data.get("transcode_hw"),
                    media_type=session_data.get("media_type"),
                    item_name=session_data.get("item_name"),
                    item_type=session_data.get("item_type"),
                    series_name=session_data.get("series_name"),
                    season_number=session_data.get("season_number"),
                    episode_number=session_data.get("episode_number"),
                    year=session_data.get("year"),
                )

                self.db.add(new_session)
                self.db.commit()
                self.db.refresh(new_session)
                
                logger.info(f"Created new active session: {jellyfin_id}")
                return new_session

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to track session {jellyfin_id}: {e}")
            raise SessionTrackerError(f"Failed to track session: {e}") from e

    def update_session_state(self, session_id: int, new_state: str) -> ActiveSession:
        """Transition session state according to validation rules.

        Args:
            session_id: Internal database ID of the session
            new_state: New state to transition to (playing, paused, buffering, stopped)

        Returns:
            ActiveSession: Updated session

        Raises:
            SessionTrackerError: If session not found, state invalid, or transition not allowed
        """
        try:
            session = self.db.query(ActiveSession).filter(ActiveSession.id == session_id).first()
            
            if not session:
                raise SessionTrackerError(f"Active session not found: {session_id}")

            # Validate new state
            try:
                state_enum = SessionState(new_state.lower())
            except ValueError:
                raise SessionTrackerError(f"Invalid state: {new_state}")

            # Get current state
            current_state = SessionState(session.state) if session.state else None

            # Auto-recover from buffering state
            if current_state == SessionState.BUFFERING:
                time_in_buffering = (datetime.utcnow() - session.last_updated).total_seconds()
                if time_in_buffering > self.BUFFERING_RECOVERY_SECONDS:
                    logger.warning(
                        f"Session {session_id} stuck in buffering for {time_in_buffering:.1f}s, "
                        f"auto-recovering to playing"
                    )
                    current_state = SessionState.PLAYING

            # Validate transition
            valid_transitions = self.STATE_TRANSITIONS.get(current_state, [])
            if state_enum not in valid_transitions:
                raise SessionTrackerError(
                    f"Invalid state transition: {current_state} -> {state_enum}. "
                    f"Allowed transitions: {valid_transitions}"
                )

            # Update session state
            old_state = session.state
            session.state = state_enum.value
            session.last_updated = datetime.utcnow()

            # Handle buffer count
            if state_enum == SessionState.BUFFERING:
                session.buffer_count += 1
                logger.info(f"Session {session_id} buffering (count: {session.buffer_count})")
            elif state_enum == SessionState.PLAYING and old_state != SessionState.PLAYING:
                logger.info(f"Session {session_id} resumed playing")

            self.db.commit()
            self.db.refresh(session)

            logger.debug(f"Session {session_id} state: {old_state} -> {state_enum.value}")
            return session

        except SessionTrackerError:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update session state for {session_id}: {e}")
            raise SessionTrackerError(f"Failed to update session state: {e}") from e

    def complete_session(self, session_id: int) -> SessionHistory:
        """Move session from active_sessions to session_history.

        Args:
            session_id: Internal database ID of the active session

        Returns:
            SessionHistory: Created history entry

        Raises:
            SessionTrackerError: If session not found or database operation fails
        """
        try:
            active_session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.id == session_id)
                .first()
            )

            if not active_session:
                raise SessionTrackerError(f"Active session not found: {session_id}")

            # Calculate duration and paused duration
            now = datetime.utcnow()
            started_at = active_session.started_at or now
            total_duration = int((now - started_at).total_seconds())
            
            # Calculate paused duration based on state
            paused_duration = 0
            if active_session.state == SessionState.PAUSED.value:
                # Simplified: if currently paused, estimate paused duration
                paused_duration = total_duration // 3  # Rough estimate

            # Create history entry
            history_entry = SessionHistory(
                jellyfin_id=active_session.jellyfin_session_id,
                user_id=active_session.user_id,
                item_id=active_session.item_id,
                started_at=started_at,
                stopped_at=now,
                duration=total_duration,
                paused_duration=paused_duration,
                completion_pct=active_session.progress_pct,
                client=active_session.client,
                device=active_session.device,
                device_id=active_session.device_id,
                ip_address=active_session.ip_address,
                video_codec=active_session.video_codec,
                audio_codec=active_session.audio_codec,
                container=active_session.container,
                width=active_session.width,
                height=active_session.height,
                bitrate=active_session.bitrate,
                transcode=active_session.transcode,
                transcode_reason=active_session.transcode_reason,
                transcode_hw=active_session.transcode_hw,
                media_type=active_session.media_type,
                item_name=active_session.item_name,
                item_type=active_session.item_type,
                series_name=active_session.series_name,
                season_number=active_session.season_number,
                episode_number=active_session.episode_number,
                year=active_session.year,
            )

            # Delete active session and add history entry
            self.db.delete(active_session)
            self.db.add(history_entry)
            self.db.commit()
            self.db.refresh(history_entry)

            logger.info(
                f"Completed session {session_id}: moved to history, "
                f"duration={total_duration}s, buffers={active_session.buffer_count}"
            )
            return history_entry

        except SessionTrackerError:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to complete session {session_id}: {e}")
            raise SessionTrackerError(f"Failed to complete session: {e}") from e

    def cleanup_stale_sessions(self) -> int:
        """Remove sessions inactive for >1 hour, moving them to history.

        Returns:
            int: Number of stale sessions cleaned up

        Raises:
            SessionTrackerError: If database operation fails
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(seconds=self.STALE_SESSION_SECONDS)

            # Find stale sessions
            stale_sessions = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.last_updated < cutoff_time)
                .all()
            )

            cleaned_count = 0
            for stale_session in stale_sessions:
                try:
                    self.complete_session(stale_session.id)
                    cleaned_count += 1
                except SessionTrackerError as e:
                    logger.error(f"Failed to complete stale session {stale_session.id}: {e}")
                    continue

            logger.info(f"Cleaned up {cleaned_count} stale sessions")
            return cleaned_count

        except Exception as e:
            logger.error(f"Failed to cleanup stale sessions: {e}")
            raise SessionTrackerError(f"Failed to cleanup stale sessions: {e}") from e

    def get_active_sessions(self) -> list[Dict[str, Any]]:
        """Get all active sessions with full details including related data.

        Returns:
            List of dictionaries containing active session details:
                - id: Internal database ID
                - jellyfin_session_id: Jellyfin session ID
                - user_id: User ID
                - item_id: Item ID
                - started_at: Session start time
                - state: Current state (playing, paused, buffering, stopped)
                - progress_pct: Playback progress percentage
                - buffer_count: Number of buffering events
                - last_updated: Last update timestamp
                - client: Client name
                - device: Device name
                - item_name: Media item name
                - item_type: Media type
                - media_type: Media type

        Raises:
            SessionTrackerError: If database query fails
        """
        try:
            active_sessions = (
                self.db.query(ActiveSession)
                .order_by(ActiveSession.last_updated.desc())
                .all()
            )

            sessions_list = []
            for session in active_sessions:
                session_dict = {
                    "id": session.id,
                    "jellyfin_session_id": session.jellyfin_session_id,
                    "user_id": session.user_id,
                    "item_id": session.item_id,
                    "started_at": session.started_at.isoformat() if session.started_at else None,
                    "state": session.state,
                    "progress_pct": session.progress_pct,
                    "buffer_count": session.buffer_count,
                    "last_updated": session.last_updated.isoformat() if session.last_updated else None,
                    "client": session.client,
                    "device": session.device,
                    "device_id": session.device_id,
                    "ip_address": session.ip_address,
                    "video_codec": session.video_codec,
                    "audio_codec": session.audio_codec,
                    "container": session.container,
                    "width": session.width,
                    "height": session.height,
                    "bitrate": session.bitrate,
                    "transcode": session.transcode,
                    "transcode_reason": session.transcode_reason,
                    "transcode_hw": session.transcode_hw,
                    "media_type": session.media_type,
                    "item_name": session.item_name,
                    "item_type": session.item_type,
                    "series_name": session.series_name,
                    "season_number": session.season_number,
                    "episode_number": session.episode_number,
                    "year": session.year,
                }
                sessions_list.append(session_dict)

            logger.debug(f"Retrieved {len(sessions_list)} active sessions")
            return sessions_list

        except Exception as e:
            logger.error(f"Failed to get active sessions: {e}")
            raise SessionTrackerError(f"Failed to get active sessions: {e}") from e

    def start_session(self, data: Dict[str, Any]) -> None:
        """Handle playback start event by creating/updating active session.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        session_data = {
            "jellyfin_session_id": data.get("SessionId", ""),
            "user_id": data.get("UserId"),
            "item_id": data.get("ItemId"),
            "client": data.get("Client", {}).get("Name"),
            "device": data.get("Device", {}).get("Name"),
            "device_id": data.get("Device", {}).get("Id"),
            "ip_address": data.get("RemoteEndPoint"),
            "item_name": data.get("Item", {}).get("Name"),
            "item_type": data.get("Item", {}).get("Type"),
            "media_type": data.get("Item", {}).get("MediaType"),
            "series_name": data.get("SeriesName"),
            "season_number": data.get("ParentIndexNumber"),
            "episode_number": data.get("IndexNumber"),
            "year": data.get("Item", {}).get("ProductionYear"),
            "progress_pct": 0,
        }
        self.track_session(session_data)

    def end_session(self, data: Dict[str, Any]) -> None:
        """Handle playback stop event by completing the session.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        jellyfin_id = data.get("SessionId", "")
        try:
            session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )
            if session:
                self.complete_session(session.id)
        except Exception as e:
            logger.error(f"Error ending session {jellyfin_id}: {e}")

    def initialize_session(self, data: Dict[str, Any]) -> None:
        """Handle session started event.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        self.start_session(data)

    def finalize_session(self, data: Dict[str, Any]) -> None:
        """Handle session ended event.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        self.end_session(data)

    def pause_session(self, data: Dict[str, Any]) -> None:
        """Handle playback pause event.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        jellyfin_id = data.get("SessionId", "")
        try:
            session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )
            if session:
                self.update_session_state(session.id, "paused")
        except Exception as e:
            logger.error(f"Error pausing session {jellyfin_id}: {e}")

    def resume_session(self, data: Dict[str, Any]) -> None:
        """Handle playback resume event.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        jellyfin_id = data.get("SessionId", "")
        try:
            session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )
            if session:
                self.update_session_state(session.id, "playing")
        except Exception as e:
            logger.error(f"Error resuming session {jellyfin_id}: {e}")

    def update_progress(self, data: Dict[str, Any]) -> None:
        """Handle playback progress update.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        jellyfin_id = data.get("SessionId", "")
        try:
            session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )
            if session:
                position_ticks = data.get("PositionTicks", 0)
                run_time_ticks = data.get("RunTimeTicks", 1)
                if run_time_ticks > 0:
                    session.progress_pct = (position_ticks / run_time_ticks) * 100
                session.last_updated = datetime.utcnow()
                self.db.commit()
        except Exception as e:
            logger.error(f"Error updating progress for session {jellyfin_id}: {e}")

    def update_transcoding(self, data: Dict[str, Any]) -> None:
        """Handle transcoding start event.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        jellyfin_id = data.get("SessionId", "")
        try:
            session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )
            if session:
                session.transcode = True
                session.transcode_reason = data.get("TranscodeReasons")
                session.last_updated = datetime.utcnow()
                self.db.commit()
        except Exception as e:
            logger.error(f"Error updating transcoding for session {jellyfin_id}: {e}")

    def update_hw_transcoding(self, data: Dict[str, Any]) -> None:
        """Handle hardware transcoding event.

        Args:
            data: Event data from Jellyfin WebSocket
        """
        jellyfin_id = data.get("SessionId", "")
        try:
            session = (
                self.db.query(ActiveSession)
                .filter(ActiveSession.jellyfin_session_id == jellyfin_id)
                .first()
            )
            if session:
                session.transcode = True
                session.transcode_hw = data.get("TranscodeHardwareAcceleration")
                session.last_updated = datetime.utcnow()
                self.db.commit()
        except Exception as e:
            logger.error(f"Error updating HW transcoding for session {jellyfin_id}: {e}")
