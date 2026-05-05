"""Settings schemas for Jellyview."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, HttpUrl


class JellyfinConnectionSettings(BaseModel):
    """Schema for Jellyfin connection settings."""
    url: str = Field(..., description="Jellyfin server URL")
    api_key: str = Field(default="", max_length=255, description="Jellyfin API key")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificate")
    timeout: int = Field(default=30, description="Request timeout in seconds")
    max_retries: int = Field(default=3, description="Maximum number of retries")
    retry_delay: int = Field(default=1, description="Retry delay in seconds")


class SettingsResponse(BaseModel):
    """Schema for settings response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    jellyfin: Optional[JellyfinConnectionSettings] = None
    sync_enabled: bool = Field(default=True, description="Whether sync is enabled")
    sync_interval_minutes: int = Field(default=60, description="Sync interval in minutes")
    enable_anonymous_stats: bool = Field(default=False, description="Enable anonymous statistics")
    enable_notifications: bool = Field(default=True, description="Enable notifications")
    default_session_timeout_minutes: int = Field(default=30, description="Default session timeout")
    log_retention_days: int = Field(default=30, description="Log retention period in days")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
