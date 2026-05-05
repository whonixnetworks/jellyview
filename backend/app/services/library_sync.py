"""Library sync service for syncing Jellyfin libraries to the database."""
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from .jellyfin import JellyfinClient, JellyfinClientError
from ..models.library import Library
from ..models.item import Item
from ..database import SessionLocal

logger = logging.getLogger(__name__)


class LibrarySyncService:
    """Service for syncing libraries from Jellyfin server."""

    def __init__(self, jellyfin_client: Optional[JellyfinClient] = None):
        """Initialize the library sync service.

        Args:
            jellyfin_client: Optional JellyfinClient instance. If None, creates a new one.
        """
        self.jellyfin_client = jellyfin_client

    def _get_db(self) -> Session:
        """Get a database session."""
        return SessionLocal()

    async def sync_libraries(self) -> dict:
        """Sync libraries from Jellyfin to the database.

        This method:
        - Fetches the library list from Jellyfin
        - Syncs item counts per library
        - Updates library metadata (name, item_type, total_items, total_size)
        - Creates new libraries or updates existing ones
        - Stores items from each library in the items table

        Returns:
            Dictionary with sync statistics (total, created, updated, errors)
        """
        stats = {
            "total": 0,
            "created": 0,
            "updated": 0,
            "errors": 0,
        }

        try:
            db = self._get_db()

            try:
                # Fetch libraries from Jellyfin
                logger.info("Fetching libraries from Jellyfin...")
                jellyfin_libraries = await self.jellyfin_client.get_libraries()
                stats["total"] = len(jellyfin_libraries)

                logger.info(f"Found {len(jellyfin_libraries)} libraries to sync")

                for jellyfin_lib in jellyfin_libraries:
                    try:
                        # Extract library data from Jellyfin response
                        jellyfin_id = jellyfin_lib.get("Id") or jellyfin_lib.get("ItemId")
                        name = jellyfin_lib.get("Name")
                        item_type = jellyfin_lib.get("CollectionType")
                        total_items = jellyfin_lib.get("ChildCount", 0)

                        if not jellyfin_id:
                            logger.warning(f"Library missing ID: {jellyfin_lib}")
                            stats["errors"] += 1
                            continue

                        # Check if library exists
                        library = db.query(Library).filter(
                            Library.jellyfin_id == jellyfin_id
                        ).first()

                        if library:
                            # Update existing library
                            library.name = name
                            library.item_type = item_type
                            library.total_items = total_items
                            logger.debug(f"Updated library: {name}")
                            stats["updated"] += 1
                        else:
                            # Create new library
                            library = Library(
                                jellyfin_id=jellyfin_id,
                                name=name,
                                item_type=item_type,
                                total_items=total_items,
                                total_size=0,  # Will be updated when syncing items
                            )
                            db.add(library)
                            db.flush()  # Get the library ID
                            logger.info(f"Created new library: {name}")
                            stats["created"] += 1

                        # Fetch items to get accurate count and size, and store them
                        try:
                            library_items = await self.jellyfin_client.get_library_items(jellyfin_id)
                            library.total_items = len(library_items)

                            # Calculate total size (if available)
                            total_size = 0
                            for item in library_items:
                                size_bytes = item.get("Size", 0)
                                total_size += size_bytes if size_bytes else 0
                            library.total_size = total_size

                            # Store items in the database
                            item_created = 0
                            item_updated = 0
                            for item_data in library_items:
                                try:
                                    item_jellyfin_id = item_data.get("Id")
                                    if not item_jellyfin_id:
                                        continue

                                    # Check if item exists
                                    existing_item = db.query(Item).filter(
                                        Item.jellyfin_id == item_jellyfin_id
                                    ).first()

                                    # Parse image tags for poster/backdrop URLs
                                    image_tags = item_data.get("ImageTags", {})
                                    poster_url = None
                                    if image_tags and image_tags.get("Primary"):
                                        poster_url = f"/Items/{item_jellyfin_id}/Images/Primary?format=webp&quality=90&tag={image_tags['Primary']}"

                                    backdrop_tags = item_data.get("BackdropImageTags", [])
                                    backdrop_url = None
                                    if backdrop_tags:
                                        backdrop_url = f"/Items/{item_jellyfin_id}/Images/Backdrop?format=webp&quality=90&tag={backdrop_tags[0]}"

                                    # Parse genres
                                    genres = item_data.get("Genres", [])
                                    genres_json = json.dumps(genres) if genres else None

                                    # Parse studios
                                    studios_data = item_data.get("Studios", [])
                                    studios = [s.get("Name", str(s)) if isinstance(s, dict) else str(s) for s in studios_data] if studios_data else []
                                    studios_json = json.dumps(studios) if studios else None

                                    # Parse date created
                                    date_created = item_data.get("DateCreated")
                                    added_at = None
                                    if date_created:
                                        try:
                                            added_at = datetime.fromisoformat(date_created.replace("Z", "+00:00"))
                                        except (ValueError, AttributeError):
                                            pass

                                    # Parse premiere date
                                    premiere_date = item_data.get("PremiereDate")
                                    premiere_date_parsed = None
                                    if premiere_date:
                                        try:
                                            premiere_date_parsed = datetime.fromisoformat(premiere_date.replace("Z", "+00:00"))
                                        except (ValueError, AttributeError):
                                            pass

                                    if existing_item:
                                        # Update existing item
                                        existing_item.name = item_data.get("Name", existing_item.name)
                                        existing_item.item_type = item_data.get("Type", existing_item.item_type)
                                        existing_item.sort_name = item_data.get("SortName", existing_item.sort_name)
                                        existing_item.year = item_data.get("ProductionYear", existing_item.year)
                                        existing_item.premiere_date = premiere_date_parsed or existing_item.premiere_date
                                        existing_item.rating = item_data.get("CommunityRating") or existing_item.rating
                                        existing_item.community_rating = item_data.get("CommunityRating") or existing_item.community_rating
                                        existing_item.official_rating = item_data.get("OfficialRating") or existing_item.official_rating
                                        existing_item.runtime_ticks = item_data.get("RunTimeTicks", existing_item.runtime_ticks)
                                        existing_item.genres = genres_json or existing_item.genres
                                        existing_item.studios = studios_json or existing_item.studios
                                        existing_item.poster_url = poster_url or existing_item.poster_url
                                        existing_item.backdrop_url = backdrop_url or existing_item.backdrop_url
                                        existing_item.added_at = added_at or existing_item.added_at
                                        existing_item.season_number = item_data.get("ParentIndexNumber", existing_item.season_number)
                                        existing_item.episode_number = item_data.get("IndexNumber", existing_item.episode_number)
                                        item_updated += 1
                                    else:
                                        # Create new item
                                        new_item = Item(
                                            jellyfin_id=item_jellyfin_id,
                                            library_id=library.id,
                                            item_type=item_data.get("Type", "Unknown"),
                                            name=item_data.get("Name", "Unknown"),
                                            sort_name=item_data.get("SortName"),
                                            year=item_data.get("ProductionYear"),
                                            premiere_date=premiere_date_parsed,
                                            rating=item_data.get("CommunityRating"),
                                            community_rating=item_data.get("CommunityRating"),
                                            official_rating=item_data.get("OfficialRating"),
                                            runtime_ticks=item_data.get("RunTimeTicks"),
                                            genres=genres_json,
                                            studios=studios_json,
                                            poster_url=poster_url,
                                            backdrop_url=backdrop_url,
                                            season_number=item_data.get("ParentIndexNumber"),
                                            episode_number=item_data.get("IndexNumber"),
                                            added_at=added_at,
                                        )
                                        db.add(new_item)
                                        item_created += 1

                                except Exception as e:
                                    logger.error(f"Error syncing item {item_data.get('Name', 'unknown')}: {e}")
                                    stats["errors"] += 1

                            logger.debug(
                                f"Library {name}: {library.total_items} items, "
                                f"{library.total_size} bytes, "
                                f"{item_created} items created, {item_updated} items updated"
                            )

                        except JellyfinClientError as e:
                            logger.warning(f"Could not fetch items for library {name}: {e}")
                            # Keep using the ChildCount from library info

                    except Exception as e:
                        logger.error(f"Error syncing library {jellyfin_lib}: {e}")
                        stats["errors"] += 1

                # Commit all changes
                db.commit()
                logger.info(
                    f"Library sync completed: {stats['created']} created, "
                    f"{stats['updated']} updated, {stats['errors']} errors"
                )

            except Exception as e:
                db.rollback()
                logger.error(f"Error during library sync: {e}", exc_info=True)
                raise
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to sync libraries: {e}", exc_info=True)
            stats["errors"] += 1

        return stats