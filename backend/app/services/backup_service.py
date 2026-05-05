"""Backup/restore service for Jellyfin watch stats."""
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .jellyfin import JellyfinClient, JellyfinClientError
from ..models.backup import BackupJob
from ..models.user import User
from ..database import SessionLocal
from ..config import settings

logger = logging.getLogger(__name__)


class BackupService:
    """Service for exporting and importing Jellyfin watch statistics."""

    def __init__(self, jellyfin_client: Optional[JellyfinClient] = None):
        """Initialize the backup service.

        Args:
            jellyfin_client: Optional JellyfinClient instance. If None, creates a new one.
        """
        self.jellyfin_client = jellyfin_client

    def _get_db(self) -> Session:
        """Get a database session."""
        return SessionLocal()

    def _get_backup_dir(self) -> Path:
        """Get the backup directory path."""
        backup_dir = Path(settings.data_dir) / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir

    def _update_job_progress(
        self,
        db: Session,
        job: BackupJob,
        progress: Optional[float] = None,
        current_step: Optional[str] = None,
        processed: Optional[int] = None,
        matched: Optional[int] = None,
        unmatched: Optional[int] = None,
        errors: Optional[int] = None,
        error_log: Optional[list] = None,
    ) -> None:
        """Update backup job progress.

        Args:
            db: Database session
            job: BackupJob instance
            progress: Progress percentage (0-100)
            current_step: Human-readable progress description
            processed: Number of items processed
            matched: Number of items matched
            unmatched: Number of items unmatched
            errors: Number of errors
            error_log: List of error messages
        """
        if progress is not None:
            job.progress = progress
        if current_step is not None:
            job.current_step = current_step
        if processed is not None:
            job.processed = processed
        if matched is not None:
            job.matched = matched
        if unmatched is not None:
            job.unmatched = unmatched
        if errors is not None:
            job.errors = errors
        if error_log is not None:
            job.error_log = json.dumps(error_log)
        db.commit()

    async def export_watch_stats(self, job_id: str) -> Dict[str, Any]:
        """Export all user watch data from Jellyfin to JSON.

        For each user, fetch all items with UserData via Jellyfin API.
        Includes: ItemId, Name, Type, Year, ProviderIds, PlayCount, Played,
        LastPlayedDate, PlaybackPositionTicks, PlayedPercentage, IsFavorite,
        Rating, Likes, UnplayedItemCount.

        Rate limiting: 50ms between items, 500 per batch, 2s between batches.

        Args:
            job_id: Backup job ID

        Returns:
            Dictionary with export statistics and filename
        """
        stats = {
            "total_users": 0,
            "total_items": 0,
            "filename": None,
            "errors": 0,
        }

        try:
            db = self._get_db()

            try:
                # Get the backup job
                job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
                if not job:
                    raise ValueError(f"Backup job {job_id} not found")

                job.status = "running"
                job.current_step = "Starting export..."
                job.progress = 0
                db.commit()

                # Get server info
                server_info = await self.jellyfin_client.get_server_info()

                # Get all users
                users = await self.jellyfin_client.get_users()
                stats["total_users"] = len(users)
                job.total_users = len(users)
                db.commit()

                # Prepare backup data structure
                backup_data = {
                    "jellyview_version": "1.0.0",
                    "exported_at": datetime.utcnow().isoformat() + "Z",
                    "source_server": {
                        "name": server_info.get("ServerName", "Unknown"),
                        "version": server_info.get("Version", "Unknown"),
                        "id": server_info.get("Id", "Unknown"),
                    },
                    "users": [],
                    "stats": {
                        "total_users": 0,
                        "total_items": 0,
                        "total_watch_records": 0,
                    },
                }

                total_items = 0

                # Export data for each user
                for user_idx, user in enumerate(users):
                    try:
                        user_id = user.get("Id")
                        username = user.get("Name")
                        jellyfin_id = user.get("Id")

                        if not user_id or not username:
                            logger.warning(f"User missing ID or Name: {user}")
                            stats["errors"] += 1
                            continue

                        job.current_step = f"Exporting user {user_idx + 1}/{len(users)}: {username}"
                        user_progress = (user_idx / len(users)) * 100
                        job.progress = user_progress
                        db.commit()

                        logger.info(f"Exporting data for user: {username}")

                        # Get all items with user data
                        items = []
                        page = 0
                        batch_size = 500
                        batch_delay = 2.0  # seconds between batches
                        item_delay = 0.05  # 50ms between items

                        while True:
                            # Fetch batch of items
                            try:
                                params = {
                                    "UserId": user_id,
                                    "Recursive": True,
                                    "IncludeItemTypes": "Movie,Episode,Series",
                                    "Limit": batch_size,
                                    "StartIndex": page * batch_size,
                                }

                                data = await self.jellyfin_client._request("GET", "/Users/{user_id}/Items".format(user_id=user_id), params=params)

                                if isinstance(data, dict):
                                    batch_items = data.get("Items", [])
                                elif isinstance(data, list):
                                    batch_items = data
                                else:
                                    batch_items = []

                                if not batch_items:
                                    # No more items
                                    break

                                logger.debug(f"Found {len(batch_items)} items for user {username} (batch {page})")

                                # Process each item in the batch
                                for item in batch_items:
                                    try:
                                        item_id = item.get("Id")
                                        if not item_id:
                                            continue

                                        # Get user data for this item
                                        user_data = await self.jellyfin_client.get_user_data(user_id, item_id)

                                        # Build backup entry
                                        backup_entry = {
                                            "item_id": item_id,
                                            "name": item.get("Name"),
                                            "type": item.get("Type"),
                                            "year": item.get("ProductionYear"),
                                            "series_name": item.get("SeriesName"),
                                            "season_number": item.get("ParentIndexNumber"),
                                            "episode_number": item.get("IndexNumber"),
                                            "provider_ids": item.get("ProviderIds") or {},
                                            # UserData fields
                                            "play_count": user_data.get("PlayCount", 0),
                                            "played": user_data.get("Played", False),
                                            "last_played_date": user_data.get("LastPlayedDate"),
                                            "playback_position_ticks": user_data.get("PlaybackPositionTicks", 0),
                                            "played_percentage": user_data.get("PlayedPercentage", 0.0),
                                            "is_favorite": user_data.get("IsFavorite", False),
                                            "rating": user_data.get("Rating"),
                                            "likes": user_data.get("Likes"),
                                            "unplayed_item_count": user_data.get("UnplayedItemCount", 0),
                                        }

                                        items.append(backup_entry)
                                        total_items += 1
                                        job.total_items = total_items
                                        db.commit()

                                        # Rate limiting between items
                                        if item_delay > 0:
                                            await asyncio.sleep(item_delay)

                                    except JellyfinClientError as e:
                                        logger.warning(f"Failed to get user data for item {item.get('Id')}: {e}")
                                        stats["errors"] += 1

                                # Rate limiting between batches
                                if batch_delay > 0:
                                    await asyncio.sleep(batch_delay)

                                page += 1

                            except JellyfinClientError as e:
                                logger.error(f"Failed to fetch items batch {page} for user {username}: {e}")
                                stats["errors"] += 1
                                break

                        # Add user data to backup
                        user_backup = {
                            "username": username,
                            "jellyfin_id": jellyfin_id,
                            "item_count": len(items),
                            "items": items,
                        }
                        backup_data["users"].append(user_backup)

                        logger.info(f"Exported {len(items)} items for user {username}")

                    except Exception as e:
                        logger.error(f"Error exporting user {user}: {e}", exc_info=True)
                        stats["errors"] += 1
                        continue

                # Update backup stats
                stats["total_items"] = total_items
                backup_data["stats"]["total_users"] = len(backup_data["users"])
                backup_data["stats"]["total_items"] = total_items
                backup_data["stats"]["total_watch_records"] = total_items

                # Generate filename
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                filename = f"watch_stats_backup_{timestamp}.json"
                filepath = self._get_backup_dir() / filename

                # Write backup file
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(backup_data, f, indent=2, ensure_ascii=False)

                stats["filename"] = filename

                # Update job as completed
                job.status = "completed"
                job.filename = filename
                job.progress = 100
                job.current_step = "Export completed"
                job.processed = total_items
                job.completed_at = datetime.utcnow()
                db.commit()

                logger.info(
                    f"Export completed: {len(backup_data['users'])} users, "
                    f"{total_items} items, {stats['errors']} errors"
                )

            except Exception as e:
                if job:
                    job.status = "failed"
                    job.current_step = f"Export failed: {str(e)}"
                    job.error_log = json.dumps([str(e)])
                    db.commit()
                logger.error(f"Export failed: {e}", exc_info=True)
                raise

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to export watch stats: {e}", exc_info=True)
            stats["errors"] += 1
            raise

        return stats

    async def _find_matching_item(
        self,
        backup_item: Dict[str, Any],
        target_user_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Find matching item on target server using provider IDs or fallback to name search.

        Args:
            backup_item: Item data from backup
            target_user_id: User ID on target server

        Returns:
            Matched item dict with 'Id' field, or None if not found
        """
        provider_ids = backup_item.get("provider_ids", {})

        # Try provider ID match first
        if provider_ids:
            try:
                # Jellyfin API supports searching by provider IDs
                # Format: searchProviderIds={"tmdb": "456"}
                params = {
                    "IncludeItemTypes": backup_item.get("type"),
                    "UserId": target_user_id,
                    "Recursive": True,
                    "Limit": 10,
                }

                # Add provider IDs to search
                provider_search = {}
                for provider, value in provider_ids.items():
                    if value:
                        provider_search[provider] = value

                if provider_search:
                    # Build searchProviderIds parameter
                    # Format: searchProviderIds={"tmdb":"456","tvdb":"789"}
                    params["searchProviderIds"] = json.dumps(provider_search)

                    data = await self.jellyfin_client._request("GET", "/Items", params=params)

                    if isinstance(data, dict):
                        items = data.get("Items", [])
                    elif isinstance(data, list):
                        items = data
                    else:
                        items = []

                    # Look for exact match on provider IDs
                    for item in items:
                        item_provider_ids = item.get("ProviderIds") or {}
                        # Check if all provider IDs match
                        match = all(
                            item_provider_ids.get(k) == v
                            for k, v in provider_ids.items()
                            if v
                        )
                        if match:
                            logger.debug(
                                f"Matched item by provider IDs: {backup_item.get('name')} -> {item.get('Id')}"
                            )
                            return item

            except JellyfinClientError as e:
                logger.warning(f"Provider ID search failed for {backup_item.get('name')}: {e}")

        # Fallback to name + year + type search
        try:
            params = {
                "searchTerm": backup_item.get("name"),
                "IncludeItemTypes": backup_item.get("type"),
                "UserId": target_user_id,
                "Recursive": True,
                "Limit": 20,
            }

            year = backup_item.get("year")
            if year:
                params["Years"] = year

            data = await self.jellyfin_client._request("GET", "/Items", params=params)

            if isinstance(data, dict):
                items = data.get("Items", [])
            elif isinstance(data, list):
                items = data
            else:
                items = []

            # Handle matches
            if len(items) == 1:
                # Single match - use it
                logger.debug(
                    f"Matched item by name search: {backup_item.get('name')} -> {items[0].get('Id')}"
                )
                return items[0]
            elif len(items) > 1:
                # Multiple matches - try to narrow down
                # For episodes, check series name, season, episode
                if backup_item.get("type") == "Episode":
                    series_name = backup_item.get("series_name")
                    season = backup_item.get("season_number")
                    episode = backup_item.get("episode_number")

                    if series_name or season is not None or episode is not None:
                        for item in items:
                            match = True
                            if series_name and item.get("SeriesName") != series_name:
                                match = False
                            if season is not None and item.get("ParentIndexNumber") != season:
                                match = False
                            if episode is not None and item.get("IndexNumber") != episode:
                                match = False
                            if match:
                                logger.debug(
                                    f"Matched episode by details: {backup_item.get('name')} -> {item.get('Id')}"
                                )
                                return item

                logger.warning(
                    f"Multiple matches for '{backup_item.get('name')}' ({year}), skipping"
                )
                return None
            else:
                # No matches
                return None

        except JellyfinClientError as e:
            logger.warning(f"Name search failed for {backup_item.get('name')}: {e}")

        return None

    async def import_watch_stats(
        self,
        job_id: str,
        backup_data: Dict[str, Any],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """Import watch stats from JSON backup to Jellyfin.

        For each (user, item) in backup:
        - Match user by username
        - Try provider ID match first, fallback to name+year+type search
        - Update UserData via Jellyfin API if match found

        Rate limiting: 150ms between items, 50 per batch, 5s between batches.

        Args:
            job_id: Backup job ID
            backup_data: Parsed backup JSON data
            dry_run: If True, analyze without making changes

        Returns:
            Dictionary with import statistics
        """
        stats = {
            "total_users": 0,
            "matched_users": 0,
            "total_items": 0,
            "processed": 0,
            "matched": 0,
            "unmatched": 0,
            "skipped": 0,
            "errors": 0,
        }

        error_log = []

        try:
            db = self._get_db()

            try:
                # Get the backup job
                job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
                if not job:
                    raise ValueError(f"Backup job {job_id} not found")

                job.status = "running"
                job.current_step = "Starting import..."
                job.progress = 0
                job.dry_run = dry_run
                db.commit()

                # Get users from backup
                backup_users = backup_data.get("users", [])
                stats["total_users"] = len(backup_users)
                job.total_users = len(backup_users)
                db.commit()

                # Get current users from server for matching
                server_users = await self.jellyfin_client.get_users()
                username_to_id = {user.get("Name"): user.get("Id") for user in server_users if user.get("Name")}

                logger.info(f"Found {len(username_to_id)} users on target server")

                total_items = 0
                matched_items = 0
                unmatched_items = 0
                skipped_items = 0
                error_count = 0

                # Import data for each user
                for user_idx, backup_user in enumerate(backup_users):
                    try:
                        username = backup_user.get("username")
                        backup_items = backup_user.get("items", [])

                        if not username:
                            logger.warning("Backup user missing username")
                            stats["errors"] += 1
                            continue

                        # Find matching user on server
                        target_user_id = username_to_id.get(username)
                        if not target_user_id:
                            logger.warning(f"User '{username}' not found on target server, skipping")
                            error_log.append({
                                "type": "user_not_found",
                                "username": username,
                                "message": f"User '{username}' not found on target server",
                            })
                            error_count += 1
                            continue

                        stats["matched_users"] += 1

                        job.current_step = f"Importing for user {user_idx + 1}/{len(backup_users)}: {username}"
                        user_progress = (user_idx / len(backup_users)) * 100
                        job.progress = user_progress
                        db.commit()

                        logger.info(
                            f"Processing {len(backup_items)} items for user: {username}"
                            + (" (dry run)" if dry_run else "")
                        )

                        # Process items in batches
                        batch_size = 50
                        batch_delay = 5.0  # seconds between batches
                        item_delay = 0.15  # 150ms between items

                        for batch_start in range(0, len(backup_items), batch_size):
                            batch_end = min(batch_start + batch_size, len(backup_items))
                            batch = backup_items[batch_start:batch_end]

                            for backup_item in batch:
                                total_items += 1

                                try:
                                    # Find matching item on target server
                                    matched_item = await self._find_matching_item(
                                        backup_item, target_user_id
                                    )

                                    if not matched_item:
                                        # No match found
                                        unmatched_items += 1
                                        logger.debug(
                                            f"No match for item: {backup_item.get('name')} "
                                            f"({backup_item.get('year')})"
                                        )
                                        continue

                                    matched_item_id = matched_item.get("Id")
                                    if not matched_item_id:
                                        unmatched_items += 1
                                        continue

                                    # Get current user data for the matched item
                                    try:
                                        current_user_data = await self.jellyfin_client.get_user_data(
                                            target_user_id, matched_item_id
                                        )
                                    except JellyfinClientError:
                                        current_user_data = {}

                                    # Check if data needs updating
                                    needs_update = False

                                    # Compare key fields
                                    if backup_item.get("played") != current_user_data.get("Played"):
                                        needs_update = True
                                    if backup_item.get("play_count", 0) != current_user_data.get("PlayCount", 0):
                                        needs_update = True
                                    if abs(
                                        backup_item.get("playback_position_ticks", 0)
                                        - current_user_data.get("PlaybackPositionTicks", 0)
                                    ) > 10000:  # Allow 1ms tolerance (10,000 ticks)
                                        needs_update = True
                                    if backup_item.get("is_favorite") != current_user_data.get("IsFavorite"):
                                        needs_update = True
                                    if backup_item.get("rating") != current_user_data.get("Rating"):
                                        needs_update = True

                                    if not needs_update:
                                        skipped_items += 1
                                        logger.debug(
                                            f"Skipping up-to-date item: {backup_item.get('name')}"
                                        )
                                        continue

                                    # Update user data
                                    if not dry_run:
                                        update_data = {
                                            "Played": backup_item.get("played", False),
                                            "PlayCount": backup_item.get("play_count", 0),
                                            "PlaybackPositionTicks": backup_item.get(
                                                "playback_position_ticks", 0
                                            ),
                                            "IsFavorite": backup_item.get("is_favorite", False),
                                        }

                                        # Optional fields
                                        if backup_item.get("rating") is not None:
                                            update_data["Rating"] = backup_item.get("rating")

                                        try:
                                            await self.jellyfin_client.update_user_data(
                                                target_user_id, matched_item_id, update_data
                                            )
                                            matched_items += 1
                                            logger.debug(
                                                f"Updated user data for: {backup_item.get('name')}"
                                            )
                                        except JellyfinClientError as e:
                                            logger.error(
                                                f"Failed to update user data for {backup_item.get('name')}: {e}"
                                            )
                                            error_count += 1
                                            error_log.append({
                                                "type": "update_failed",
                                                "item_name": backup_item.get("name"),
                                                "user": username,
                                                "message": str(e),
                                            })
                                    else:
                                        matched_items += 1
                                        logger.debug(
                                            f"[DRY RUN] Would update: {backup_item.get('name')}"
                                        )

                                    # Rate limiting between items
                                    if item_delay > 0:
                                        await asyncio.sleep(item_delay)

                                except Exception as e:
                                    logger.error(f"Error processing item {backup_item.get('name')}: {e}")
                                    error_count += 1
                                    error_log.append({
                                        "type": "item_error",
                                        "item_name": backup_item.get("name"),
                                        "user": username,
                                        "message": str(e),
                                    })

                            # Rate limiting between batches
                            if batch_delay > 0 and batch_end < len(backup_items):
                                await asyncio.sleep(batch_delay)

                            # Update progress
                            processed = total_items
                            self._update_job_progress(
                                db, job, processed=processed, matched=matched_items,
                                unmatched=unmatched_items, errors=error_count,
                            )

                    except Exception as e:
                        logger.error(f"Error importing user {username}: {e}", exc_info=True)
                        error_count += 1
                        error_log.append({
                            "type": "user_error",
                            "username": username,
                            "message": str(e),
                        })
                        continue

                # Final stats
                stats["total_items"] = total_items
                stats["processed"] = total_items
                stats["matched"] = matched_items
                stats["unmatched"] = unmatched_items
                stats["skipped"] = skipped_items
                stats["errors"] = error_count

                # Update job
                job.status = "completed"
                job.progress = 100
                job.processed = total_items
                job.matched = matched_items
                job.unmatched = unmatched_items
                job.errors = error_count
                job.completed_at = datetime.utcnow()
                if error_log:
                    job.error_log = json.dumps(error_log)
                db.commit()

                logger.info(
                    f"Import completed: {stats['matched_users']}/{stats['total_users']} users, "
                    f"{matched_items} items updated, {skipped_items} skipped, "
                    f"{unmatched_items} unmatched, {error_count} errors"
                    + (" (dry run)" if dry_run else "")
                )

            except Exception as e:
                if job:
                    job.status = "failed"
                    job.current_step = f"Import failed: {str(e)}"
                    job.error_log = json.dumps(error_log + [{"type": "fatal", "message": str(e)}])
                    job.errors = error_count
                    db.commit()
                logger.error(f"Import failed: {e}", exc_info=True)
                raise

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to import watch stats: {e}", exc_info=True)
            raise

        return stats

    async def analyze_import(self, backup_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze what would be imported (for dry-run).

        Returns a preview of the import without making changes.

        Args:
            backup_data: Parsed backup JSON data

        Returns:
            Dictionary with analysis results including:
            - total_users: Number of users in backup
            - matched_users: Number of users that exist on target server
            - unmatched_users: List of users not found on target server
            - total_items: Total number of items in backup
            - matched_items: Number of items that would be matched
            - unmatched_items: Number of items that would not be matched
            - skipped_items: Number of items that are already up to date
            - items_per_user: Breakdown of items per user
        """
        analysis = {
            "total_users": 0,
            "matched_users": 0,
            "unmatched_users": [],
            "total_items": 0,
            "matched_items": 0,
            "unmatched_items": 0,
            "skipped_items": 0,
            "items_per_user": [],
        }

        try:
            # Get users from backup
            backup_users = backup_data.get("users", [])
            analysis["total_users"] = len(backup_users)

            # Get current users from server
            server_users = await self.jellyfin_client.get_users()
            username_to_id = {user.get("Name"): user.get("Id") for user in server_users if user.get("Name")}

            logger.info(f"Analyzing import for {len(backup_users)} users")

            total_items = 0
            total_matched = 0
            total_unmatched = 0
            total_skipped = 0

            for backup_user in backup_users:
                username = backup_user.get("username")
                backup_items = backup_user.get("items", [])
                item_count = len(backup_items)

                if not username:
                    continue

                user_analysis = {
                    "username": username,
                    "exists_on_server": username in username_to_id,
                    "total_items": item_count,
                    "matched_items": 0,
                    "unmatched_items": 0,
                    "skipped_items": 0,
                }

                # Find matching user on server
                target_user_id = username_to_id.get(username)
                if not target_user_id:
                    analysis["unmatched_users"].append(username)
                    user_analysis["unmatched_items"] = item_count
                    analysis["items_per_user"].append(user_analysis)
                    total_items += item_count
                    total_unmatched += item_count
                    continue

                analysis["matched_users"] += 1

                # Analyze each item
                for backup_item in backup_items:
                    total_items += 1

                    try:
                        # Find matching item
                        matched_item = await self._find_matching_item(
                            backup_item, target_user_id
                        )

                        if not matched_item:
                            user_analysis["unmatched_items"] += 1
                            total_unmatched += 1
                            continue

                        matched_item_id = matched_item.get("Id")
                        if not matched_item_id:
                            user_analysis["unmatched_items"] += 1
                            total_unmatched += 1
                            continue

                        # Get current user data
                        try:
                            current_user_data = await self.jellyfin_client.get_user_data(
                                target_user_id, matched_item_id
                            )
                        except JellyfinClientError:
                            current_user_data = {}

                        # Check if data needs updating
                        needs_update = (
                            backup_item.get("played") != current_user_data.get("Played")
                            or backup_item.get("play_count", 0) != current_user_data.get("PlayCount", 0)
                            or abs(
                                backup_item.get("playback_position_ticks", 0)
                                - current_user_data.get("PlaybackPositionTicks", 0)
                            ) > 10000
                            or backup_item.get("is_favorite") != current_user_data.get("IsFavorite")
                            or backup_item.get("rating") != current_user_data.get("Rating")
                        )

                        if needs_update:
                            user_analysis["matched_items"] += 1
                            total_matched += 1
                        else:
                            user_analysis["skipped_items"] += 1
                            total_skipped += 1

                    except Exception as e:
                        logger.warning(f"Error analyzing item {backup_item.get('name')}: {e}")
                        user_analysis["unmatched_items"] += 1
                        total_unmatched += 1

                analysis["items_per_user"].append(user_analysis)

            # Final analysis
            analysis["total_items"] = total_items
            analysis["matched_items"] = total_matched
            analysis["unmatched_items"] = total_unmatched
            analysis["skipped_items"] = total_skipped

            logger.info(
                f"Analysis complete: {analysis['matched_users']}/{analysis['total_users']} users, "
                f"{total_matched} items to update, {total_skipped} skipped, "
                f"{total_unmatched} unmatched"
            )

        except Exception as e:
            logger.error(f"Failed to analyze import: {e}", exc_info=True)
            raise

        return analysis
