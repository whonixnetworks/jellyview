from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from app.database import Base


class Item(Base):
    """Media items synced from Jellyfin server."""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jellyfin_id = Column(String(255), unique=True, nullable=False, index=True)
    library_id = Column(Integer, ForeignKey('libraries.id', ondelete='SET NULL'), nullable=True)
    item_type = Column(String(100), nullable=False)
    name = Column(String(512), nullable=False)
    sort_name = Column(String(512), nullable=True)
    year = Column(Integer, nullable=True)
    premiere_date = Column(DateTime, nullable=True)
    rating = Column(Float, nullable=True)
    community_rating = Column(Float, nullable=True)
    official_rating = Column(String(50), nullable=True)
    runtime_ticks = Column(Integer, nullable=True)
    genres = Column(String(1024), nullable=True)
    studios = Column(String(1024), nullable=True)
    poster_url = Column(String(512), nullable=True)
    backdrop_url = Column(String(512), nullable=True)
    series_id = Column(Integer, ForeignKey('items.id', ondelete='SET NULL'), nullable=True)
    season_number = Column(Integer, nullable=True)
    episode_number = Column(Integer, nullable=True)
    external_ids = Column(String(1024), nullable=True)
    added_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_items_library', 'library_id'),
        Index('idx_items_type', 'item_type'),
        Index('idx_items_added', 'added_at'),
        Index('idx_items_jellyfin_id', 'jellyfin_id'),
        Index('idx_items_series_id', 'series_id'),
        Index('idx_items_year', 'year'),
    )
