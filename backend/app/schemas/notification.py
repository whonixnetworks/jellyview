"""Notification schemas for Jellyview."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class NotifierBase(BaseModel):
    """Base notifier schema."""
    name: str = Field(..., min_length=1, max_length=100)
    notifier_type: str = Field(..., description="Type of notifier (email, webhook, telegram, etc.)")
    is_enabled: bool = True
    config: dict = Field(default_factory=dict, description="Notifier configuration")


class NotifierResponse(NotifierBase):
    """Schema for notifier response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime
    last_triggered: Optional[datetime] = None
    success_count: int = Field(default=0)
    failure_count: int = Field(default=0)


class NotificationRuleBase(BaseModel):
    """Base notification rule schema."""
    name: Optional[str] = ""
    rule_type: str = Field(..., description="Type of rule (watch_threshold, new_user, etc.)")
    is_enabled: bool = True
    conditions: dict = Field(default_factory=dict, description="Rule conditions")
    notifier_ids: List[int] = Field(default_factory=list, description="List of notifier IDs to use")
    template: Optional[str] = None


class NotificationRuleResponse(NotificationRuleBase):
    """Schema for notification rule response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime
    last_triggered: Optional[datetime] = None
    trigger_count: int = Field(default=0)
    notifiers: List[NotifierResponse] = Field(default_factory=list)


class NotificationLogResponse(BaseModel):
    """Schema for notification log response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    rule_id: Optional[int] = None
    rule_name: Optional[str] = None
    notifier_id: int
    notifier_name: str
    triggered_at: datetime
    status: str = Field(..., description="Status (success, failed, pending)")
    message: Optional[str] = None
    error_details: Optional[str] = None
    context: Optional[dict] = Field(default=None, description="Additional context data")
