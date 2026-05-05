from sqlalchemy import Column, String, Index
from app.database import Base


class AppSettings(Base):
    """Application settings (key-value store)."""
    __tablename__ = "app_settings"

    key = Column(String(255), primary_key=True, nullable=False)
    value = Column(String, nullable=False)

    __table_args__ = (
        Index('idx_app_settings_key', 'key'),
    )
