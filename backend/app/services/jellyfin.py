"""Jellyfin API client service."""
import logging
from typing import Any, Optional, Dict
import httpx

logger = logging.getLogger(__name__)


class JellyfinClientError(Exception):
    """Custom exception for Jellyfin client errors."""
    pass


class JellyfinClient:
    """Async client for interacting with Jellyfin server API."""

    def __init__(self, base_url: str, api_key: str) -> None:
        """Initialize the Jellyfin client.

        Args:
            base_url: Base URL of the Jellyfin server (e.g., http://localhost:8096)
            api_key: Jellyfin API key for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
                headers={"X-MediaBrowser-Token": self.api_key}
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an authenticated request to Jellyfin API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            params: Query parameters
            json_data: JSON data for request body

        Returns:
            Response data as dictionary

        Raises:
            JellyfinClientError: If request fails
        """
        client = await self._get_client()
        url = endpoint

        try:
            response = await client.request(
                method,
                url,
                params=params,
                json=json_data,
            )
            response.raise_for_status()

            # Return empty dict for 204 No Content
            if response.status_code == 204:
                return {}

            data = response.json()
            return data

        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP error {e.response.status_code} for {method} {url}"
            logger.error(f"{error_msg}: {e.response.text}")
            raise JellyfinClientError(error_msg) from e
        except httpx.RequestError as e:
            error_msg = f"Request error for {method} {url}: {e}"
            logger.error(error_msg)
            raise JellyfinClientError(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error for {method} {url}: {e}"
            logger.error(error_msg)
            raise JellyfinClientError(error_msg) from e

    async def test_connection(self) -> bool:
        """Test if Jellyfin server is reachable.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            await self.get_server_info()
            logger.info("Successfully connected to Jellyfin server")
            return True
        except JellyfinClientError:
            logger.error("Failed to connect to Jellyfin server")
            return False

    async def get_server_info(self) -> Dict[str, Any]:
        """Get server information including version, OS, and ID.

        Returns:
            Server information dictionary
        """
        data = await self._request("GET", "/System/Info")
        logger.debug(f"Retrieved server info: {data.get('ServerName', 'Unknown')}")
        return data

    async def get_users(self) -> list[Dict[str, Any]]:
        """Get all users from Jellyfin.

        Returns:
            List of user dictionaries
        """
        data = await self._request("GET", "/Users")
        if isinstance(data, list):
            logger.debug(f"Retrieved {len(data)} users")
            return data
        return []

    async def get_libraries(self) -> list[Dict[str, Any]]:
        """Get all libraries (media collections).

        Returns:
            List of library dictionaries
        """
        data = await self._request("GET", "/Library/MediaFolders")
        if isinstance(data, dict) and "Items" in data:
            libraries = data["Items"]
            logger.debug(f"Retrieved {len(libraries)} libraries")
            return libraries
        return []

    async def get_library_items(self, library_id: str) -> list[Dict[str, Any]]:
        """Get items in a specific library.

        Args:
            library_id: ID of the library to fetch items from

        Returns:
            List of item dictionaries
        """
        params = {
            "ParentId": library_id,
            "Recursive": True,
            "IncludeItemTypes": "Movie,Episode,Series,Season",
        }
        data = await self._request("GET", "/Items", params=params)
        if isinstance(data, dict) and "Items" in data:
            items = data["Items"]
            logger.debug(f"Retrieved {len(items)} items from library {library_id}")
            return items
        return []

    async def get_item(self, item_id: str) -> Dict[str, Any]:
        """Get details for a specific item.

        Args:
            item_id: ID of the item

        Returns:
            Item details dictionary
        """
        data = await self._request("GET", f"/Items/{item_id}")
        logger.debug(f"Retrieved item details for {item_id}: {data.get('Name', 'Unknown')}")
        return data

    async def get_recently_added(self, user_id: Optional[str] = None, limit: int = 20) -> list[Dict[str, Any]]:
        """Get recently added items.

        Args:
            user_id: Optional user ID to filter by user permissions
            limit: Maximum number of items to return

        Returns:
            List of recently added items
        """
        endpoint = f"/Users/{user_id}/Items" if user_id else "/Items"
        params = {
            "SortBy": "DateCreated",
            "SortOrder": "Descending",
            "Limit": limit,
            "IncludeItemTypes": "Movie,Episode,Series",
            "Recursive": True,
        }
        data = await self._request("GET", endpoint, params=params)
        if isinstance(data, dict) and "Items" in data:
            items = data["Items"]
            logger.debug(f"Retrieved {len(items)} recently added items")
            return items
        return []

    async def get_playback_history(
        self,
        user_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[Dict[str, Any]]:
        """Get playback history from Jellyfin.

        Uses the Items endpoint with IsPlayed filter to get items
        that users have actually watched, along with their UserData
        containing play counts and positions.

        Args:
            user_id: Optional user ID to filter history for a specific user
            limit: Maximum number of items to return

        Returns:
            List of played items with UserData containing play info
        """
        if user_id:
            endpoint = f"/Users/{user_id}/Items"
        else:
            endpoint = "/Items"

        params = {
            "Filters": "IsPlayed",
            "SortBy": "DatePlayed",
            "SortOrder": "Descending",
            "Limit": limit,
            "Recursive": True,
            "IncludeItemTypes": "Movie,Episode",
            "Fields": "ItemCounts,PrimaryImageAspectRatio,BasicSyncInfo,MediaSources,Overview,Genres,Studios",
        }

        data = await self._request("GET", endpoint, params=params)
        if isinstance(data, dict) and "Items" in data:
            items = data["Items"]
            logger.debug(f"Retrieved {len(items)} played items from Jellyfin")
            return items
        return []

    async def get_activity_log(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
    ) -> list[Dict[str, Any]]:
        """Get entries from Jellyfin system activity log.

        Args:
            limit: Maximum number of entries to return
            user_id: Optional user ID to filter entries

        Returns:
            List of activity log entries
        """
        params = {
            "startIndex": 0,
            "limit": limit,
        }
        if user_id:
            params["userId"] = user_id

        data = await self._request("GET", "/System/ActivityLog/Entries", params=params)
        if isinstance(data, dict) and "Items" in data:
            items = data["Items"]
            logger.debug(f"Retrieved {len(items)} activity log entries")
            return items
        return []

    async def get_user_data(self, user_id: str, item_id: str) -> Dict[str, Any]:
        """Get user's watch data for a specific item.

        Args:
            user_id: User ID
            item_id: Item ID

        Returns:
            User data dictionary containing playback position, played status, etc.
        """
        data = await self._request("GET", f"/Users/{user_id}/Items/{item_id}/UserData")
        logger.debug(f"Retrieved user data for user {user_id}, item {item_id}")
        return data

    async def update_user_data(
        self,
        user_id: str,
        item_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update user's watch data for a specific item.

        Args:
            user_id: User ID
            item_id: Item ID
            data: Dictionary containing fields to update (Played, PlaybackPositionTicks, etc.)

        Returns:
            Updated user data dictionary
        """
        result = await self._request(
            "POST",
            f"/Users/{user_id}/PlayedItems/{item_id}",
            json_data=data,
        )
        logger.debug(f"Updated user data for user {user_id}, item {item_id}")
        return result

    async def get_active_sessions(self) -> list[Dict[str, Any]]:
        """Get currently active playback sessions.

        Returns:
            List of active session dictionaries
        """
        data = await self._request("GET", "/Sessions")
        if isinstance(data, list):
            logger.debug(f"Retrieved {len(data)} active sessions")
            return data
        return []

    async def send_session_command(
        self,
        session_id: str,
        command: str,
        controlling_user_id: Optional[str] = None,
    ) -> None:
        """Send playstate command to a session.

        Args:
            session_id: Session ID
            command: Command to send (Stop, Pause, Unpause, PlayPause)
            controlling_user_id: Optional user ID who is sending the command
        """
        json_data = {"Command": command}
        if controlling_user_id:
            json_data["ControllingUserId"] = controlling_user_id

        await self._request(
            "POST",
            f"/Sessions/{session_id}/Playing/{command}",
            json_data=json_data,
        )
        logger.info(f"Sent {command} command to session {session_id}")

    async def send_session_message(
        self,
        session_id: str,
        message: str,
        header: Optional[str] = None,
        timeout_ms: Optional[int] = None,
    ) -> None:
        """Send message to a session client.

        Args:
            session_id: Session ID
            message: Message text to send
            header: Optional message header/title
            timeout_ms: Optional timeout for message display
        """
        json_data = {
            "Text": message,
            "Header": header or "Message",
        }
        if timeout_ms:
            json_data["TimeoutMs"] = timeout_ms

        await self._request(
            "POST",
            f"/Sessions/{session_id}/Message",
            json_data=json_data,
        )
        logger.info(f"Sent message to session {session_id}")

    async def get_sessions(self) -> list[Dict[str, Any]]:
        """Get all active Jellyfin sessions.

        Returns:
            List of session dictionaries from the /Sessions endpoint.
        """
        return await self._request("GET", "/Sessions")
