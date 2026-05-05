"""User schemas for Jellyview."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UserBase(BaseModel):
    """Base user schema."""
    username: str = Field(..., min_length=1, max_length=255)
    is_admin: bool = False


class UserCreate(UserBase):
    """Schema for creating a new user."""
    jellyfin_id: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    """Schema for user response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    jellyfin_id: Optional[str] = None
    last_active: Optional[datetime] = None
    avatar_url: Optional[str] = None
    total_plays: int = Field(default=0)
    total_watch_time: int = Field(default=0, description="Total watch time in seconds")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserWithStats(UserResponse):
    """User schema with additional statistics."""
    total_play_time: int = Field(default=0, description="Total play time in seconds")
    items_watched: int = Field(default=0, description="Total unique items watched")
    favorite_items: int = Field(default=0, description="Total favorite items")