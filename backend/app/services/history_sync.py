"""Playback history sync service for syncing Jellyfin playback history to the database."""
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from .jellyfin import JellyfinClient, JellyfinClientError
from ..models.session import SessionHistory
from ..models.user import User
from ..models.item import Item
from ..models.library import Library
from ..database import SessionLocal

logger = logging.getLogger(__name__)


class HistorySyncService:
    """Service for syncing playback history from Jellyfin server."""

    def __init__(self, jellyfin_client: Optional[JellyfinClient] = None):
        self.jellyfin_client = jellyfin_client

    def _get_db(self) -> Session:
        return SessionLocal()

    async def sync_history(self) -> dict:
        """Sync playback history from Jellyfin to the database.

        Fetches played items per user and records them as session history.
        """
        stats = {
            "total": 0,
            "created": 0,
            "skipped": 0,
            "errors": 0,
        }

        try:
            db = self._get_db()

            try:
                users = await self.jellyfin_client.get_users()
                stats["total"] = len(users)

                for jellyfin_user in users:
                    try:
                        user_jellyfin_id = jellyfin_user.get("Id")
                        username = jellyfin_user.get("Name", "Unknown")

                        if not user_jellyfin_id:
                            continue

                        user = db.query(User).filter(
                            User.jellyfin_id == user_jellyfin_id
                        ).first()

                        if not user:
                            logger.debug(f"User {username} not in DB, skipping history")
                            continue

                        played_items = await self.jellyfin_client.get_playback_history(
                            user_id=user_jellyfin_id, limit=500
                        )

                        for item_data in played_items:
                            try:
                                item_jellyfin_id = item_data.get("Id")
                                item_name = item_data.get("Name", "Unknown")
                                item_type = item_data.get("Type", "Unknown")

                                user_data = item_data.get("UserData", {})
                                play_count = user_data.get("PlayCount", 0) or 0
                                played = user_data.get("Played", False)
                                playback_position_ticks = user_data.get("PlaybackPositionTicks", 0) or 0
                                last_played_str = user_data.get("LastPlayedDate")

                                run_time_ticks = item_data.get("RunTimeTicks", 0) or 0
                                duration_seconds = run_time_ticks // 10000000 if run_time_ticks else None

                                if run_time_ticks and playback_position_ticks:
                                    completion_pct = round((playback_position_ticks / run_time_ticks) * 100, 2)
                                elif played:
                                    completion_pct = 100.0
                                else:
                                    completion_pct = 0.0

                                series_name = item_data.get("SeriesName")
                                season_number = item_data.get("ParentIndexNumber")
                                episode_number = item_data.get("IndexNumber")
                                year = item_data.get("ProductionYear")
                                media_type = item_data.get("Type", "Unknown")

                                parent_id = item_data.get("ParentId")
                                series_id = item_data.get("SeriesId")

                                started_at = None
                                if last_played_str:
                                    try:
                                        started_at = datetime.fromisoformat(
                                            last_played_str.replace('Z', '+00:00')
                                        )
                                    except (ValueError, AttributeError):
                                        started_at = datetime.utcnow()
                                else:
                                    started_at = datetime.utcnow()

                                unique_key = f"{user_jellyfin_id}_{item_jellyfin_id}" if play_count <= 1 else f"{user_jellyfin_id}_{item_jellyfin_id}_{play_count}"

                                existing = db.query(SessionHistory).filter(
                                    SessionHistory.jellyfin_id == item_jellyfin_id,
                                    SessionHistory.user_id == user.id,
                                ).first()

                                if existing:
                                    existing.play_count = play_count
                                    existing.completion_pct = completion_pct
                                    existing.duration = duration_seconds or existing.duration
                                    existing.item_name = item_name
                                    existing.item_type = item_type
                                    existing.media_type = media_type
                                    existing.series_name = series_name
                                    existing.season_number = season_number
                                    existing.episode_number = episode_number
                                    existing.year = year
                                    existing.started_at = started_at
                                    existing.stopped_at = started_at
                                    existing.playback_position_ticks = playback_position_ticks

                                    if item_jellyfin_id:
                                        db_item = db.query(Item).filter(
                                            Item.jellyfin_id == item_jellyfin_id
                                        ).first()
                                        if db_item:
                                            existing.item_id = db_item.id
                                            if db_item.library_id:
                                                existing.library_id = db_item.library_id

                                    stats["skipped"] += 1
                                    continue

                                item_rec = None
                                if item_jellyfin_id:
                                    item_rec = db.query(Item).filter(
                                        Item.jellyfin_id == item_jellyfin_id
                                    ).first()

                                library_rec = None
                                if item_rec and item_rec.library_id:
                                    library_rec = db.query(Library).get(item_rec.library_id)

                                history = SessionHistory(
                                    jellyfin_id=item_jellyfin_id or f"hist_{stats['created']}",
                                    user_id=user.id,
                                    item_id=item_rec.id if item_rec else None,
                                    library_id=library_rec.id if library_rec else None,
                                    started_at=started_at,
                                    stopped_at=started_at,
                                    duration=duration_seconds,
                                    paused_duration=0,
                                    play_count=play_count,
                                    completion_pct=completion_pct,
                                    client=None,
                                    device=None,
                                    device_id=None,
                                    ip_address=None,
                                    video_codec=item_data.get("MediaSources", [{}])[0].get("MediaStreams", [{}])[0].get("Codec") if item_data.get("MediaSources") else None,
                                    audio_codec=None,
                                    container=item_data.get("Container"),
                                    width=item_data.get("Width"),
                                    height=item_data.get("Height"),
                                    bitrate=item_data.get("MediaSources", [{}])[0].get("Bitrate") if item_data.get("MediaSources") else None,
                                    transcode=False,
                                    transcode_reason=None,
                                    transcode_hw=None,
                                    media_type=media_type,
                                    item_name=item_name,
                                    item_type=item_type,
                                    series_name=series_name,
                                    season_number=season_number,
                                    episode_number=episode_number,
                                    year=year,
                                    playback_position_ticks=playback_position_ticks,
                                )
                                db.add(history)
                                stats["created"] += 1

                            except Exception as e:
                                logger.error(f"Error syncing history item: {e}")
                                stats["errors"] += 1

                        from sqlalchemy import func
                        user.total_plays = db.query(func.sum(SessionHistory.play_count)).filter(
                            SessionHistory.user_id == user.id
                        ).scalar() or 0
                        user.total_watch_time = db.query(func.sum(SessionHistory.duration)).filter(
                            SessionHistory.user_id == user.id
                        ).scalar() or 0

                    except Exception as e:
                        logger.error(f"Error syncing history for user {jellyfin_user.get('Name', 'unknown')}: {e}")
                        stats["errors"] += 1

                db.commit()
                logger.info(
                    f"History sync completed: {stats['created']} created, "
                    f"{stats['skipped']} updated, {stats['errors']} errors"
                )

            except Exception as e:
                db.rollback()
                logger.error(f"Error during history sync: {e}", exc_info=True)
                raise
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to sync history: {e}", exc_info=True)
            stats["errors"] += 1

        return stats