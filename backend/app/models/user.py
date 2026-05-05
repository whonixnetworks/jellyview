from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from app.database import Base


class User(Base):
    """Jellyfin user model synced from Jellyfin server."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jellyfin_id = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    last_active = Column(DateTime, nullable=True)
    avatar_url = Column(String(512), nullable=True)
    total_plays = Column(Integer, default=0, nullable=False)
    total_watch_time = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_users_jellyfin_id', 'jellyfin_id'),
        Index('idx_users_username', 'username'),
        Index('idx_users_last_active', 'last_active'),
    )
