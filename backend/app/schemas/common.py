"""Common schemas for Jellyview."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    """Schema for pagination parameters."""
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=20, ge=1, le=100, description="Number of items per page")
    sort_by: Optional[str] = Field(default=None, description="Field to sort by")
    sort_order: Optional[str] = Field(default="asc", pattern="^(asc|desc)$", description="Sort order (asc or desc)")


class DateRangeParams(BaseModel):
    """Schema for date range parameters."""
    start_date: Optional[datetime] = Field(default=None, description="Start date for filtering")
    end_date: Optional[datetime] = Field(default=None, description="End date for filtering")
    
    def has_date_range(self) -> bool:
        """Check if both start and end dates are provided."""
        return self.start_date is not None and self.end_date is not None
    
    def is_valid_range(self) -> bool:
        """Check if the date range is valid (start before end)."""
        if not self.has_date_range():
            return False
        return self.start_date <= self.end_date
