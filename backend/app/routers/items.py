"""Items router for Jellyview API."""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.item import Item
from ..models.session import SessionHistory
from ..models.library import Library
from ..models.user import User
from ..schemas.item import ItemResponse, ItemDetail
from ..schemas.session import SessionHistoryResponse
from ..schemas.common import PaginationParams


router = APIRouter(prefix="/api/items", tags=["items"])


@router.get("/{item_id}", response_model=ItemDetail)
async def get_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Get item detail with metadata."""
    item = db.query(Item).filter(Item.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Get play stats
    play_stats = db.query(
        func.count(SessionHistory.id).label("play_count"),
        func.sum(SessionHistory.duration).label("total_play_time"),
        func.max(SessionHistory.started_at).label("last_played"),
        func.count(SessionHistory.user_id.distinct()).label("favorite_count"),
    ).filter(SessionHistory.item_id == item_id).first()

    # Get genres
    genres = []
    if item.genres:
        try:
            import json
            genres = json.loads(item.genres)
        except:
            pass

    # Get studios
    studios = []
    if item.studios:
        try:
            import json
            studios = json.loads(item.studios)
        except:
            pass

    return ItemDetail(
        id=item.id,
        name=item.name,
        jellyfin_id=item.jellyfin_id,
        item_type=item.item_type,
        library_id=item.library_id,
        is_active=True,
        created_at=item.created_at,
        updated_at=item.updated_at,
        year=item.year,
        premiere_date=item.premiere_date,
        runtime_seconds=item.runtime_ticks // 10000000 if item.runtime_ticks else None,
        parent_jellyfin_id=None,  # Would need to query for series
        primary_image_url=item.poster_url,
        backdrop_image_url=item.backdrop_url,
        overview=None,  # Not stored in Item model
        genres=genres,
        tags=[],
        studios=studios,
        community_rating=item.community_rating,
        critic_rating=item.rating,
        play_count=play_stats.play_count or 0,
        total_play_time=int(play_stats.total_play_time or 0),
        favorite_count=play_stats.favorite_count or 0,
        last_played=play_stats.last_played,
        media_sources=[],  # Not stored in Item model
    )


@router.get("/{item_id}/history", response_model=List[SessionHistoryResponse])
async def get_item_history(
    item_id: int,
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
):
    """Get playback history for item."""
    # Verify item exists
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    query = (
        db.query(
            SessionHistory.id,
            SessionHistory.user_id,
            User.username,
            SessionHistory.item_id,
            SessionHistory.item_name,
            SessionHistory.item_type,
            SessionHistory.started_at,
            SessionHistory.duration.label("playback_duration"),
            SessionHistory.completion_pct,
            SessionHistory.client.label("client_name"),
            SessionHistory.device.label("device_name"),
            SessionHistory.media_type,
        )
        .join(User, SessionHistory.user_id == User.id)
        .filter(SessionHistory.item_id == item_id)
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
            played_at=row.started_at,
            playback_duration=row.playback_duration or 0,
            completed=(row.completion_pct or 0) >= 90,
            client_name=row.client_name,
            device_name=row.device_name,
            media_type=row.media_type,
        )
        for row in results
    ]


@router.get("/recently-added", response_model=List[ItemResponse])
async def get_recently_added_items(
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    library_id: Optional[int] = Query(default=None, description="Filter by library"),
    item_type: Optional[str] = Query(default=None, description="Filter by item type"),
):
    """Get global recently added items (paginated)."""
    query = db.query(Item)

    # Apply library filter
    if library_id:
        query = query.filter(Item.library_id == library_id)

    # Apply type filter
    if item_type:
        query = query.filter(Item.item_type == item_type)

    # Apply sorting
    if pagination.sort_by:
        sort_column = getattr(Item, pagination.sort_by, None)
        if sort_column is not None:
            if pagination.sort_order == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
    else:
        query = query.order_by(desc(Item.added_at))

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    items = query.offset(offset).limit(pagination.page_size).all()

    return [
        ItemResponse(
            id=item.id,
            name=item.name,
            jellyfin_id=item.jellyfin_id,
            item_type=item.item_type,
            library_id=item.library_id,
            is_active=True,
            created_at=item.created_at,
            updated_at=item.updated_at,
            year=item.year,
            premiere_date=item.premiere_date,
            runtime_seconds=item.runtime_ticks // 10000000 if item.runtime_ticks else None,
            parent_jellyfin_id=None,  # Would need to query for series
            primary_image_url=item.poster_url,
            backdrop_image_url=item.backdrop_url,
        )
        for item in items
    ]


@router.get("/most-played", response_model=List[ItemResponse])
async def get_most_played_items(
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
    library_id: Optional[int] = Query(default=None, description="Filter by library"),
):
    """Get global most played items (paginated)."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    query = (
        db.query(
            Item,
            func.count(SessionHistory.id).label("play_count"),
        )
        .join(SessionHistory, Item.id == SessionHistory.item_id)
        .filter(SessionHistory.started_at >= start_date)
        .group_by(Item.id)
    )

    # Apply library filter
    if library_id:
        query = query.filter(Item.library_id == library_id)

    # Apply sorting by play count
    query = query.order_by(desc(func.count(SessionHistory.id)))

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    results = query.offset(offset).limit(pagination.page_size).all()

    return [
        ItemResponse(
            id=item.id,
            name=item.name,
            jellyfin_id=item.jellyfin_id,
            item_type=item.item_type,
            library_id=item.library_id,
            is_active=True,
            created_at=item.created_at,
            updated_at=item.updated_at,
            year=item.year,
            premiere_date=item.premiere_date,
            runtime_seconds=item.runtime_ticks // 10000000 if item.runtime_ticks else None,
            parent_jellyfin_id=None,  # Would need to query for series
            primary_image_url=item.poster_url,
            backdrop_image_url=item.backdrop_url,
        )
        for item, _ in results
    ]


@router.get("/search", response_model=List[ItemResponse])
async def search_items(
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    query: str = Query(..., min_length=1, description="Search query"),
    library_id: Optional[int] = Query(default=None, description="Filter by library"),
    item_type: Optional[str] = Query(default=None, description="Filter by item type"),
    year: Optional[int] = Query(default=None, description="Filter by year"),
):
    """Search items."""
    search_query = db.query(Item)

    # Apply search filter (name or sort_name)
    search_query = search_query.filter(
        or_(
            Item.name.ilike(f"%{query}%"),
            Item.sort_name.ilike(f"%{query}%"),
        )
    )

    # Apply library filter
    if library_id:
        search_query = search_query.filter(Item.library_id == library_id)

    # Apply type filter
    if item_type:
        search_query = search_query.filter(Item.item_type == item_type)

    # Apply year filter
    if year:
        search_query = search_query.filter(Item.year == year)

    # Apply sorting
    if pagination.sort_by:
        sort_column = getattr(Item, pagination.sort_by, None)
        if sort_column is not None:
            if pagination.sort_order == "desc":
                search_query = search_query.order_by(desc(sort_column))
            else:
                search_query = search_query.order_by(sort_column)
    else:
        search_query = search_query.order_by(Item.sort_name)

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    items = search_query.offset(offset).limit(pagination.page_size).all()

    return [
        ItemResponse(
            id=item.id,
            name=item.name,
            jellyfin_id=item.jellyfin_id,
            item_type=item.item_type,
            library_id=item.library_id,
            is_active=True,
            created_at=item.created_at,
            updated_at=item.updated_at,
            year=item.year,
            premiere_date=item.premiere_date,
            runtime_seconds=item.runtime_ticks // 10000000 if item.runtime_ticks else None,
            parent_jellyfin_id=None,  # Would need to query for series
            primary_image_url=item.poster_url,
            backdrop_image_url=item.backdrop_url,
        )
        for item in items
    ]
