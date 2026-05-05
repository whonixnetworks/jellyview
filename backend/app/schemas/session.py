"""Session schemas for Jellyview."""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict


class SessionHistoryResponse(BaseModel):
    """Schema for session history response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    jellyfin_id: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = "Unknown"
    item_id: Optional[int] = None
    item_name: Optional[str] = None
    item_type: Optional[str] = None
    library_name: Optional[str] = None
    played_at: Optional[datetime] = None
    playback_duration: int = Field(default=0, description="Playback duration in seconds")
    completed: bool = Field(default=False)
    client_name: Optional[str] = None
    device_name: Optional[str] = None
    media_type: Optional[str] = None


class ActiveSessionResponse(BaseModel):
    """Schema for active/ongoing session response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    jellyfin_session_id: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    item_id: Optional[int] = None
    item_name: Optional[str] = None
    item_type: Optional[str] = None
    started_at: Optional[datetime] = None
    state: Optional[str] = None
    progress_pct: float = Field(default=0)
    client: Optional[str] = None
    device: Optional[str] = None
    media_type: Optional[str] = None
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    container: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    bitrate: Optional[int] = None
    transcode: bool = Field(default=False)
    transcode_reason: Optional[str] = None
    transcode_hw: Optional[str] = None
    last_updated: Optional[datetime] = None


class SessionStats(BaseModel):
    """Schema for session statistics."""
    total_sessions: int = Field(default=0, description="Total number of sessions")
    active_sessions: int = Field(default=0, description="Number of currently active sessions")
    playing_sessions: int = Field(default=0, description="Number of currently playing sessions")
    paused_sessions: int = Field(default=0, description="Number of currently paused sessions")
    buffering_sessions: int = Field(default=0, description="Number of currently buffering sessions")
    transcode_count: int = Field(default=0, description="Number of transcoding sessions")
    direct_play_count: int = Field(default=0, description="Number of direct play sessions")
    total_bandwidth: int = Field(default=0, description="Total bandwidth in bytes per second")
    total_play_time: int = Field(default=0, description="Total play time in seconds")
    total_items_played: int = Field(default=0, description="Total unique items played")
    average_session_duration: float = Field(default=0.0, description="Average session duration in seconds")