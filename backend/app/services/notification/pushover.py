"""Pushover notification service."""
import logging
from typing import Any, Dict

import httpx

from .base import NotifierBase, NotifierError

logger = logging.getLogger(__name__)

# Sound options: https://pushover.net/api#sounds
VALID_SOUNDS = {
    "pushover", "bike", "bugle", "cashregister", "classical", "cosmic",
    "falling", "gamelan", "incoming", "intermission", "magic", "mechanical",
    "pianobar", "siren", "spacealarm", "tugboat", "alien", "climb",
    "persistent", "echo", "up-down", "vibrate", "none",
}

VALID_PRIORITIES = {"low", "normal", "high", "emergency"}


class PushoverNotifier(NotifierBase):
    """Pushover notification notifier."""

    def _validate_config(self) -> None:
        """Validate Pushover configuration."""
        if "user_key" not in self.config and "userKey" not in self.config:
            raise NotifierError("user_key is required for Pushover notifier")
        if "app_token" not in self.config and "appToken" not in self.config:
            raise NotifierError("app_token is required for Pushover notifier")

    async def send(self, event_type: str, data: Dict[str, Any], template: str | None = None) -> bool:
        """Send a Pushover notification.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            True if sent successfully
        """
        # Accept both snake_case and camelCase keys from frontend
        user_key = self.config.get("user_key") or self.config.get("userKey")
        app_token = self.config.get("app_token") or self.config.get("appToken")
        device = self.config.get("device")
        sound = self.config.get("sound", "pushover")
        retry = self.config.get("retry", 60)
        expire = self.config.get("expire", 3600)

        # Map priority: accept both string names and integer values
        priority_raw = self.config.get("priority", 0)
        if isinstance(priority_raw, str):
            priority_map = {"low": -1, "normal": 0, "high": 1, "emergency": 2}
            priority = priority_map.get(priority_raw, 0)
        else:
            priority = int(priority_raw)

        # Build message
        if template:
            message = self._render_template(template, data)
        elif "message" in data:
            message = str(data["message"])
        else:
            # Default message format
            title = data.get("title", "JellyView Notification")
            message = f"[{event_type}] {title}"
            if "user_name" in data:
                message += f"\nUser: {data['user_name']}"
            if "item_name" in data:
                message += f"\nItem: {data['item_name']}"

        if not message:
            logger.warning("No message content to send")
            return False

        # Build title
        title = data.get("title", "JellyView")

        payload: Dict[str, Any] = {
            "token": app_token,
            "user": user_key,
            "message": message,
            "title": title,
            "priority": priority,
        }

        if device:
            payload["device"] = device
        if sound and sound in VALID_SOUNDS:
            payload["sound"] = sound
        if priority == 2:
            # Emergency priority requires retry and expire
            payload["retry"] = max(30, int(retry))
            payload["expire"] = max(30, int(expire))

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.pushover.net/1/messages.json",
                    data=payload,
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result = response.json()
                    if result.get("status") == 1:
                        logger.info(f"Pushover notification sent successfully to user {user_key[:8]}...")
                        return True
                    else:
                        errors = result.get("errors", ["Unknown error"])
                        logger.error(f"Pushover API error: {errors}")
                        return False
                else:
                    logger.error(f"Pushover HTTP error: {response.status_code} - {response.text}")
                    return False

        except httpx.HTTPError as e:
            logger.error(f"Pushover HTTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Pushover send error: {e}")
            return False