from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Index
from app.database import Base


class Server(Base):
    """Jellyfin server connection config."""
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    url = Column(String(512), nullable=False)
    api_key = Column(String(255), nullable=False)
    version = Column(String(50), nullable=True)
    os = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_servers_name', 'name'),
        Index('idx_servers_url', 'url'),
    )
