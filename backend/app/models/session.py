from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database import Base


class SessionHistory(Base):
    """Playback session history (permanent record)."""
    __tablename__ = "session_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jellyfin_id = Column(String(255), unique=True, nullable=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='SET NULL'), nullable=True)
    library_id = Column(Integer, ForeignKey('libraries.id', ondelete='SET NULL'), nullable=True)
    started_at = Column(DateTime, nullable=False, index=True)
    stopped_at = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)
    paused_duration = Column(Integer, default=0, nullable=False)
    play_count = Column(Integer, default=1, nullable=False)
    completion_pct = Column(Float, nullable=True)

    # Playback info
    client = Column(String(255), nullable=True)
    device = Column(String(255), nullable=True)
    device_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)

    # Stream quality
    video_codec = Column(String(50), nullable=True)
    audio_codec = Column(String(50), nullable=True)
    container = Column(String(50), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    bitrate = Column(Integer, nullable=True)
    transcode = Column(Boolean, default=False, nullable=False)
    transcode_reason = Column(String(255), nullable=True)
    transcode_hw = Column(String(50), nullable=True)

    # Metadata
    media_type = Column(String(50), nullable=True)
    item_name = Column(String(512), nullable=True)
    item_type = Column(String(50), nullable=True)
    series_name = Column(String(512), nullable=True)
    season_number = Column(Integer, nullable=True)
    episode_number = Column(Integer, nullable=True)
    year = Column(Integer, nullable=True)

    # Jellyfin specific
    playback_position_ticks = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_session_history_user', 'user_id'),
        Index('idx_session_history_item', 'item_id'),
        Index('idx_session_history_started', 'started_at'),
        Index('idx_session_history_library', 'library_id'),
    )


class ActiveSession(Base):
    """Active sessions (temporary, real-time)."""
    __tablename__ = "active_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jellyfin_session_id = Column(String(255), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    item_id = Column(Integer, ForeignKey('items.id', ondelete='SET NULL'), nullable=True)

    # Playback info (same as session_history)
    started_at = Column(DateTime, nullable=True)
    client = Column(String(255), nullable=True)
    device = Column(String(255), nullable=True)
    device_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    video_codec = Column(String(50), nullable=True)
    audio_codec = Column(String(50), nullable=True)
    container = Column(String(50), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    bitrate = Column(Integer, nullable=True)
    transcode = Column(Boolean, default=False, nullable=False)
    transcode_reason = Column(String(255), nullable=True)
    transcode_hw = Column(String(50), nullable=True)
    media_type = Column(String(50), nullable=True)
    item_name = Column(String(512), nullable=True)
    item_type = Column(String(50), nullable=True)
    series_name = Column(String(512), nullable=True)
    season_number = Column(Integer, nullable=True)
    episode_number = Column(Integer, nullable=True)
    year = Column(Integer, nullable=True)

    # Live state fields
    state = Column(String(50), default='playing', nullable=False)
    progress_pct = Column(Float, default=0, nullable=False)
    buffer_count = Column(Integer, default=0, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_active_sessions_state', 'state'),
        Index('idx_active_sessions_user', 'user_id'),
        Index('idx_active_sessions_jellyfin_id', 'jellyfin_session_id'),
    )
