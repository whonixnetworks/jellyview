"""Session polling service for detecting Jellyfin playback events via HTTP.

This is a fallback for when WebSocket events are not available (e.g., Jellyfin 10.9+
with API key authentication). It polls the /Sessions endpoint and detects
playback state changes by comparing session snapshots.
"""
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Set, Callable
from datetime import datetime

from .jellyfin import JellyfinClient

logger = logging.getLogger(__name__)


@dataclass
class SessionState:
    """Snapshot of a Jellyfin session at a point in time."""
    session_id: str
    user_name: Optional[str]
    now_playing_item: Optional[Dict[str, Any]]
    position_ticks: Optional[int]
    is_playing: bool
    is_paused: bool
    play_method: Optional[str]  # 'DirectStream', 'Transcode', 'DirectPlay'
    device_type: Optional[str]
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_session(cls, session: Dict[str, Any]) -> "SessionState":
        play_state = session.get("PlayState", {})
        now_playing = session.get("NowPlayingItem")
        is_playing = play_state.get("IsPlaying", False)
        is_paused = play_state.get("IsPaused", False)
        return cls(
            session_id=session.get("Id", ""),
            user_name=session.get("UserName"),
            now_playing_item=now_playing,
            position_ticks=play_state.get("PositionTicks"),
            is_playing=is_playing,
            is_paused=is_paused,
            play_method=play_state.get("PlayMethod"),
            device_type=session.get("DeviceType"),
        )

    def is_transcoding(self) -> bool:
        return self.play_method == "Transcode"

    def item_key(self) -> str:
        """Unique key for the currently playing item."""
        if not self.now_playing_item:
            return ""
        item_id = self.now_playing_item.get("Id", "")
        media_id = self.now_playing_item.get("MediaSources", [{}])[0].get("Id", "") if self.now_playing_item.get("MediaSources") else ""
        return f"{item_id}:{media_id}"


class SessionPoller:
    """Polls Jellyfin /Sessions API to detect playback state changes.

    Detects:
    - PlaybackStart: session transitions from idle to playing
    - PlaybackStop: session transitions from playing to idle
    - TranscodingStart: playback method changes to Transcode
    - StreamPause / StreamResume: pause state changes
    """

    def __init__(
        self,
        jellyfin_client: JellyfinClient,
        poll_interval: float = 5.0,
    ) -> None:
        """Initialize the session poller.

        Args:
            jellyfin_client: JellyfinClient instance
            poll_interval: Seconds between polls (default 5s)
        """
        self.jellyfin_client = jellyfin_client
        self.poll_interval = poll_interval
        self._previous_states: Dict[str, SessionState] = {}
        self._running = False
        self._stop_event = asyncio.Event()
        self._task: Optional[asyncio.Task] = None

        # Event callbacks: event_type -> set of callbacks
        # Event types mirror WebSocket event names for compatibility
        self._callbacks: Dict[str, Set[Callable]] = {
            "PlaybackStart": set(),
            "PlaybackStopped": set(),
            "PlaybackProgress": set(),
            "SessionStarted": set(),
            "SessionEnded": set(),
        }

    def register_callback(self, event_type: str, callback: Callable) -> None:
        if event_type in self._callbacks:
            self._callbacks[event_type].add(callback)

    def unregister_callback(self, event_type: str, callback: Callable) -> None:
        if event_type in self._callbacks:
            self._callbacks[event_type].discard(callback)

    async def _emit(self, event_type: str, data: Dict[str, Any]) -> None:
        logger.debug(f"Session poller emitting: {event_type}")
        for cb in self._callbacks.get(event_type, set()):
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(data)
                else:
                    cb(data)
            except Exception as e:
                logger.error(f"Error in {event_type} callback: {e}")

    async def start(self) -> None:
        """Start the polling loop."""
        if self._running:
            logger.warning("Session poller already running")
            return
        self._running = True
        self._stop_event.clear()
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(f"Session poller start called, task created: {self._task}")
        import sys
        for h in logger.handlers:
            h.flush()
        sys.stdout.flush()

    async def stop(self) -> None:
        """Stop the polling loop."""
        if not self._running:
            return
        self._running = False
        self._stop_event.set()
        if self._task:
            await self._task
        logger.info("Session poller stopped")

    async def _poll_loop(self) -> None:
        """Main polling loop."""
        logger.info("Session poller _poll_loop starting")
        while not self._stop_event.is_set():
            try:
                logger.debug("Session poller about to call _poll")
                await self._poll()
                logger.debug("Session poller _poll completed")
            except Exception as e:
                logger.error(f"Error in session poll: {e}")
            logger.debug(f"Session poller waiting {self.poll_interval}s")
            await asyncio.wait_for(self._stop_event.wait(), timeout=self.poll_interval)
        logger.info("Session poller _poll_loop exiting")

    async def _poll(self) -> None:
        """Fetch sessions and detect state changes."""
        try:
            sessions = await self.jellyfin_client.get_sessions()
            logger.info(f"Session poller fetched {len(sessions)} sessions")
            current_ids = set()
            new_states: Dict[str, SessionState] = {}

            for session in sessions:
                logger.info(f"Poller raw session: Id={session.get('Id','?')[:8]} User={session.get('UserName','?')} IsPlaying={session.get('PlayState',{}).get('IsPlaying')} PlayMethod={session.get('PlayState',{}).get('PlayMethod')}")
                try:
                    state = SessionState.from_session(session)
                    session_id = state.session_id
                    current_ids.add(session_id)
                    new_states[session_id] = state
                    logger.debug(f"Poller: session {session_id[:8]} is_playing={state.is_playing} play_method={state.play_method}")

                    prev = self._previous_states.get(session_id)

                    if prev is None:
                        # New session appeared
                        # Also emit if play_method is set — Jellyfin may report IsPlaying=None
                        # for active DirectPlay/DirectStream sessions until the first progress update
                        if state.is_playing or state.play_method:
                            logger.info(f"Poller: new playing session {session_id[:8]}, emitting events")
                            await self._emit("SessionStarted", self._session_to_event_data(state, "SessionStarted"))
                            await self._emit("PlaybackStart", self._session_to_event_data(state, "PlaybackStart"))
                            if state.is_transcoding():
                                await self._emit("PlaybackProgress", self._session_to_event_data(state, "transcoding_start"))

                    elif prev is not None and (state.is_playing != prev.is_playing or state.item_key() != prev.item_key()):
                        if state.is_playing and not prev.is_playing:
                            # Started playing (new item or resumed)
                            logger.info(f"Poller: session {session_id[:8]} started playing, emitting PlaybackStart")
                            await self._emit("PlaybackStart", self._session_to_event_data(state, "PlaybackStart"))
                            if state.is_transcoding():
                                await self._emit("PlaybackProgress", self._session_to_event_data(state, "transcoding_start"))
                        elif not state.is_playing and prev.is_playing:
                            # Stopped playing
                            await self._emit("PlaybackStopped", self._session_to_event_data(state, "PlaybackStopped"))

                    elif prev is not None and state.is_playing and prev.is_playing:
                        # Still playing — check for pause/resume and transcoding changes
                        if state.is_paused and not prev.is_paused:
                            await self._emit("PlaybackProgress", self._session_to_event_data(state, "stream_pause"))
                        elif not state.is_paused and prev.is_paused:
                            await self._emit("PlaybackProgress", self._session_to_event_data(state, "stream_resume"))

                        # Check if transcoding started mid-playback
                        if state.is_transcoding() and not prev.is_transcoding():
                            logger.info(f"Poller: session {session_id[:8]} started transcoding")
                            await self._emit("PlaybackProgress", self._session_to_event_data(state, "transcoding_start"))

                        # Ongoing progress (throttled: every 30s of real time)
                        if state.position_ticks:
                            prev_pos = prev.position_ticks or 0
                            # Report progress every ~5min of playback (9M ticks = ~5min)
                            if abs(state.position_ticks - prev_pos) > 9_000_000:
                                await self._emit("PlaybackProgress", self._session_to_event_data(state, "PlaybackProgress"))
                except Exception as e:
                    logger.error(f"Error processing session {session.get('Id', '?')[:8]}: {e}")

            # Detect ended sessions
            for old_id, old_state in list(self._previous_states.items()):
                if old_id not in current_ids and old_state.is_playing:
                    await self._emit("SessionEnded", self._session_to_event_data(old_state, "SessionEnded"))
                    await self._emit("PlaybackStopped", self._session_to_event_data(old_state, "PlaybackStopped"))

            self._previous_states = new_states
        except Exception as e:
            logger.error(f"Error in session poll: {e}")

    def _session_to_event_data(self, state: SessionState, event_subtype: str) -> Dict[str, Any]:
        """Convert a SessionState to event data format matching WebSocket format."""
        return {
            "session_id": state.session_id,
            "user_name": state.user_name,
            "now_playing_item": state.now_playing_item,
            "position_ticks": state.position_ticks,
            "is_playing": state.is_playing,
            "is_paused": state.is_paused,
            "play_method": state.play_method,
            "device_type": state.device_type,
            "_poller_event": event_subtype,
        }
