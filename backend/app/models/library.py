from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base


class Library(Base):
    """Libraries synced from Jellyfin server."""
    __tablename__ = "libraries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jellyfin_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(512), nullable=False)
    item_type = Column(String(100), nullable=True)
    total_items = Column(Integer, default=0, nullable=False)
    total_size = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_libraries_jellyfin_id', 'jellyfin_id'),
        Index('idx_libraries_type', 'item_type'),
        Index('idx_libraries_name', 'name'),
    )
