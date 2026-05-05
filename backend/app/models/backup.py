from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Index
from app.database import Base


class BackupJob(Base):
    """Backup jobs for tracking backup/restore operations."""
    __tablename__ = "backup_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String(50), nullable=False)
    status = Column(String(50), default='pending', nullable=False)
    filename = Column(String(512), nullable=True)
    progress = Column(Float, default=0, nullable=False)
    current_step = Column(String(512), nullable=True)
    total_users = Column(Integer, nullable=True)
    total_items = Column(Integer, nullable=True)
    processed = Column(Integer, default=0, nullable=False)
    matched = Column(Integer, default=0, nullable=False)
    unmatched = Column(Integer, default=0, nullable=False)
    errors = Column(Integer, default=0, nullable=False)
    error_log = Column(String, nullable=True)
    dry_run = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index('idx_backup_jobs_status', 'status'),
        Index('idx_backup_jobs_type', 'job_type'),
        Index('idx_backup_jobs_created', 'created_at'),
    )
