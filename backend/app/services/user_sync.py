"""User sync service for syncing Jellyfin users to the database."""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from .jellyfin import JellyfinClient, JellyfinClientError
from ..models.user import User
from ..database import SessionLocal

logger = logging.getLogger(__name__)


class UserSyncService:
    """Service for syncing users from Jellyfin server."""

    def __init__(self, jellyfin_client: Optional[JellyfinClient] = None):
        """Initialize the user sync service.

        Args:
            jellyfin_client: Optional JellyfinClient instance. If None, creates a new one.
        """
        self.jellyfin_client = jellyfin_client

    def _get_db(self) -> Session:
        """Get a database session."""
        return SessionLocal()

    async def sync_users(self) -> dict:
        """Sync users from Jellyfin to the database.

        This method:
        - Fetches the user list from Jellyfin
        - Creates new users or updates existing ones
        - Updates user metadata (username, is_admin, avatar_url, last_active)
        - Preserves user stats (total_plays, total_watch_time)

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
                # Fetch users from Jellyfin
                logger.info("Fetching users from Jellyfin...")
                jellyfin_users = await self.jellyfin_client.get_users()
                stats["total"] = len(jellyfin_users)

                logger.info(f"Found {len(jellyfin_users)} users to sync")

                for jellyfin_user in jellyfin_users:
                    try:
                        # Extract user data from Jellyfin response
                        jellyfin_id = jellyfin_user.get("Id")
                        username = jellyfin_user.get("Name")
                        is_admin = jellyfin_user.get("Policy", {}).get("IsAdministrator", False)
                        last_active_str = jellyfin_user.get("LastActivityDate")
                        primary_image_tag = jellyfin_user.get("PrimaryImageTag")

                        if not jellyfin_id:
                            logger.warning(f"User missing ID: {jellyfin_user}")
                            stats["errors"] += 1
                            continue

                        # Parse last active date
                        last_active = None
                        if last_active_str:
                            try:
                                last_active = datetime.fromisoformat(
                                    last_active_str.replace('Z', '+00:00')
                                )
                            except (ValueError, AttributeError):
                                logger.warning(f"Could not parse last_active: {last_active_str}")

                        # Build avatar URL
                        avatar_url = None
                        if primary_image_tag and jellyfin_id:
                            avatar_url = (
                                f"/Users/{jellyfin_id}/Images/Primary?"
                                f"format=webp&quality=90&tag={primary_image_tag}"
                            )

                        # Check if user exists
                        user = db.query(User).filter(
                            User.jellyfin_id == jellyfin_id
                        ).first()

                        if user:
                            # Update existing user (preserve stats)
                            user.username = username
                            user.is_admin = is_admin
                            user.last_active = last_active
                            user.avatar_url = avatar_url
                            logger.debug(f"Updated user: {username}")
                            stats["updated"] += 1
                        else:
                            # Create new user
                            user = User(
                                jellyfin_id=jellyfin_id,
                                username=username,
                                is_admin=is_admin,
                                last_active=last_active,
                                avatar_url=avatar_url,
                                total_plays=0,
                                total_watch_time=0,
                            )
                            db.add(user)
                            logger.info(f"Created new user: {username}")
                            stats["created"] += 1

                    except Exception as e:
                        logger.error(f"Error syncing user {jellyfin_user}: {e}")
                        stats["errors"] += 1

                # Commit all changes
                db.commit()
                logger.info(
                    f"User sync completed: {stats['created']} created, "
                    f"{stats['updated']} updated, {stats['errors']} errors"
                )

            except Exception as e:
                db.rollback()
                logger.error(f"Error during user sync: {e}", exc_info=True)
                raise
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Failed to sync users: {e}", exc_info=True)
            stats["errors"] += 1

        return stats
