"""Item schemas for Jellyview."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ItemBase(BaseModel):
    """Base item schema."""
    name: str = Field(default="Unknown", max_length=500)
    jellyfin_id: str
    item_type: Optional[str] = Field(default=None, description="Type of item (Movie, Episode, Series, etc.)")
    library_id: Optional[int] = None


class ItemResponse(ItemBase):
    """Schema for item response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    year: Optional[int] = None
    premiere_date: Optional[datetime] = None
    runtime_seconds: Optional[int] = None
    parent_jellyfin_id: Optional[str] = None
    primary_image_url: Optional[str] = None
    backdrop_image_url: Optional[str] = None
    is_active: bool = True


class ItemDetail(ItemResponse):
    """Detailed item schema with extended information."""
    overview: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    studios: List[str] = Field(default_factory=list)
    community_rating: Optional[float] = None
    critic_rating: Optional[float] = None
    play_count: int = Field(default=0)
    total_play_time: int = Field(default=0, description="Total play time in seconds")
    favorite_count: int = Field(default=0)
    last_played: Optional[datetime] = None
    media_sources: List[dict] = Field(default_factory=list, description="Media source information")