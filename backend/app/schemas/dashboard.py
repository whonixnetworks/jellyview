"""Dashboard schemas for Jellyview."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class TopUser(BaseModel):
    """Schema for top user statistics."""
    user_id: int
    username: str
    play_count: int = Field(default=0)
    play_time_seconds: int = Field(default=0)
    items_watched: int = Field(default=0)
    favorite_count: int = Field(default=0)
    avatar_url: Optional[str] = None


class TopItem(BaseModel):
    """Schema for top item statistics."""
    item_id: int
    name: str
    item_type: str
    play_count: int = Field(default=0)
    play_time_seconds: int = Field(default=0)
    favorite_count: int = Field(default=0)
    library_name: Optional[str] = None
    primary_image_url: Optional[str] = None


class TopLibrary(BaseModel):
    """Schema for top library statistics."""
    library_id: int
    name: str
    library_type: str
    play_count: int = Field(default=0)
    play_time_seconds: int = Field(default=0)
    item_count: int = Field(default=0)
    active_users: int = Field(default=0)
    primary_image_url: Optional[str] = None


class RecentActivity(BaseModel):
    """Schema for recent activity."""
    activity_type: str = Field(..., description="Type of activity (play, login, etc.)")
    user_id: Optional[int] = None
    username: Optional[str] = None
    item_id: Optional[int] = None
    item_name: Optional[str] = None
    item_type: Optional[str] = None
    timestamp: datetime
    details: Optional[dict] = Field(default=None)


class DashboardStats(BaseModel):
    """Schema for overall dashboard statistics."""
    total_users: int = Field(default=0)
    active_users: int = Field(default=0, description="Users active in last 30 days")
    total_libraries: int = Field(default=0)
    total_items: int = Field(default=0)
    total_play_time: int = Field(default=0, description="Total play time in seconds")
    total_plays: int = Field(default=0)
    active_sessions: int = Field(default=0)
    date_range_start: Optional[datetime] = None
    date_range_end: Optional[datetime] = None
    
    top_users: List[TopUser] = Field(default_factory=list)
    top_items: List[TopItem] = Field(default_factory=list)
    top_libraries: List[TopLibrary] = Field(default_factory=list)
    recent_activities: List[RecentActivity] = Field(default_factory=list)
    
    # Optional stats
    average_session_duration: Optional[float] = Field(default=None, description="Average session duration in seconds")
    most_active_hour: Optional[int] = Field(default=None, description="Most active hour of day (0-23)")
    most_active_day: Optional[str] = Field(default=None, description="Most active day of week")
