"""History router for Jellyview API."""
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, desc, or_
from sqlalchemy.orm import Session
import csv
import io

from ..database import get_db
from ..models.session import SessionHistory
from ..models.user import User
from ..models.library import Library
from ..models.item import Item
from ..models.settings import AppSettings
from ..schemas.common import PaginationParams, DateRangeParams
from ..config import settings as app_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["history"])


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


def _prefix_url(url: Optional[str], jellyfin_url: str) -> Optional[str]:
    """Prefix a relative URL with the Jellyfin server URL."""
    if not url:
        return None
    if url.startswith("/"):
        return f"{jellyfin_url}{url}"
    if url.startswith("http"):
        return url
    return f"{jellyfin_url}/{url}"


@router.get("")
async def get_history(
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    date_range: DateRangeParams = Depends(),
    user_id: Optional[int] = Query(default=None, description="Filter by user"),
    library_id: Optional[int] = Query(default=None, description="Filter by library"),
    item_id: Optional[int] = Query(default=None, description="Filter by item"),
    media_type: Optional[str] = Query(default=None, description="Filter by media type"),
    client: Optional[str] = Query(default=None, description="Filter by client"),
    transcode: Optional[bool] = Query(default=None, description="Filter by transcode status"),
):
    """Get paginated history with filters."""
    jellyfin_url = _get_jellyfin_url(db)

    # Base query with joins
    base_query = (
        db.query(SessionHistory)
        .join(User, SessionHistory.user_id == User.id, isouter=True)
    )

    # Count query for total
    count_query = (
        db.query(func.count(SessionHistory.id))
        .join(User, SessionHistory.user_id == User.id, isouter=True)
    )

    # Apply filters to both queries
    if date_range.has_date_range():
        base_query = base_query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )
        count_query = count_query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    if user_id:
        base_query = base_query.filter(SessionHistory.user_id == user_id)
        count_query = count_query.filter(SessionHistory.user_id == user_id)

    if library_id:
        base_query = base_query.filter(SessionHistory.library_id == library_id)
        count_query = count_query.filter(SessionHistory.library_id == library_id)

    if item_id:
        base_query = base_query.filter(SessionHistory.item_id == item_id)
        count_query = count_query.filter(SessionHistory.item_id == item_id)

    if media_type:
        base_query = base_query.filter(SessionHistory.media_type == media_type)
        count_query = count_query.filter(SessionHistory.media_type == media_type)

    if client:
        base_query = base_query.filter(SessionHistory.client.ilike(f"%{client}%"))
        count_query = count_query.filter(SessionHistory.client.ilike(f"%{client}%"))

    if transcode is not None:
        base_query = base_query.filter(SessionHistory.transcode == transcode)
        count_query = count_query.filter(SessionHistory.transcode == transcode)

    # Get total count
    total = count_query.scalar() or 0

    # Apply sorting
    if pagination.sort_by:
        sort_column = getattr(SessionHistory, pagination.sort_by, None)
        if sort_column is not None:
            if pagination.sort_order == "desc":
                base_query = base_query.order_by(desc(sort_column))
            else:
                base_query = base_query.order_by(sort_column)
    else:
        base_query = base_query.order_by(desc(SessionHistory.started_at))

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    results = base_query.offset(offset).limit(pagination.page_size).all()

    # Build response with nested objects
    items = []
    for record in results:
        # Get user info
        user = db.query(User).filter(User.id == record.user_id).first() if record.user_id else None
        user_data = {
            "id": user.id if user else 0,
            "username": user.username if user else (record.item_name or "Unknown"),
            "avatar_url": _prefix_url(user.avatar_url, jellyfin_url) if user else None,
        }

        # Get item info
        item = db.query(Item).filter(Item.id == record.item_id).first() if record.item_id else None
        item_data = {
            "id": item.id if item else 0,
            "name": item.name if item else (record.item_name or "Unknown"),
            "item_type": item.item_type if item else (record.item_type or "Unknown"),
            "poster_url": _prefix_url(item.poster_url, jellyfin_url) if item else None,
            "year": item.year if item else record.year,
        }

        # Get library info
        library = db.query(Library).filter(Library.id == record.library_id).first() if record.library_id else None
        library_data = {
            "id": library.id if library else 0,
            "name": library.name if library else "Unknown",
        }

        items.append({
            "id": record.id,
            "jellyfin_id": record.jellyfin_id,
            "user_id": record.user_id or 0,
            "user": user_data,
            "item_id": record.item_id or 0,
            "item": item_data,
            "library_id": record.library_id or 0,
            "library": library_data,
            "started_at": record.started_at.isoformat() if record.started_at else None,
            "stopped_at": record.stopped_at.isoformat() if record.stopped_at else None,
            "duration": record.duration or 0,
            "paused_duration": record.paused_duration or 0,
            "play_count": record.play_count or 1,
            "completion_pct": record.completion_pct or 0,
            "client": record.client or "Unknown",
            "device": record.device or "Unknown",
            "device_id": record.device_id,
            "ip_address": record.ip_address,
            "video_codec": record.video_codec,
            "audio_codec": record.audio_codec,
            "container": record.container,
            "width": record.width,
            "height": record.height,
            "bitrate": record.bitrate,
            "transcode": record.transcode or False,
            "transcode_reason": record.transcode_reason,
            "transcode_hw": record.transcode_hw,
            "media_type": record.media_type or "Video",
            "item_name": record.item_name or "Unknown",
            "item_type": record.item_type or "Unknown",
            "series_name": record.series_name,
            "season_number": record.season_number,
            "episode_number": record.episode_number,
            "year": record.year,
            "playback_position_ticks": record.playback_position_ticks,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "limit": pagination.page_size,
    }


@router.get("/stats")
async def get_history_stats(
    db: Session = Depends(get_db),
    date_range: DateRangeParams = Depends(),
):
    """Get historical statistics."""
    query = db.query(SessionHistory)

    # Apply date range filter
    if date_range.has_date_range():
        query = query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    # Get stats
    stats = query.with_entities(
        func.count(SessionHistory.id).label("total_plays"),
        func.sum(SessionHistory.duration).label("total_watch_time"),
        func.count(SessionHistory.item_id.distinct()).label("unique_items_played"),
        func.count(SessionHistory.user_id.distinct()).label("unique_users"),
        func.avg(SessionHistory.duration).label("avg_watch_time"),
    ).first()

    return {
        "total_plays": stats.total_plays or 0,
        "total_watch_time": int(stats.total_watch_time or 0),
        "unique_items_played": stats.unique_items_played or 0,
        "unique_users": stats.unique_users or 0,
        "avg_watch_time": float(stats.avg_watch_time or 0),
        "date_range": {
            "start": date_range.start_date,
            "end": date_range.end_date,
        } if date_range.has_date_range() else None,
    }


@router.get("/stats/by-day")
async def get_stats_by_day(
    db: Session = Depends(get_db),
    date_range: DateRangeParams = Depends(),
):
    """Get daily plays chart data."""
    query = db.query(SessionHistory)

    # Apply date range filter
    if date_range.has_date_range():
        query = query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    results = (
        query.with_entities(
            func.date(SessionHistory.started_at).label("date"),
            func.count(SessionHistory.id).label("plays"),
            func.sum(SessionHistory.duration).label("watch_time"),
            func.count(SessionHistory.user_id.distinct()).label("unique_users"),
        )
        .group_by(func.date(SessionHistory.started_at))
        .order_by("date")
        .all()
    )

    return [
        {
            "date": row.date,
            "plays": row.plays,
            "watch_time": int(row.watch_time or 0),
            "unique_users": row.unique_users,
        }
        for row in results
    ]


@router.get("/stats/by-user")
async def get_stats_by_user(
    db: Session = Depends(get_db),
    date_range: DateRangeParams = Depends(),
    limit: int = Query(default=20, ge=1, le=100, description="Number of results"),
):
    """Get user comparison chart data."""
    query = db.query(SessionHistory)

    # Apply date range filter
    if date_range.has_date_range():
        query = query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    results = (
        query.join(User)
        .with_entities(
            User.id.label("user_id"),
            User.username,
            func.count(SessionHistory.id).label("plays"),
            func.sum(SessionHistory.duration).label("watch_time"),
            func.count(SessionHistory.item_id.distinct()).label("unique_items"),
        )
        .group_by(User.id)
        .order_by(desc(func.sum(SessionHistory.duration)))
        .limit(limit)
        .all()
    )

    return [
        {
            "user_id": row.user_id,
            "username": row.username,
            "plays": row.plays,
            "watch_time": int(row.watch_time or 0),
            "unique_items": row.unique_items,
        }
        for row in results
    ]


@router.get("/stats/by-device")
async def get_stats_by_device(
    db: Session = Depends(get_db),
    date_range: DateRangeParams = Depends(),
    limit: int = Query(default=20, ge=1, le=100, description="Number of results"),
):
    """Get device breakdown."""
    query = db.query(SessionHistory)

    # Apply date range filter
    if date_range.has_date_range():
        query = query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    results = (
        query.with_entities(
            SessionHistory.client,
            SessionHistory.device,
            func.count(SessionHistory.id).label("plays"),
            func.sum(SessionHistory.duration).label("watch_time"),
            func.count(SessionHistory.user_id.distinct()).label("unique_users"),
        )
        .group_by(SessionHistory.client, SessionHistory.device)
        .order_by(desc(func.count(SessionHistory.id)))
        .limit(limit)
        .all()
    )

    return [
        {
            "client": row.client,
            "device": row.device,
            "plays": row.plays,
            "watch_time": int(row.watch_time or 0),
            "unique_users": row.unique_users,
        }
        for row in results
    ]


@router.get("/export")
async def export_history(
    db: Session = Depends(get_db),
    date_range: DateRangeParams = Depends(),
    format: str = Query(default="csv", regex="^(csv|json)$", description="Export format"),
):
    """Export history to CSV or JSON."""
    query = (
        db.query(
            SessionHistory.id,
            User.username,
            SessionHistory.item_name,
            SessionHistory.item_type,
            Library.name.label("library_name"),
            SessionHistory.started_at,
            SessionHistory.duration,
            SessionHistory.completion_pct,
            SessionHistory.client,
            SessionHistory.device,
            SessionHistory.video_codec,
            SessionHistory.width,
            SessionHistory.height,
            SessionHistory.bitrate,
            SessionHistory.transcode,
        )
        .join(User, SessionHistory.user_id == User.id)
        .outerjoin(Library, SessionHistory.library_id == Library.id)
    )

    # Apply date range filter
    if date_range.has_date_range():
        query = query.filter(
            SessionHistory.started_at >= date_range.start_date,
            SessionHistory.started_at <= date_range.end_date
        )

    results = query.order_by(desc(SessionHistory.started_at)).all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "username", "item_name", "item_type", "library_name",
            "started_at", "duration", "completion_pct", "client", "device",
            "video_codec", "width", "height", "bitrate", "transcode"
        ])
        for row in results:
            writer.writerow([
                row.id, row.username, row.item_name, row.item_type, row.library_name,
                row.started_at, row.duration, row.completion_pct, row.client, row.device,
                row.video_codec, row.width, row.height, row.bitrate, row.transcode
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=history_export.csv"}
        )
    else:  # JSON
        data = [
            {
                "id": row.id,
                "username": row.username,
                "item_name": row.item_name,
                "item_type": row.item_type,
                "library_name": row.library_name,
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "duration": row.duration,
                "completion_pct": row.completion_pct,
                "client": row.client,
                "device": row.device,
                "video_codec": row.video_codec,
                "width": row.width,
                "height": row.height,
                "bitrate": row.bitrate,
                "transcode": row.transcode,
            }
            for row in results
        ]
        output = io.StringIO()
        json.dump(data, output, indent=2)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=history_export.json"}
        )