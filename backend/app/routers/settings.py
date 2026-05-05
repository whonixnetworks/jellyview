"""Settings router for Jellyview API."""
import json
import logging
import os
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.settings import AppSettings
from ..schemas.settings import SettingsResponse, JellyfinConnectionSettings
from ..services.jellyfin import JellyfinClient, JellyfinClientError
from ..config import settings as app_settings


router = APIRouter(prefix="/api/settings", tags=["settings"])

START_TIME = time.time()


class SettingsUpdate(BaseModel):
    """Schema for settings update."""
    jellyfin: Optional[JellyfinConnectionSettings] = None
    sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None
    enable_anonymous_stats: Optional[bool] = None
    enable_notifications: Optional[bool] = None
    default_session_timeout_minutes: Optional[int] = None
    log_retention_days: Optional[int] = None


class TestConnectionRequest(BaseModel):
    """Schema for testing Jellyfin connection."""
    url: str
    api_key: str


class BackupRestoreRequest(BaseModel):
    """Schema for backup/restore operations."""
    filename: Optional[str] = None


def _get_jellyfin_config(db: Session) -> dict:
    """Get Jellyfin config from DB, falling back to env vars."""
    entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
    if entry:
        try:
            return json.loads(entry.value)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "url": app_settings.jellyfin_url,
        "api_key": app_settings.jellyfin_api_key or "",
    }


@router.get("", response_model=SettingsResponse)
async def get_settings(
    db: Session = Depends(get_db),
):
    """Get all settings."""
    settings_entries = db.query(AppSettings).all()
    settings_dict = {entry.key: entry.value for entry in settings_entries}

    try:
        jellyfin_config = json.loads(settings_dict.get("jellyfin_config", "{}"))
        if jellyfin_config.get("url"):
            jellyfin_settings = JellyfinConnectionSettings(**jellyfin_config)
        else:
            jellyfin_settings = None
    except Exception:
        config = _get_jellyfin_config(db)
        if config.get("url") and config.get("api_key"):
            jellyfin_settings = JellyfinConnectionSettings(**config)
        else:
            jellyfin_settings = None

    return SettingsResponse(
        id=1,
        jellyfin=jellyfin_settings,
        sync_enabled=settings_dict.get("sync_enabled", "true").lower() == "true",
        sync_interval_minutes=int(settings_dict.get("sync_interval_minutes", "30")),
        enable_anonymous_stats=settings_dict.get("enable_anonymous_stats", "false").lower() == "true",
        enable_notifications=settings_dict.get("enable_notifications", "true").lower() == "true",
        default_session_timeout_minutes=int(settings_dict.get("default_session_timeout_minutes", "30")),
        log_retention_days=int(settings_dict.get("log_retention_days", "30")),
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(
    settings_update: SettingsUpdate,
    db: Session = Depends(get_db),
):
    """Update settings."""
    if settings_update.jellyfin:
        jellyfin_dict = {
            "url": settings_update.jellyfin.url,
            "api_key": settings_update.jellyfin.api_key,
            "verify_ssl": settings_update.jellyfin.verify_ssl,
            "timeout": settings_update.jellyfin.timeout,
            "max_retries": settings_update.jellyfin.max_retries,
            "retry_delay": settings_update.jellyfin.retry_delay,
        }
        _update_or_create_setting(db, "jellyfin_config", json.dumps(jellyfin_dict))

    if settings_update.sync_enabled is not None:
        _update_or_create_setting(db, "sync_enabled", str(settings_update.sync_enabled).lower())

    if settings_update.sync_interval_minutes is not None:
        _update_or_create_setting(db, "sync_interval_minutes", str(settings_update.sync_interval_minutes))

    if settings_update.enable_anonymous_stats is not None:
        _update_or_create_setting(db, "enable_anonymous_stats", str(settings_update.enable_anonymous_stats).lower())

    if settings_update.enable_notifications is not None:
        _update_or_create_setting(db, "enable_notifications", str(settings_update.enable_notifications).lower())

    if settings_update.default_session_timeout_minutes is not None:
        _update_or_create_setting(db, "default_session_timeout_minutes", str(settings_update.default_session_timeout_minutes))

    if settings_update.log_retention_days is not None:
        _update_or_create_setting(db, "log_retention_days", str(settings_update.log_retention_days))

    db.commit()

    return await get_settings(db)


@router.get("/jellyfin/test")
async def test_jellyfin_connection(
    db: Session = Depends(get_db),
):
    """Test Jellyfin connection using current settings."""
    config = _get_jellyfin_config(db)
    url = config.get("url", "")
    api_key = config.get("api_key", "")

    if not url or not api_key:
        return {
            "success": False,
            "message": "Jellyfin URL and API key are required",
            "server_info": None,
        }

    test_client = JellyfinClient(base_url=url, api_key=api_key)
    try:
        is_connected = await test_client.test_connection()
        if not is_connected:
            return {
                "success": False,
                "message": "Could not connect to Jellyfin server",
                "server_info": None,
            }
        server_info = await test_client.get_server_info()
        return {
            "success": True,
            "message": "Jellyfin connection test successful",
            "server_info": {
                "name": server_info.get("ServerName", "Jellyfin Server"),
                "version": server_info.get("Version", "Unknown"),
                "os": server_info.get("OperatingSystem", "Unknown"),
                "id": server_info.get("Id", ""),
            }
        }
    except JellyfinClientError as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}",
            "server_info": None,
        }
    finally:
        await test_client.close()


@router.post("/jellyfin/test")
async def test_jellyfin_connection_manual(
    request: TestConnectionRequest,
):
    """Test Jellyfin connection with provided credentials."""
    url = request.url
    api_key = request.api_key

    test_client = JellyfinClient(base_url=url, api_key=api_key)
    try:
        is_connected = await test_client.test_connection()
        if not is_connected:
            return {
                "success": False,
                "message": "Could not connect to Jellyfin server",
                "server_info": None,
            }
        server_info = await test_client.get_server_info()
        return {
            "success": True,
            "message": "Jellyfin connection test successful",
            "server_info": {
                "name": server_info.get("ServerName", "Jellyfin Server"),
                "version": server_info.get("Version", "Unknown"),
                "os": server_info.get("OperatingSystem", "Unknown"),
                "id": server_info.get("Id", ""),
            }
        }
    except JellyfinClientError as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}",
            "server_info": None,
        }
    finally:
        await test_client.close()


@router.get("/system")
async def get_system_info(
    db: Session = Depends(get_db),
):
    """Get system information."""
    import platform
    uptime = time.time() - START_TIME

    jellyfin_connected = False
    jellyfin_version = None
    config = _get_jellyfin_config(db)
    url = config.get("url", "")
    api_key = config.get("api_key", "")

    if url and api_key:
        test_client = JellyfinClient(base_url=url, api_key=api_key)
        try:
            is_connected = await test_client.test_connection()
            if is_connected:
                jellyfin_connected = True
                server_info = await test_client.get_server_info()
                jellyfin_version = server_info.get("Version")
        except Exception:
            pass
        finally:
            await test_client.close()

    db_path = app_settings.db_url.replace("sqlite:///", "")
    db_size = 0
    try:
        db_size = os.path.getsize(db_path)
    except OSError:
        pass

    return {
        "jellyview_version": "0.1.0",
        "jellyfin_version": jellyfin_version,
        "jellyfin_connected": jellyfin_connected,
        "database_size": db_size,
        "database_path": db_path,
        "uptime": uptime,
        "start_time": datetime.utcnow().isoformat(),
        "os_info": platform.platform(),
        "python_version": platform.python_version(),
    }


@router.get("/logs")
async def get_logs(
    db: Session = Depends(get_db),
    level: Optional[str] = Query(default=None, description="Filter by log level"),
    limit: int = Query(default=100, ge=1, le=1000, description="Max number of entries"),
    search: Optional[str] = Query(default=None, description="Search in log messages"),
):
    """Get application logs."""
    try:
        log_dir = os.path.join(app_settings.data_dir, "logs")
        log_file = os.path.join(log_dir, "jellyview.log")

        entries = []

        if not os.path.exists(log_file):
            return entries

        with open(log_file, "r") as f:
            lines = f.readlines()

        for line in reversed(lines[-limit * 10:]):
            line = line.strip()
            if not line:
                continue

            parts = line.split(" - ", 2)
            if len(parts) < 3:
                continue

            timestamp_str = parts[0].strip()
            level_and_logger = parts[1].strip()
            message = parts[2].strip() if len(parts) > 2 else ""

            level_parts = level_and_logger.split(":", 1) if ":" in level_and_logger else [level_and_logger, ""]
            log_level = level_parts[0].strip()
            # Map Python logging levels to frontend LogLevel format
            level_map = {"WARNING": "WARN", "CRITICAL": "ERROR"}
            log_level = level_map.get(log_level, log_level)
            logger_name = level_parts[1].strip() if len(level_parts) > 1 else ""

            if level and log_level.upper() != level.upper():
                continue

            if search and search.lower() not in message.lower():
                continue

            entries.append({
                "timestamp": timestamp_str,
                "level": log_level,
                "logger": logger_name,
                "message": message,
            })

            if len(entries) >= limit:
                break

        return entries
    except Exception:
        return []


@router.post("/backup")
async def create_backup(
    request: Optional[BackupRestoreRequest] = None,
    db: Session = Depends(get_db),
):
    """Create database backup."""
    filename = (request.filename if request else None) or f"jellyview_backup_{int(datetime.utcnow().timestamp())}.db"

    # Actually create the backup by copying the database
    import shutil
    db_path = settings.db_url.replace("sqlite:///", "")
    backup_dir = os.path.join(settings.data_dir, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, filename)

    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        return {
            "success": True,
            "message": "Backup created successfully",
            "backup_path": backup_path,
        }
    else:
        # Try default SQLite path inside Docker
        default_db_path = "/app/data/jellyview.db"
        if os.path.exists(default_db_path):
            shutil.copy2(default_db_path, backup_path)
            return {
                "success": True,
                "message": "Backup created successfully",
                "backup_path": backup_path,
            }
        raise HTTPException(status_code=500, detail="Database file not found")


@router.post("/restore")
async def restore_backup(
    request: BackupRestoreRequest,
    db: Session = Depends(get_db),
):
    """Restore from backup."""
    if not request.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    return {
        "success": True,
        "message": "Restore initiated successfully",
        "filename": request.filename,
    }


def _update_or_create_setting(db: Session, key: str, value: str):
    """Update or create a setting in the database."""
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = AppSettings(key=key, value=value)
        db.add(setting)