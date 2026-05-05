"""Library schemas for Jellyview."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


class LibraryBase(BaseModel):
    """Base library schema."""
    name: str = Field(..., min_length=1, max_length=255)
    item_type: Optional[str] = Field(default=None, description="Type of library (movies, tvshows, music, etc.)")
    jellyfin_id: str
    total_items: int = Field(default=0)
    total_size: int = Field(default=0)


class LibraryResponse(LibraryBase):
    """Schema for library response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class LibraryWithStats(LibraryResponse):
    """Library schema with detailed statistics."""
    total_play_time: int = Field(default=0, description="Total play time in seconds")
    total_plays: int = Field(default=0, description="Total number of plays")
    recent_plays: int = Field(default=0, description="Number of plays in last 30 days")
    active_users: int = Field(default=0, description="Number of users who played from this library")
    top_items: List[int] = Field(default_factory=list, description="List of top item IDs")
    item_count: int = Field(default=0, description="Total items in library")
    total_size_bytes: Optional[int] = Field(default=None, description="Total size in bytes")