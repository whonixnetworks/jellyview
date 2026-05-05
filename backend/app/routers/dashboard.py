"""Dashboard router for Jellyview API."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.session import SessionHistory, ActiveSession
from ..models.user import User
from ..models.library import Library
from ..models.item import Item
from ..schemas.dashboard import (
    DashboardStats,
    TopUser,
    TopItem,
    TopLibrary,
    RecentActivity,
)


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
):
    """Get overview statistics for the dashboard."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Total users and active users
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(
        User.last_active >= start_date
    ).scalar()

    # Total libraries and items
    total_libraries = db.query(func.count(Library.id)).scalar()
    total_items = db.query(func.count(Item.id)).scalar()

    # Total plays and play time in the period
    stats = db.query(
        func.count(SessionHistory.id).label("total_plays"),
        func.sum(SessionHistory.duration).label("total_play_time"),
    ).filter(
        SessionHistory.started_at >= start_date
    ).first()

    total_plays = stats.total_plays or 0
    total_play_time = int(stats.total_play_time or 0)

    # Active sessions
    active_sessions = db.query(func.count(ActiveSession.id)).filter(
        ActiveSession.state == "playing"
    ).scalar()

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_libraries=total_libraries,
        total_items=total_items,
        total_play_time=total_play_time,
        total_plays=total_plays,
        active_sessions=active_sessions,
        date_range_start=start_date,
        date_range_end=end_date,
    )


@router.get("/top-users", response_model=list[TopUser])
async def get_top_users(
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
    limit: int = Query(default=10, ge=1, le=100, description="Number of results"),
):
    """Get top users by plays and watch time."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    results = (
        db.query(
            User.id.label("user_id"),
            User.username,
            User.avatar_url,
            func.count(SessionHistory.id).label("play_count"),
            func.sum(SessionHistory.duration).label("play_time_seconds"),
        )
        .join(SessionHistory, User.id == SessionHistory.user_id)
        .filter(SessionHistory.started_at >= start_date)
        .group_by(User.id)
        .order_by(desc(func.sum(SessionHistory.duration)))
        .limit(limit)
        .all()
    )

    return [
        TopUser(
            user_id=row.user_id,
            username=row.username,
            avatar_url=row.avatar_url,
            play_count=row.play_count,
            play_time_seconds=int(row.play_time_seconds or 0),
        )
        for row in results
    ]


@router.get("/top-items", response_model=list[TopItem])
async def get_top_items(
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
    limit: int = Query(default=10, ge=1, le=100, description="Number of results"),
):
    """Get top items by plays and watch time."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    results = (
        db.query(
            Item.id.label("item_id"),
            Item.name,
            Item.item_type,
            func.count(SessionHistory.id).label("play_count"),
            func.sum(SessionHistory.duration).label("play_time_seconds"),
        )
        .join(SessionHistory, Item.id == SessionHistory.item_id)
        .filter(SessionHistory.started_at >= start_date)
        .group_by(Item.id)
        .order_by(desc(func.count(SessionHistory.id)))
        .limit(limit)
        .all()
    )

    return [
        TopItem(
            item_id=row.item_id,
            name=row.name,
            item_type=row.item_type,
            play_count=row.play_count,
            play_time_seconds=int(row.play_time_seconds or 0),
        )
        for row in results
    ]


@router.get("/top-libraries", response_model=list[TopLibrary])
async def get_top_libraries(
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
    limit: int = Query(default=10, ge=1, le=100, description="Number of results"),
):
    """Get top libraries by plays and watch time."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    results = (
        db.query(
            Library.id.label("library_id"),
            Library.name,
            Library.item_type.label("library_type"),
            func.count(SessionHistory.id).label("play_count"),
            func.sum(SessionHistory.duration).label("play_time_seconds"),
            func.count(SessionHistory.user_id.distinct()).label("active_users"),
        )
        .join(SessionHistory, Library.id == SessionHistory.library_id)
        .filter(SessionHistory.started_at >= start_date)
        .group_by(Library.id)
        .order_by(desc(func.sum(SessionHistory.duration)))
        .limit(limit)
        .all()
    )

    return [
        TopLibrary(
            library_id=row.library_id,
            name=row.name,
            library_type=row.library_type,
            play_count=row.play_count,
            play_time_seconds=int(row.play_time_seconds or 0),
            active_users=row.active_users,
        )
        for row in results
    ]


@router.get("/recent-activity", response_model=list[RecentActivity])
async def get_recent_activity(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100, description="Number of results"),
):
    """Get recent activity events."""
    results = (
        db.query(
            SessionHistory.id,
            SessionHistory.user_id,
            User.username,
            SessionHistory.item_id,
            SessionHistory.item_name,
            SessionHistory.item_type,
            SessionHistory.started_at,
        )
        .join(User, SessionHistory.user_id == User.id)
        .order_by(desc(SessionHistory.started_at))
        .limit(limit)
        .all()
    )

    return [
        RecentActivity(
            activity_type="play",
            user_id=row.user_id,
            username=row.username,
            item_id=row.item_id,
            item_name=row.item_name,
            item_type=row.item_type,
            timestamp=row.started_at,
        )
        for row in results
    ]


@router.get("/plays-over-time")
async def get_plays_over_time(
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
    group_by: str = Query(default="day", regex="^(day|hour)$", description="Group by day or hour"),
):
    """Get plays over time chart data."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    if group_by == "hour":
        # Group by hour
        results = (
            db.query(
                func.strftime("%Y-%m-%d %H:00:00", SessionHistory.started_at).label("time"),
                func.count(SessionHistory.id).label("plays"),
            )
            .filter(SessionHistory.started_at >= start_date)
            .group_by(func.strftime("%Y-%m-%d %H:00:00", SessionHistory.started_at))
            .order_by("time")
            .all()
        )
    else:
        # Group by day
        results = (
            db.query(
                func.date(SessionHistory.started_at).label("time"),
                func.count(SessionHistory.id).label("plays"),
            )
            .filter(SessionHistory.started_at >= start_date)
            .group_by(func.date(SessionHistory.started_at))
            .order_by("time")
            .all()
        )

    return [
        {"date": row.time, "plays": row.plays}
        for row in results
    ]


@router.get("/device-breakdown")
async def get_device_breakdown(
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
):
    """Get plays by client/device breakdown."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    results = (
        db.query(
            SessionHistory.client,
            SessionHistory.device,
            func.count(SessionHistory.id).label("plays"),
            func.count(SessionHistory.id.distinct()).label("unique_users"),
        )
        .filter(SessionHistory.started_at >= start_date)
        .group_by(SessionHistory.client, SessionHistory.device)
        .order_by(desc(func.count(SessionHistory.id)))
        .all()
    )

    return [
        {
            "client": row.client,
            "device": row.device,
            "plays": row.plays,
            "unique_users": row.unique_users,
        }
        for row in results
    ]
