from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Index
from app.database import Base


class UserDevice(Base):
    """User devices (tracked from sessions)."""
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    client = Column(String(255), nullable=False)
    device = Column(String(255), nullable=False)
    device_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    last_seen = Column(DateTime, nullable=True)
    play_count = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'device_id', name='uq_user_device'),
        Index('idx_user_devices_user', 'user_id'),
        Index('idx_user_devices_device_id', 'device_id'),
        Index('idx_user_devices_last_seen', 'last_seen'),
    )
