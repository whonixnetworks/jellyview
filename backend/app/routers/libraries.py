"""Libraries router for Jellyview API."""
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.library import Library
from ..models.item import Item
from ..models.session import SessionHistory
from ..models.settings import AppSettings
from ..schemas.library import LibraryResponse, LibraryWithStats
from ..schemas.common import PaginationParams, DateRangeParams
from ..config import settings as app_settings
from ..services.jellyfin import JellyfinClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/libraries", tags=["libraries"])


def _get_jellyfin_config(db: Session) -> tuple:
    """Get Jellyfin URL and API key from DB settings or env vars."""
    entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
    if entry:
        try:
            config = json.loads(entry.value)
            return config.get("url", ""), config.get("api_key", "")
        except (json.JSONDecodeError, TypeError):
            pass
    return app_settings.jellyfin_url, app_settings.jellyfin_api_key or ""


def _get_jellyfin_client(db: Session) -> Optional[JellyfinClient]:
    """Get a Jellyfin client from DB settings or env vars."""
    url, api_key = _get_jellyfin_config(db)
    if url and api_key:
        return JellyfinClient(base_url=url, api_key=api_key)
    return None


def _get_jellyfin_url(db: Session) -> str:
    """Get the Jellyfin server base URL."""
    url, _ = _get_jellyfin_config(db)
    return url.rstrip("/") if url else ""


def _map_jellyfin_item_to_library_item(item_data: dict, library_id: int, jellyfin_url: str) -> dict:
    """Map a Jellyfin item dict to the LibraryItem format expected by the frontend."""
    item_jellyfin_id = item_data.get("Id", "")
    image_tags = item_data.get("ImageTags", {})
    backdrop_tags = item_data.get("BackdropImageTags", [])

    poster_url = None
    if image_tags and image_tags.get("Primary"):
        poster_url = f"{jellyfin_url}/Items/{item_jellyfin_id}/Images/Primary?format=webp&quality=90&tag={image_tags['Primary']}"

    backdrop_url = None
    if backdrop_tags:
        backdrop_url = f"{jellyfin_url}/Items/{item_jellyfin_id}/Images/Backdrop?format=webp&quality=90&tag={backdrop_tags[0]}"

    # Parse genres
    genres = item_data.get("Genres", [])
    if isinstance(genres, str):
        try:
            import json as _json
            genres = _json.loads(genres)
        except Exception:
            genres = [genres] if genres else []

    # Parse studios
    studios = item_data.get("Studios", [])
    if isinstance(studios, list):
        studios = [s.get("Name", str(s)) if isinstance(s, dict) else str(s) for s in studios]

    # Date created
    date_created = item_data.get("DateCreated")
    added_at = None
    if date_created:
        try:
            added_at = datetime.fromisoformat(date_created.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            pass

    return {
        "id": 0,  # No DB ID for Jellyfin-fetched items
        "jellyfin_id": item_jellyfin_id,
        "library_id": library_id,
        "item_type": item_data.get("Type", "Unknown"),
        "name": item_data.get("Name", "Unknown"),
        "sort_name": item_data.get("SortName", item_data.get("Name", "Unknown")),
        "year": item_data.get("ProductionYear"),
        "premiere_date": item_data.get("PremiereDate"),
        "rating": item_data.get("CommunityRating") or item_data.get("Rating"),
        "community_rating": item_data.get("CommunityRating"),
        "official_rating": item_data.get("OfficialRating"),
        "runtime_ticks": item_data.get("RunTimeTicks", 0),
        "genres": genres,
        "studios": studios,
        "poster_url": poster_url,
        "backdrop_url": backdrop_url,
        "series_name": item_data.get("SeriesName"),
        "season_number": item_data.get("ParentIndexNumber"),
        "episode_number": item_data.get("IndexNumber"),
        "added_at": added_at.isoformat() if added_at else None,
        "created_at": added_at.isoformat() if added_at else None,
        "updated_at": added_at.isoformat() if added_at else None,
    }


@router.get("", response_model=List[LibraryResponse])
async def list_libraries(
    db: Session = Depends(get_db),
):
    """List all libraries."""
    libraries = db.query(Library).order_by(Library.name).all()
    return libraries


@router.get("/{library_id}", response_model=LibraryWithStats)
async def get_library(
    library_id: int,
    db: Session = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
):
    """Get library detail with stats."""
    library = db.query(Library).filter(Library.id == library_id).first()

    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Get library stats
    stats = db.query(
        func.count(SessionHistory.id).label("total_plays"),
        func.sum(SessionHistory.duration).label("total_play_time"),
        func.count(SessionHistory.user_id.distinct()).label("active_users"),
    ).filter(
        SessionHistory.library_id == library_id,
        SessionHistory.started_at >= start_date
    ).first()

    # Get top items
    top_items = (
        db.query(Item.id)
        .join(SessionHistory, Item.id == SessionHistory.item_id)
        .filter(
            SessionHistory.library_id == library_id,
            SessionHistory.started_at >= start_date
        )
        .group_by(Item.id)
        .order_by(desc(func.count(SessionHistory.id)))
        .limit(10)
        .all()
    )

    return LibraryWithStats(
        **library.__dict__,
        total_play_time=int(stats.total_play_time or 0),
        total_plays=stats.total_plays or 0,
        recent_plays=stats.total_plays or 0,
        active_users=stats.active_users or 0,
        top_items=[item.id for item in top_items],
    )


@router.get("/{library_id}/stats")
async def get_library_stats(
    library_id: int,
    db: Session = Depends(get_db),
):
    """Get library statistics."""
    # Verify library exists
    library = db.query(Library).filter(Library.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)

    # Get genres from items
    genres = []
    for item in db.query(Item).filter(Item.library_id == library_id).all():
        if item.genres:
            try:
                genre_list = json.loads(item.genres)
                for genre in genre_list:
                    genres.append(genre)
            except Exception:
                pass

    # Count genres
    genre_counts = {}
    for genre in genres:
        genre_counts[genre] = genre_counts.get(genre, 0) + 1

    # Get plays by genre from session history
    plays_by_genre = []
    for genre_name, count in sorted(genre_counts.items(), key=lambda x: -x[1])[:20]:
        plays_by_genre.append({
            "genre": genre_name,
            "count": count,
            "plays": count,
            "watch_time": 0,
        })

    # Get newest item
    newest_item = (
        db.query(Item)
        .filter(Item.library_id == library_id)
        .order_by(desc(Item.added_at))
        .first()
    )

    # Get oldest item
    oldest_item = (
        db.query(Item)
        .filter(Item.library_id == library_id)
        .order_by(Item.added_at)
        .first()
    )

    return {
        "library_id": library_id,
        "library_name": library.name,
        "total_items": library.total_items,
        "total_size_bytes": library.total_size,
        "item_type": library.item_type,
        "genres": genre_counts,
        "plays_by_genre": plays_by_genre,
        "newest_item": {
            "id": newest_item.id if newest_item else None,
            "name": newest_item.name if newest_item else None,
            "added_at": newest_item.added_at if newest_item else None,
        },
        "oldest_item": {
            "id": oldest_item.id if oldest_item else None,
            "name": oldest_item.name if oldest_item else None,
            "added_at": oldest_item.added_at if oldest_item else None,
        },
    }


@router.get("/{library_id}/recently-added")
async def get_library_recently_added(
    library_id: int,
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
):
    """Get recently added items from library."""
    # Verify library exists
    library = db.query(Library).filter(Library.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    jellyfin_url = _get_jellyfin_url(db)

    # Try local DB first
    query = db.query(Item).filter(Item.library_id == library_id)

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

    # If local DB is empty, fall back to Jellyfin API
    if not items:
        jellyfin_client = _get_jellyfin_client(db)
        if jellyfin_client:
            try:
                jellyfin_items = await jellyfin_client.get_library_items(library.jellyfin_id)
                # Sort by date created, newest first
                jellyfin_items.sort(key=lambda x: x.get("DateCreated", ""), reverse=True)
                jellyfin_items = jellyfin_items[:pagination.page_size]
                result = []
                for item_data in jellyfin_items:
                    mapped = _map_jellyfin_item_to_library_item(item_data, library_id, jellyfin_url)
                    result.append(mapped)
                await jellyfin_client.close()
                return result
            except Exception as e:
                logger.warning(f"Failed to fetch recently added items from Jellyfin: {e}")
                try:
                    await jellyfin_client.close()
                except Exception:
                    pass
        return []

    # Map DB items to response format
    result = []
    for item in items:
        poster_url = item.poster_url
        if poster_url and poster_url.startswith("/"):
            poster_url = f"{jellyfin_url}{poster_url}"

        backdrop_url = item.backdrop_url
        if backdrop_url and backdrop_url.startswith("/"):
            backdrop_url = f"{jellyfin_url}{backdrop_url}"

        # Parse genres from JSON string
        genres = []
        if item.genres:
            try:
                genres = json.loads(item.genres)
            except Exception:
                genres = [item.genres] if item.genres else []

        # Parse studios from JSON string
        studios = []
        if item.studios:
            try:
                studios = json.loads(item.studios)
            except Exception:
                studios = [item.studios] if item.studios else []

        result.append({
            "id": item.id,
            "jellyfin_id": item.jellyfin_id,
            "library_id": item.library_id,
            "item_type": item.item_type,
            "name": item.name,
            "sort_name": item.sort_name,
            "year": item.year,
            "premiere_date": item.premiere_date.isoformat() if item.premiere_date else None,
            "rating": item.rating,
            "community_rating": item.community_rating,
            "official_rating": item.official_rating,
            "runtime_ticks": item.runtime_ticks,
            "genres": genres,
            "studios": studios,
            "poster_url": poster_url,
            "backdrop_url": backdrop_url,
            "series_name": None,
            "season_number": item.season_number,
            "episode_number": item.episode_number,
            "added_at": item.added_at.isoformat() if item.added_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })

    return result


@router.get("/{library_id}/most-played")
async def get_library_most_played(
    library_id: int,
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    days: int = Query(default=30, ge=1, le=365, description="Number of days for stats"),
):
    """Get most played items from library."""
    # Verify library exists
    library = db.query(Library).filter(Library.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    jellyfin_url = _get_jellyfin_url(db)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    query = (
        db.query(
            Item,
            func.count(SessionHistory.id).label("play_count"),
        )
        .join(SessionHistory, Item.id == SessionHistory.item_id)
        .filter(
            Item.library_id == library_id,
            SessionHistory.started_at >= start_date
        )
        .group_by(Item.id)
        .order_by(desc(func.count(SessionHistory.id)))
    )

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    results = query.offset(offset).limit(pagination.page_size).all()

    result = []
    for item, _ in results:
        poster_url = item.poster_url
        if poster_url and poster_url.startswith("/"):
            poster_url = f"{jellyfin_url}{poster_url}"

        backdrop_url = item.backdrop_url
        if backdrop_url and backdrop_url.startswith("/"):
            backdrop_url = f"{jellyfin_url}{backdrop_url}"

        # Parse genres from JSON string
        genres = []
        if item.genres:
            try:
                genres = json.loads(item.genres)
            except Exception:
                genres = [item.genres] if item.genres else []

        # Parse studios from JSON string
        studios = []
        if item.studios:
            try:
                studios = json.loads(item.studios)
            except Exception:
                studios = [item.studios] if item.studios else []

        result.append({
            "id": item.id,
            "jellyfin_id": item.jellyfin_id,
            "library_id": item.library_id,
            "item_type": item.item_type,
            "name": item.name,
            "sort_name": item.sort_name,
            "year": item.year,
            "premiere_date": item.premiere_date.isoformat() if item.premiere_date else None,
            "rating": item.rating,
            "community_rating": item.community_rating,
            "official_rating": item.official_rating,
            "runtime_ticks": item.runtime_ticks,
            "genres": genres,
            "studios": studios,
            "poster_url": poster_url,
            "backdrop_url": backdrop_url,
            "series_name": None,
            "season_number": item.season_number,
            "episode_number": item.episode_number,
            "added_at": item.added_at.isoformat() if item.added_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })

    return result


@router.get("/{library_id}/items")
async def get_library_items(
    library_id: int,
    db: Session = Depends(get_db),
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(default=None, description="Search query"),
    item_type: Optional[str] = Query(default=None, description="Filter by item type"),
):
    """Browse library items (paginated)."""
    # Verify library exists
    library = db.query(Library).filter(Library.id == library_id).first()
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    jellyfin_url = _get_jellyfin_url(db)

    query = db.query(Item).filter(Item.library_id == library_id)

    # Apply search filter
    if search:
        query = query.filter(Item.name.ilike(f"%{search}%"))

    # Apply type filter
    if item_type:
        query = query.filter(Item.item_type == item_type)

    # Get total count for pagination
    total = query.count()

    # Apply sorting
    if pagination.sort_by:
        sort_column = getattr(Item, pagination.sort_by, None)
        if sort_column is not None:
            if pagination.sort_order == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
    else:
        query = query.order_by(Item.sort_name)

    # Apply pagination
    offset = (pagination.page - 1) * pagination.page_size
    items = query.offset(offset).limit(pagination.page_size).all()

    result = []
    for item in items:
        poster_url = item.poster_url
        if poster_url and poster_url.startswith("/"):
            poster_url = f"{jellyfin_url}{poster_url}"

        backdrop_url = item.backdrop_url
        if backdrop_url and backdrop_url.startswith("/"):
            backdrop_url = f"{jellyfin_url}{backdrop_url}"

        # Parse genres from JSON string
        genres = []
        if item.genres:
            try:
                genres = json.loads(item.genres)
            except Exception:
                genres = [item.genres] if item.genres else []

        # Parse studios from JSON string
        studios = []
        if item.studios:
            try:
                studios = json.loads(item.studios)
            except Exception:
                studios = [item.studios] if item.studios else []

        result.append({
            "id": item.id,
            "jellyfin_id": item.jellyfin_id,
            "library_id": item.library_id,
            "item_type": item.item_type,
            "name": item.name,
            "sort_name": item.sort_name,
            "year": item.year,
            "premiere_date": item.premiere_date.isoformat() if item.premiere_date else None,
            "rating": item.rating,
            "community_rating": item.community_rating,
            "official_rating": item.official_rating,
            "runtime_ticks": item.runtime_ticks,
            "genres": genres,
            "studios": studios,
            "poster_url": poster_url,
            "backdrop_url": backdrop_url,
            "series_name": None,
            "season_number": item.season_number,
            "episode_number": item.episode_number,
            "added_at": item.added_at.isoformat() if item.added_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })

    return {
        "items": result,
        "total": total,
        "page": pagination.page,
        "limit": pagination.page_size,
    }