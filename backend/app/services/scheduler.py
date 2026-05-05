"""Scheduler service for managing background sync jobs using APScheduler."""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Callable, Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .jellyfin import JellyfinClient
from .user_sync import UserSyncService
from .library_sync import LibrarySyncService
from .history_sync import HistorySyncService
from ..config import settings
from ..database import SessionLocal
from ..models.session import ActiveSession
from ..models.settings import AppSettings

logger = logging.getLogger(__name__)


def _get_jellyfin_config_from_db() -> tuple[str, str]:
    """Load Jellyfin URL and API key from the database."""
    db = SessionLocal()
    try:
        config_entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
        if config_entry:
            config = json.loads(config_entry.value)
            return config.get("url", ""), config.get("api_key", "")
    except Exception as e:
        logger.error(f"Failed to load Jellyfin config from DB: {e}")
    finally:
        db.close()
    return "", ""


class SchedulerService:
    """Service for managing scheduled background tasks."""

    def __init__(self, jellyfin_client: Optional[JellyfinClient] = None):
        """Initialize the scheduler service.

        Args:
            jellyfin_client: Optional JellyfinClient instance. If None, creates a new one.
        """
        self.scheduler = AsyncIOScheduler()
        if jellyfin_client is None:
            db_url, db_api_key = _get_jellyfin_config_from_db()
            jellyfin_client = JellyfinClient(
                db_url or settings.jellyfin_url,
                db_api_key or settings.jellyfin_api_key or ""
            )
        self.jellyfin_client = jellyfin_client

        # Initialize sync services
        self.user_sync_service = UserSyncService(self.jellyfin_client)
        self.library_sync_service = LibrarySyncService(self.jellyfin_client)
        self.history_sync_service = HistorySyncService(self.jellyfin_client)

        logger.info("SchedulerService initialized")

    def start(self) -> None:
        """Start the scheduler and register all scheduled jobs.

        This method schedules the following jobs:
        - sync_libraries: Every 30 minutes
        - sync_users: Every 15 minutes
        - sync_history: Every 5 minutes
        - health_check: Every 1 minute
        - version_check: Every 6 hours
        - cleanup_stale_sessions: Every 5 minutes
        """
        # Schedule library sync (every 30 minutes)
        self.scheduler.add_job(
            self.sync_libraries,
            trigger=IntervalTrigger(minutes=30),
            id="sync_libraries",
            name="Sync libraries from Jellyfin",
            replace_existing=True,
        )
        logger.info("Scheduled job: sync_libraries (every 30 minutes)")

        # Schedule user sync (every 15 minutes)
        self.scheduler.add_job(
            self.sync_users,
            trigger=IntervalTrigger(minutes=15),
            id="sync_users",
            name="Sync users from Jellyfin",
            replace_existing=True,
        )
        logger.info("Scheduled job: sync_users (every 15 minutes)")

        # Schedule history sync (every 5 minutes)
        self.scheduler.add_job(
            self.sync_history,
            trigger=IntervalTrigger(minutes=5),
            id="sync_history",
            name="Sync playback history from Jellyfin",
            replace_existing=True,
        )
        logger.info("Scheduled job: sync_history (every 5 minutes)")

        # Schedule health check (every 1 minute)
        self.scheduler.add_job(
            self.health_check,
            trigger=IntervalTrigger(minutes=1),
            id="health_check",
            name="Check Jellyfin server health",
            replace_existing=True,
        )
        logger.info("Scheduled job: health_check (every 1 minute)")

        # Schedule version check (every 6 hours)
        self.scheduler.add_job(
            self.version_check,
            trigger=IntervalTrigger(hours=6),
            id="version_check",
            name="Check Jellyfin server version",
            replace_existing=True,
        )
        logger.info("Scheduled job: version_check (every 6 hours)")

        # Schedule cleanup of stale sessions (every 5 minutes)
        self.scheduler.add_job(
            self.cleanup_stale_sessions,
            trigger=IntervalTrigger(minutes=5),
            id="cleanup_stale_sessions",
            name="Clean up stale active sessions",
            replace_existing=True,
        )
        logger.info("Scheduled job: cleanup_stale_sessions (every 5 minutes)")

        # Start the scheduler
        self.scheduler.start()
        logger.info("Scheduler started successfully")

    async def shutdown(self) -> None:
        """Shutdown the scheduler and clean up resources."""
        logger.info("Shutting down scheduler...")
        self.scheduler.shutdown(wait=True)
        await self.jellyfin_client.close()
        logger.info("Scheduler shutdown complete")

    async def sync_libraries(self) -> dict:
        """Job: Sync libraries from Jellyfin.

        Returns:
            Dictionary with sync statistics
        """
        logger.info("Running scheduled job: sync_libraries")
        try:
            stats = await self.library_sync_service.sync_libraries()
            logger.info(f"Job completed: sync_libraries - {stats}")
            return stats
        except Exception as e:
            logger.error(f"Job failed: sync_libraries - {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def sync_users(self) -> dict:
        """Job: Sync users from Jellyfin.

        Returns:
            Dictionary with sync statistics
        """
        logger.info("Running scheduled job: sync_users")
        try:
            stats = await self.user_sync_service.sync_users()
            logger.info(f"Job completed: sync_users - {stats}")
            return stats
        except Exception as e:
            logger.error(f"Job failed: sync_users - {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def sync_history(self) -> dict:
        """Job: Sync playback history from Jellyfin.

        Returns:
            Dictionary with sync statistics
        """
        logger.info("Running scheduled job: sync_history")
        try:
            stats = await self.history_sync_service.sync_history()
            logger.info(f"Job completed: sync_history - {stats}")
            return stats
        except Exception as e:
            logger.error(f"Job failed: sync_history - {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def health_check(self) -> dict:
        """Job: Check Jellyfin server health.

        Returns:
            Dictionary with health status
        """
        logger.debug("Running scheduled job: health_check")
        try:
            is_healthy = await self.jellyfin_client.test_connection()
            result = {
                "status": "healthy" if is_healthy else "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
            }
            logger.debug(f"Job completed: health_check - {result}")
            return result
        except Exception as e:
            logger.error(f"Job failed: health_check - {e}", exc_info=True)
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def version_check(self) -> dict:
        """Job: Check Jellyfin server version and store it.

        Returns:
            Dictionary with version information
        """
        logger.info("Running scheduled job: version_check")
        try:
            server_info = await self.jellyfin_client.get_server_info()
            result = {
                "version": server_info.get("Version"),
                "server_name": server_info.get("ServerName"),
                "operating_system": server_info.get("OperatingSystem"),
                "id": server_info.get("Id"),
                "timestamp": datetime.utcnow().isoformat(),
            }
            logger.info(f"Job completed: version_check - {result}")
            return result
        except Exception as e:
            logger.error(f"Job failed: version_check - {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

    async def cleanup_stale_sessions(self) -> dict:
        """Job: Clean up stale active sessions.

        Removes active sessions that haven't been updated in the last 30 minutes.

        Returns:
            Dictionary with cleanup statistics
        """
        logger.debug("Running scheduled job: cleanup_stale_sessions")
        stats = {"removed": 0}

        try:
            db = SessionLocal()
            try:
                # Find sessions not updated in the last 30 minutes
                cutoff_time = datetime.utcnow() - timedelta(minutes=30)
                stale_sessions = db.query(ActiveSession).filter(
                    ActiveSession.last_updated < cutoff_time
                ).all()

                # Remove stale sessions
                for session in stale_sessions:
                    logger.debug(f"Removing stale session: {session.jellyfin_session_id}")
                    db.delete(session)
                    stats["removed"] += 1

                db.commit()
                logger.debug(f"Job completed: cleanup_stale_sessions - {stats}")
            except Exception as e:
                db.rollback()
                logger.error(f"Error during session cleanup: {e}", exc_info=True)
                raise
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Job failed: cleanup_stale_sessions - {e}", exc_info=True)
            return {"status": "error", "message": str(e)}

        return stats

    def get_job_status(self) -> dict:
        """Get status of all scheduled jobs.

        Returns:
            Dictionary with job statuses
        """
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })

        return {
            "running": self.scheduler.running,
            "jobs": jobs,
        }
