"""Users router for Jellyview API."""
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.session import SessionHistory
from ..models.item import Item
from ..models.library import Library
from ..models.settings import AppSettings
from ..schemas.user import UserResponse, UserWithStats
from ..schemas.session import SessionHistoryResponse
from ..schemas.common import PaginationParams, DateRangeParams
from ..config import settings as app_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


def _get_jellyfin_url(db: Session) -> str:
    """Get the Jellyfin server base URL from DB settings or env vars."""
    entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
    if entry:
        try:
            config = json.loads(entry.value)
            url = config.get("url", "")
            if url:
                return url.rstrip("/")
        except (json.JSONDecodeError, TypeError):
            pass
    return app_settings.jellyfin_url.rstrip("/") if app_settings.jellyfin_url else ""


def _prefix_avatar_url(avatar_url: Optional[str], jellyfin_url: str) -> Optional[str]:
    """Prefix a relative avatar URL with the Jellyfin server URL."""
    if not avatar_url:
        return None
    if avatar_url.startswith("/"):
        return f"{jellyfin_url}{avatar_url}"
    if avatar_url.startswith("http"):
        return avatar_url
    return f"{jellyfin_url}/{avatar_url}"


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    active_only: bool = Query(default=False, description="Filter to active users only"),
):
    """List all users."""
    jellyfin_url = _get_jellyfin_url(db)

    query = db.query(User)

    if active_only:
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        query = query.filter(User.last_active >= thirty_days_ago)

    # Apply sorting
    if pagination.sort_by:
        sort_column = getattr(User, pagination.sort_by, None)
        if sort_column is not None:
            if pagination.sort_order == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
    else:
        query = query.order_by(User.username)

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    users = query.offset(offset).limit(pagination.page_size).all()

    # Calculate total_watch_time from session_history for each user
    # and prefix avatar_url with Jellyfin URL
    result = []
    for user in users:
        # Calculate total_watch_time from session_history
        watch_time = db.query(func.sum(SessionHistory.duration)).filter(
            SessionHistory.user_id == user.id
        ).scalar()
        user.total_watch_time = int(watch_time or 0)

        # Prefix avatar_url
        user.avatar_url = _prefix_avatar_url(user.avatar_url, jellyfin_url)

        result.append(user)

    return result


@router.get("/{user_id}", response_model=UserWithStats)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Get user detail with stats."""
    jellyfin_url = _get_jellyfin_url(db)

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prefix avatar_url
    user.avatar_url = _prefix_avatar_url(user.avatar_url, jellyfin_url)

    # Get user stats
    stats = db.query(
        func.count(SessionHistory.id).label("total_plays"),
        func.sum(SessionHistory.duration).label("total_play_time"),
    ).filter(SessionHistory.user_id == user_id).first()

    # Get unique items watched
    items_watched = db.query(func.count(SessionHistory.item_id.distinct())).filter(
        SessionHistory.user_id == user_id
    ).scalar()

    # Get favorite items count (items with completion_pct >= 90)
    favorite_items = db.query(func.count(SessionHistory.item_id.distinct())).filter(
        SessionHistory.user_id == user_id,
        SessionHistory.completion_pct >= 90
    ).scalar()

    user_data = {
        'id': user.id,
        'jellyfin_id': user.jellyfin_id,
        'username': user.username,
        'is_admin': user.is_admin,
        'last_active': user.last_active,
        'avatar_url': user.avatar_url,
        'total_plays': stats.total_plays or 0,
        'total_watch_time': user.total_watch_time or 0,
        'created_at': user.created_at,
        'updated_at': user.updated_at,
        'total_play_time': int(stats.total_play_time or 0),
        'items_watched': items_watched or 0,
        'favorite_items': favorite_items or 0,
    }
    return UserWithStats(**user_data)


@router.get("/{user_id}/history", response_model=List[SessionHistoryResponse])
async def get_user_history(
    user_id: int,
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    date_range: DateRangeParams = Depends(),
):
    """Get user watch history."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    query = (
        db.query(
            SessionHistory.id,
            SessionHistory.user_id,
            User.username,
            SessionHistory.item_id,
            SessionHistory.item_name,
            SessionHistory.item_type,
            SessionHistory.library_id,
            Library.name.label("library_name"),
            SessionHistory.started_at,
            SessionHistory.duration.label("playback_duration"),
            SessionHistory.completion_pct,
            SessionHistory.client.label("client_name"),
            SessionHistory.device.label("device_name"),
            SessionHistory.media_type,
        )
        .join(User, SessionHistory.user_id == User.id)
        .outerjoin(Library, SessionHistory.library_id == Library.id)
        .filter(SessionHistory.user_id == user_id)
    )

    # Apply date range filter
    if date_range.has_date_range():
        query = query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    # Apply sorting
    if pagination.sort_by:
        sort_column = getattr(SessionHistory, pagination.sort_by, None)
        if sort_column is not None:
            if pagination.sort_order == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
    else:
        query = query.order_by(desc(SessionHistory.started_at))

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    results = query.offset(offset).limit(pagination.page_size).all()

    return [
        SessionHistoryResponse(
            id=row.id,
            user_id=row.user_id,
            username=row.username,
            item_id=row.item_id,
            item_name=row.item_name,
            item_type=row.item_type,
            library_name=row.library_name,
            played_at=row.started_at,
            playback_duration=row.playback_duration or 0,
            completed=(row.completion_pct or 0) >= 90,
            client_name=row.client_name,
            device_name=row.device_name,
            media_type=row.media_type,
        )
        for row in results
    ]


@router.get("/{user_id}/devices")
async def get_user_devices(
    user_id: int,
    db: Session = Depends(get_db),
):
    """Get user's devices and IPs."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    results = (
        db.query(
            SessionHistory.client,
            SessionHistory.device,
            SessionHistory.device_id,
            SessionHistory.ip_address,
            func.count(SessionHistory.id).label("play_count"),
            func.max(SessionHistory.started_at).label("last_seen"),
        )
        .filter(SessionHistory.user_id == user_id)
        .group_by(
            SessionHistory.client,
            SessionHistory.device,
            SessionHistory.device_id,
            SessionHistory.ip_address,
        )
        .order_by(desc(func.max(SessionHistory.started_at)))
        .all()
    )

    return [
        {
            "client": row.client,
            "device": row.device,
            "device_id": row.device_id,
            "ip_address": row.ip_address,
            "play_count": row.play_count,
            "last_seen": row.last_seen,
        }
        for row in results
    ]


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: int,
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
):
    """Get user watch time charts and statistics."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Get plays over time
    plays_by_day = (
        db.query(
            func.date(SessionHistory.started_at).label("date"),
            func.count(SessionHistory.id).label("plays"),
            func.sum(SessionHistory.duration).label("watch_time"),
        )
        .filter(
            SessionHistory.user_id == user_id,
            SessionHistory.started_at >= start_date
        )
        .group_by(func.date(SessionHistory.started_at))
        .order_by("date")
        .all()
    )

    # Get plays by day of week
    plays_by_dow = (
        db.query(
            func.strftime("%w", SessionHistory.started_at).label("dow"),
            func.count(SessionHistory.id).label("plays"),
        )
        .filter(
            SessionHistory.user_id == user_id,
            SessionHistory.started_at >= start_date
        )
        .group_by(func.strftime("%w", SessionHistory.started_at))
        .all()
    )

    # Get device breakdown
    device_breakdown = (
        db.query(
            SessionHistory.device,
            func.count(SessionHistory.id).label("plays"),
        )
        .filter(
            SessionHistory.user_id == user_id,
            SessionHistory.started_at >= start_date
        )
        .group_by(SessionHistory.device)
        .order_by(desc(func.count(SessionHistory.id)))
        .all()
    )

    return {
        "plays_over_time": [
            {"date": row.date, "plays": row.plays, "watch_time": row.watch_time}
            for row in plays_by_day
        ],
        "plays_by_day_of_week": [
            {"day_of_week": int(row.dow), "plays": row.plays}
            for row in plays_by_dow
        ],
        "device_breakdown": [
            {"device": row.device, "plays": row.plays}
            for row in device_breakdown
        ],
        "date_range": {
            "start": start_date,
            "end": end_date,
        }
    }


@router.get("/{user_id}/libraries")
async def get_user_libraries(
    user_id: int,
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
):
    """Get user library activity breakdown."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    results = (
        db.query(
            Library.id.label("library_id"),
            Library.name,
            Library.item_type,
            func.count(SessionHistory.id).label("plays"),
            func.sum(SessionHistory.duration).label("watch_time"),
            func.count(SessionHistory.item_id.distinct()).label("items_watched"),
        )
        .join(SessionHistory, Library.id == SessionHistory.library_id)
        .filter(
            SessionHistory.user_id == user_id,
            SessionHistory.started_at >= start_date
        )
        .group_by(Library.id)
        .order_by(desc(func.sum(SessionHistory.duration)))
        .all()
    )

    return [
        {
            "library_id": row.library_id,
            "name": row.name,
            "library_type": row.item_type,
            "plays": row.plays,
            "watch_time": int(row.watch_time or 0),
            "items_watched": row.items_watched,
        }
        for row in results
    ]