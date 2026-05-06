"""Sessions router for Jellyview API."""
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.session import ActiveSession, SessionHistory
from ..models.user import User
from ..models.item import Item
from ..models.settings import AppSettings
from ..schemas.session import SessionStats
from ..config import settings as app_settings
from ..services.jellyfin import JellyfinClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _get_jellyfin_config(db: Session) -> tuple:
    """Get Jellyfin URL and API key from DB settings or env vars."""
    entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
    if entry:
        try:
            config = json.loads(entry.value)
            return config.get("url", ""), config.get("api_key", "")
        except (json.JSONDecodeError, TypeError):
            pass
    return app_settings.jellyfin_url, app_settings.jellyfin_api_key or ""


def _get_jellyfin_client(db: Session) -> Optional[JellyfinClient]:
    """Get a Jellyfin client from DB settings or env vars."""
    url, api_key = _get_jellyfin_config(db)
    if url and api_key:
        return JellyfinClient(base_url=url, api_key=api_key)
    return None


def _get_jellyfin_url(db: Session) -> str:
    """Get the Jellyfin server base URL."""
    url, _ = _get_jellyfin_config(db)
    return url.rstrip("/") if url else ""


def _map_jellyfin_session(s, db: Session, jellyfin_url: str) -> dict:
    """Map a Jellyfin session dict to the frontend Session format."""
    now_playing = s.get("NowPlayingItem")
    if not now_playing:
        return None

    jellyfin_session_id = s.get("Id", "")
    user_jellyfin_id = s.get("UserId", "")
    username = s.get("UserName", "Unknown")

    # Look up user in DB
    user = None
    if user_jellyfin_id:
        user = db.query(User).filter(User.jellyfin_id == user_jellyfin_id).first()

    # Look up item in DB
    item_jellyfin_id = now_playing.get("Id", "")
    item = None
    if item_jellyfin_id:
        item = db.query(Item).filter(Item.jellyfin_id == item_jellyfin_id).first()

    # Determine state
    play_state = s.get("PlayState", {})
    is_paused = play_state.get("IsPaused", False)
    if is_paused:
        state = "paused"
    else:
        state = "playing"

    # Calculate progress
    position_ticks = play_state.get("PositionTicks", 0)
    runtime_ticks = now_playing.get("RunTimeTicks", 0)
    progress_pct = 0
    if runtime_ticks > 0:
        progress_pct = round((position_ticks / runtime_ticks) * 100, 2)

    # Build avatar URL
    avatar_url = None
    if user and user.avatar_url:
        if user.avatar_url.startswith("/"):
            avatar_url = f"{jellyfin_url.rstrip('/')}{user.avatar_url}"
        elif user.avatar_url.startswith("http"):
            avatar_url = user.avatar_url
    elif user_jellyfin_id:
        primary_tag = s.get("UserPrimaryImageTag")
        if primary_tag:
            avatar_url = f"{jellyfin_url.rstrip('/')}/Users/{user_jellyfin_id}/Images/Primary?format=webp&quality=90&tag={primary_tag}"

    # Build poster/backdrop URLs
    poster_url = None
    backdrop_url = None
    image_tags = now_playing.get("ImageTags", {})
    if image_tags and image_tags.get("Primary"):
        poster_url = f"{jellyfin_url.rstrip('/')}/Items/{item_jellyfin_id}/Images/Primary?format=webp&quality=90&tag={image_tags['Primary']}"
    backdrop_tags = now_playing.get("BackdropImageTags", [])
    if backdrop_tags:
        backdrop_url = f"{jellyfin_url.rstrip('/')}/Items/{item_jellyfin_id}/Images/Backdrop?format=webp&quality=90&tag={backdrop_tags[0]}"

    # Transcode info
    transcode_info = s.get("TranscodingInfo", {})
    is_transcode = bool(transcode_info)
    transcode_hw = None
    transcode_reason = None
    if transcode_info:
        transcode_hw = transcode_info.get("HardwareAccelerationType")
        transcode_reason_list = transcode_info.get("TranscodeReasons", [])
        if isinstance(transcode_reason_list, list):
            transcode_reason = ", ".join(transcode_reason_list)

    # Media type
    media_type = now_playing.get("MediaType", "Video")

    # Bitrate
    bitrate = s.get("Bitrate")
    if transcode_info and not bitrate:
        bitrate = transcode_info.get("Bitrate")

    return {
        "id": jellyfin_session_id,
        "jellyfin_session_id": jellyfin_session_id,
        "user_id": user.id if user else 0,
        "user": {
            "id": user.id if user else 0,
            "username": user.username if user else username,
            "avatar_url": avatar_url,
        },
        "item_id": item.id if item else 0,
        "item": {
            "id": item.id if item else 0,
            "name": now_playing.get("Name", "Unknown"),
            "item_type": now_playing.get("Type", "Unknown"),
            "poster_url": poster_url,
            "backdrop_url": backdrop_url,
            "year": now_playing.get("ProductionYear"),
            "runtime_ticks": runtime_ticks,
        },
        "library_id": None,
        "library": None,
        "state": state,
        "progress_pct": progress_pct,
        "buffer_count": 0,
        "started_at": datetime.utcnow().isoformat(),
        "last_updated": datetime.utcnow().isoformat(),
        "client": s.get("Client", "Unknown"),
        "device": s.get("DeviceName", "Unknown"),
        "device_id": s.get("DeviceId"),
        "ip_address": s.get("RemoteEndPoint"),
        "video_codec": transcode_info.get("VideoCodec") if transcode_info else None,
        "audio_codec": transcode_info.get("AudioCodec") if transcode_info else None,
        "container": now_playing.get("Container"),
        "width": transcode_info.get("Width") if transcode_info else None,
        "height": transcode_info.get("Height") if transcode_info else None,
        "bitrate": bitrate,
        "transcode": is_transcode,
        "transcode_reason": transcode_reason,
        "transcode_hw": transcode_hw,
        "media_type": media_type,
        "series_name": now_playing.get("SeriesName"),
        "season_number": now_playing.get("ParentIndexNumber"),
        "episode_number": now_playing.get("IndexNumber"),
    }


class SessionCommand(BaseModel):
    """Schema for session commands."""
    command: str  # "stop", "pause", "unpause"
    position: Optional[int] = None  # Playback position in ticks


class SessionMessage(BaseModel):
    """Schema for session messages."""
    message: str
    header: Optional[str] = None
    timeout: Optional[int] = None  # Timeout in milliseconds


@router.get("/stats", response_model=SessionStats)
async def get_session_stats(
    db: Session = Depends(get_db),
):
    """Get aggregate session statistics."""
    playing_sessions = 0
    paused_sessions = 0
    buffering_sessions = 0
    transcode_count = 0
    direct_play_count = 0
    total_bandwidth = 0

    jellyfin_client = _get_jellyfin_client(db)
    if jellyfin_client:
        try:
            jellyfin_sessions = await jellyfin_client.get_active_sessions()
            for s in jellyfin_sessions:
                now_playing = s.get("NowPlayingItem")
                if not now_playing:
                    continue

                play_state = s.get("PlayState", {})
                is_paused = play_state.get("IsPaused", False)

                if is_paused:
                    paused_sessions += 1
                else:
                    playing_sessions += 1

                transcode_info = s.get("TranscodingInfo", {})
                if transcode_info:
                    transcode_count += 1
                else:
                    direct_play_count += 1

                bitrate = s.get("Bitrate") or 0
                if transcode_info:
                    bitrate = transcode_info.get("Bitrate") or bitrate
                total_bandwidth += bitrate or 0

            await jellyfin_client.close()
        except Exception as e:
            logger.warning(f"Failed to get live session stats from Jellyfin: {e}")

    # Historical stats from DB
    history_stats = db.query(
        func.count(SessionHistory.id).label("total_plays"),
        func.sum(SessionHistory.duration).label("total_play_time"),
    ).first()

    avg_duration = 0
    if history_stats.total_plays and history_stats.total_plays > 0:
        avg_duration = (history_stats.total_play_time or 0) / history_stats.total_plays

    total_sessions = playing_sessions + paused_sessions + buffering_sessions
    if total_sessions == 0:
        total_sessions = db.query(func.count(ActiveSession.id)).scalar() or 0

    return SessionStats(
        total_sessions=total_sessions,
        active_sessions=playing_sessions,
        playing_sessions=playing_sessions,
        paused_sessions=paused_sessions,
        buffering_sessions=buffering_sessions,
        transcode_count=transcode_count,
        direct_play_count=direct_play_count,
        total_bandwidth=total_bandwidth,
        total_play_time=int(history_stats.total_play_time or 0),
        total_items_played=int(history_stats.total_plays or 0),
        average_session_duration=avg_duration,
    )


@router.get("")
async def list_active_sessions(
    db: Session = Depends(get_db),
):
    """List all active sessions by fetching from Jellyfin API."""
    jellyfin_client = _get_jellyfin_client(db)
    jellyfin_url = _get_jellyfin_url(db)

    if not jellyfin_client:
        return []

    try:
        jellyfin_sessions = await jellyfin_client.get_active_sessions()
    except Exception as e:
        logger.error(f"Failed to fetch sessions from Jellyfin: {e}")
        try:
            await jellyfin_client.close()
        except Exception:
            pass
        return []

    sessions = []
    for s in jellyfin_sessions:
        try:
            session_data = _map_jellyfin_session(s, db, jellyfin_url)
            if session_data:
                sessions.append(session_data)
        except Exception as e:
            logger.warning(f"Error mapping session: {e}")
            continue

    try:
        await jellyfin_client.close()
    except Exception:
        pass

    return sessions


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Get session detail."""
    jellyfin_client = _get_jellyfin_client(db)
    jellyfin_url = _get_jellyfin_url(db)

    if not jellyfin_client:
        raise HTTPException(status_code=503, detail="Jellyfin not configured")

    try:
        jellyfin_sessions = await jellyfin_client.get_active_sessions()
    except Exception as e:
        logger.error(f"Failed to fetch sessions from Jellyfin: {e}")
        try:
            await jellyfin_client.close()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail="Failed to fetch sessions from Jellyfin")

    session_data = None
    for s in jellyfin_sessions:
        if s.get("Id") == session_id:
            session_data = s
            break

    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        await jellyfin_client.close()
    except Exception:
        pass

    result = _map_jellyfin_session(session_data, db, jellyfin_url)
    if not result:
        raise HTTPException(status_code=404, detail="Session has no active playback")

    return result


@router.post("/{session_id}/command")
async def send_session_command(
    session_id: str,
    command: SessionCommand,
    db: Session = Depends(get_db),
):
    """Send playstate command to session."""
    jellyfin_client = _get_jellyfin_client(db)
    if not jellyfin_client:
        raise HTTPException(status_code=503, detail="Jellyfin not configured")

    try:
        jellyfin_command = command.command.capitalize()
        if jellyfin_command not in ("Stop", "Pause", "Unpause"):
            jellyfin_command = "Stop"

        await jellyfin_client.send_session_command(session_id, jellyfin_command)
        await jellyfin_client.close()
        return {
            "status": "success",
            "message": f"Command '{command.command}' sent to session {session_id}",
            "command": command.command,
        }
    except Exception as e:
        try:
            await jellyfin_client.close()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Failed to send command: {e}")


@router.post("/{session_id}/message")
async def send_session_message(
    session_id: str,
    message: SessionMessage,
    db: Session = Depends(get_db),
):
    """Send message to session client."""
    jellyfin_client = _get_jellyfin_client(db)
    if not jellyfin_client:
        raise HTTPException(status_code=503, detail="Jellyfin not configured")

    try:
        await jellyfin_client.send_session_message(
            session_id,
            message.message,
            header=message.header,
            timeout_ms=message.timeout,
        )
        await jellyfin_client.close()
        return {
            "status": "success",
            "message": f"Message sent to session {session_id}",
            "message_content": message.message,
        }
    except Exception as e:
        try:
            await jellyfin_client.close()
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"Failed to send message: {e}")