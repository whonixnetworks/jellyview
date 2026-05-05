"""Discord notification service."""
import logging
from typing import Any, Dict

import httpx

from .base import NotifierBase, NotifierError

logger = logging.getLogger(__name__)


class DiscordNotifier(NotifierBase):
    """Discord webhook notification notifier."""

    def _validate_config(self) -> None:
        """Validate Discord configuration."""
        if "webhook_url" not in self.config:
            raise NotifierError("webhook_url is required for Discord notifier")

    async def send(self, event_type: str, data: Dict[str, Any], template: str | None = None) -> bool:
        """Send a Discord notification via webhook.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            True if sent successfully
        """
        webhook_url = self.config["webhook_url"]

        # Build Discord embed
        embed = self._build_embed(event_type, data, template)

        payload: Dict[str, Any] = {
            "embeds": [embed] if embed else [],
        }

        # Add username override if configured
        if "username" in self.config:
            payload["username"] = self.config["username"]

        # Add avatar override if configured
        if "avatar_url" in self.config:
            payload["avatar_url"] = self.config["avatar_url"]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=30.0,
                )
                response.raise_for_status()
                logger.info(f"Discord webhook sent successfully")
                return True
        except httpx.HTTPStatusError as e:
            logger.error(f"Discord HTTP error: {e.response.status_code} - {e.response.text}")
            return False
        except httpx.HTTPError as e:
            logger.error(f"Discord HTTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Discord webhook error: {e}")
            return False

    def _build_embed(
        self,
        event_type: str,
        data: Dict[str, Any],
        template: str | None
    ) -> Dict[str, Any]:
        """Build Discord embed from event data.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            Discord embed dictionary
        """
        embed: Dict[str, Any] = {}

        # Title
        title = data.get("title") or event_type.replace(".", " ").title()
        embed["title"] = title[:256]  # Discord limit

        # Description
        description = ""
        if template:
            description = self._render_template(template, data)
        elif "description" in data:
            description = data["description"]
        elif "message" in data:
            description = data["message"]

        if description:
            embed["description"] = description[:4096]  # Discord limit

        # Color based on event type
        embed["color"] = self._get_event_color(event_type)

        # Image
        image_url = data.get("image_url") or data.get("thumbnail_url")
        if image_url:
            embed["image"] = {"url": image_url}

        # Thumbnail
        thumbnail_url = data.get("thumbnail_url")
        if thumbnail_url and thumbnail_url != image_url:
            embed["thumbnail"] = {"url": thumbnail_url}

        # Author
        author_name = data.get("author_name") or data.get("user_name")
        if author_name:
            embed["author"] = {
                "name": author_name[:256],
            }

        # Footer with timestamp
        embed["footer"] = {
            "text": event_type,
        }
        embed["timestamp"] = data.get("timestamp") or data.get("created_at")

        # Fields
        if "fields" in data:
            embed["fields"] = [
                {"name": f["name"][:256], "value": f["value"][:1024], "inline": f.get("inline", False)}
                for f in data["fields"][:25]  # Discord limit: 25 fields
            ]
        elif "url" in data:
            embed["url"] = data["url"]

        return embed

    def _get_event_color(self, event_type: str) -> int:
        """Get Discord embed color based on event type.

        Args:
            event_type: Type of event

        Returns:
            Color integer (decimal)
        """
        color_map = {
            "playback.started": 0x3498db,  # Blue
            "playback.stopped": 0x95a5a6,  # Gray
            "playback.paused": 0xf39c12,  # Orange
            "playback.resumed": 0x2ecc71,  # Green
            "session.ended": 0xe74c3c,     # Red
            "item.added": 0x9b59b6,       # Purple
            "user.created": 0x1abc9c,     # Teal
            "library.scan": 0x34495e,     # Dark Blue
        }
        return color_map.get(event_type, 0x607d8b)  # Default: Blue Gray
