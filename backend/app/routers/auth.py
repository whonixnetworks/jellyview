"""Authentication router for Jellyview API."""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.settings import AppSettings
from ..config import settings as app_settings
from ..services.jellyfin import JellyfinClient, JellyfinClientError


router = APIRouter(prefix="/api/auth", tags=["authentication"])


class SetupRequest(BaseModel):
    """Schema for initial setup."""
    jellyfin_url: HttpUrl
    jellyfin_api_key: str
    admin_username: Optional[str] = None
    admin_password: Optional[str] = None


class LoginRequest(BaseModel):
    """Schema for login request."""
    username: Optional[str] = None
    jellyfin_username: Optional[str] = None
    password: Optional[str] = None
    jellyfin_api_key: Optional[str] = None


class LoginResponse(BaseModel):
    """Schema for login response."""
    access_token: str
    token_type: str = "bearer"
    username: str
    is_admin: bool


class RefreshRequest(BaseModel):
    """Schema for token refresh."""
    refresh_token: str


class RefreshResponse(BaseModel):
    """Schema for token refresh response."""
    access_token: str
    token_type: str = "bearer"


@router.post("/setup")
async def setup_jellyfin(
    request: SetupRequest,
    db: Session = Depends(get_db),
):
    """Initial setup - connect to Jellyfin."""
    # Check if already configured
    jellyfin_config = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
    if jellyfin_config:
        raise HTTPException(status_code=400, detail="Jellyfin is already configured")

    # Validate Jellyfin connection
    url = str(request.jellyfin_url)
    api_key = request.jellyfin_api_key

    # Test the connection to Jellyfin before saving
    test_client = JellyfinClient(base_url=url, api_key=api_key)
    try:
        is_connected = await test_client.test_connection()
        if not is_connected:
            raise HTTPException(status_code=400, detail="Could not connect to Jellyfin server. Please check URL and API key.")
        server_info = await test_client.get_server_info()
    except JellyfinClientError as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")
    finally:
        await test_client.close()

    # Save configuration
    jellyfin_config = AppSettings(
        key="jellyfin_config",
        value=json.dumps({
            "url": url,
            "api_key": api_key,
            "verify_ssl": True,
            "timeout": 30,
            "max_retries": 3,
            "retry_delay": 1,
        })
    )
    db.add(jellyfin_config)

    # Enable sync
    sync_enabled = AppSettings(key="sync_enabled", value="true")
    db.add(sync_enabled)

    db.commit()

    return {
        "status": "success",
        "message": "Jellyfin connection configured successfully",
        "jellyfin_url": url,
        "server_info": {
            "name": server_info.get("ServerName", "Jellyfin Server"),
            "version": server_info.get("Version", "Unknown"),
        }
    }


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """Login with Jellyfin credentials."""
    # Check if Jellyfin is configured
    jellyfin_config = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
    if not jellyfin_config:
        raise HTTPException(status_code=400, detail="Jellyfin not configured. Please run setup first.")

    import json
    jellyfin_settings = json.loads(jellyfin_config.value)

    # For now, accept either Jellyfin API key or username/password
    if request.jellyfin_api_key:
        # Login with API key
        if request.jellyfin_api_key != jellyfin_settings.get("api_key"):
            raise HTTPException(status_code=401, detail="Invalid API key")

        username = "admin"
        is_admin = True
    else:
        # TODO: Implement username/password authentication
        # This would authenticate against Jellyfin using the Jellyfin API
        raise HTTPException(status_code=501, detail="Username/password authentication not implemented")

    # TODO: Generate actual JWT token
    # For now, generate a mock token
    import secrets
    access_token = secrets.token_urlsafe(32)

    return LoginResponse(
        access_token=access_token,
        username=username,
        is_admin=is_admin,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    request: RefreshRequest,
    db: Session = Depends(get_db),
):
    """Refresh session token."""
    # TODO: Validate refresh token and generate new access token
    # For now, generate a mock token
    import secrets
    access_token = secrets.token_urlsafe(32)

    return RefreshResponse(
        access_token=access_token,
    )


@router.get("/status")
async def get_auth_status(
    db: Session = Depends(get_db),
):
    """Check connection status to Jellyfin."""
    jellyfin_config = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()

    if not jellyfin_config:
        url = app_settings.jellyfin_url
        api_key = app_settings.jellyfin_api_key or ""
        if url and api_key:
            return {
                "configured": True,
                "connected": True,
                "jellyfin_url": url,
                "server_info": None,
            }
        return {
            "configured": False,
            "connected": False,
            "jellyfin_url": None,
            "server_info": None,
        }

    try:
        jellyfin_settings = json.loads(jellyfin_config.value)
    except (json.JSONDecodeError, TypeError):
        return {
            "configured": False,
            "connected": False,
            "jellyfin_url": None,
            "server_info": None,
        }

    url = jellyfin_settings.get("url", "")
    api_key = jellyfin_settings.get("api_key", "")

    if not url or not api_key:
        return {
            "configured": False,
            "connected": False,
            "jellyfin_url": None,
            "server_info": None,
        }

    test_client = JellyfinClient(base_url=url, api_key=api_key)
    try:
        is_connected = await test_client.test_connection()
        if is_connected:
            server_info = await test_client.get_server_info()
            return {
                "configured": True,
                "connected": True,
                "jellyfin_url": url,
                "server_info": {
                    "name": server_info.get("ServerName", "Jellyfin Server"),
                    "version": server_info.get("Version", "Unknown"),
                    "os": server_info.get("OperatingSystem", "Unknown"),
                    "id": server_info.get("Id", ""),
                }
            }
        else:
            return {
                "configured": True,
                "connected": False,
                "jellyfin_url": url,
                "server_info": None,
            }
    except JellyfinClientError:
        return {
            "configured": True,
            "connected": False,
            "jellyfin_url": url,
            "server_info": None,
        }
    finally:
        await test_client.close()

    jellyfin_settings = json.loads(jellyfin_config.value)
    url = jellyfin_settings.get("url")
    api_key = jellyfin_settings.get("api_key")

    # Check actual connection status
    try:
        test_client = JellyfinClient(base_url=url, api_key=api_key)
        is_connected = await test_client.test_connection()
        server_info = await test_client.get_server_info() if is_connected else None
        await test_client.close()
    except Exception:
        is_connected = False
        server_info = None

    return {
        "configured": True,
        "connected": is_connected,
        "jellyfin_url": url,
        "server_info": {
            "name": server_info.get("ServerName", "Unknown") if server_info else None,
            "version": server_info.get("Version", "Unknown") if server_info else None,
            "id": server_info.get("Id") if server_info else None,
        }
    }
