"""Schemas package for Jellyview."""
from .user import UserBase, UserCreate, UserResponse, UserWithStats
from .library import LibraryBase, LibraryResponse, LibraryWithStats
from .item import ItemBase, ItemResponse, ItemDetail
from .session import SessionHistoryResponse, ActiveSessionResponse, SessionStats
from .notification import (
    NotifierBase,
    NotifierResponse,
    NotificationRuleBase,
    NotificationRuleResponse,
    NotificationLogResponse,
)
from .settings import SettingsResponse, JellyfinConnectionSettings
from .backup import BackupJobResponse, BackupJobCreate
from .dashboard import DashboardStats, TopUser, TopItem, TopLibrary, RecentActivity
from .common import PaginationParams, DateRangeParams

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserResponse",
    "UserWithStats",
    # Library schemas
    "LibraryBase",
    "LibraryResponse",
    "LibraryWithStats",
    # Item schemas
    "ItemBase",
    "ItemResponse",
    "ItemDetail",
    # Session schemas
    "SessionHistoryResponse",
    "ActiveSessionResponse",
    "SessionStats",
    # Notification schemas
    "NotifierBase",
    "NotifierResponse",
    "NotificationRuleBase",
    "NotificationRuleResponse",
    "NotificationLogResponse",
    # Settings schemas
    "SettingsResponse",
    "JellyfinConnectionSettings",
    # Backup schemas
    "BackupJobResponse",
    "BackupJobCreate",
    # Dashboard schemas
    "DashboardStats",
    "TopUser",
    "TopItem",
    "TopLibrary",
    "RecentActivity",
    # Common schemas
    "PaginationParams",
    "DateRangeParams",
]
