"""Backup schemas for Jellyview."""
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class BackupJobCreate(BaseModel):
    """Schema for creating a backup job."""
    name: str = Field(..., min_length=1, max_length=100)
    backup_type: Literal["full", "incremental"] = Field(default="full")
    schedule: str = Field(..., description="Cron expression for schedule")
    retention_days: int = Field(default=7, ge=1, description="Number of days to retain backups")
    backup_path: Optional[str] = Field(default=None, description="Custom backup path")
    include_settings: bool = Field(default=True)
    include_users: bool = Field(default=True)
    include_libraries: bool = Field(default=True)
    include_items: bool = Field(default=True)
    include_sessions: bool = Field(default=True)
    include_notifications: bool = Field(default=True)
    is_enabled: bool = Field(default=True)


class BackupJobResponse(BackupJobCreate):
    """Schema for backup job response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    last_status: Optional[Literal["success", "failed", "running", "pending"]] = None
    last_backup_size: Optional[int] = Field(default=None, description="Last backup size in bytes")
    total_runs: int = Field(default=0)
    successful_runs: int = Field(default=0)
    failed_runs: int = Field(default=0)
