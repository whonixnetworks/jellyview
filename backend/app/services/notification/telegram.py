"""Telegram notification service."""
import logging
from typing import Any, Dict

import httpx

from .base import NotifierBase, NotifierError

logger = logging.getLogger(__name__)


class TelegramNotifier(NotifierBase):
    """Telegram bot notification notifier."""

    def _validate_config(self) -> None:
        """Validate Telegram configuration."""
        if "bot_token" not in self.config:
            raise NotifierError("bot_token is required for Telegram notifier")
        if "chat_id" not in self.config:
            raise NotifierError("chat_id is required for Telegram notifier")

    def _get_base_url(self) -> str:
        """Get Telegram bot API base URL."""
        return f"https://api.telegram.org/bot{self.config['bot_token']}"

    async def send(self, event_type: str, data: Dict[str, Any], template: str | None = None) -> bool:
        """Send a Telegram notification.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            True if sent successfully
        """
        chat_id = self.config["chat_id"]
        parse_mode = "Markdown"

        # Check if there's an image URL to send as photo
        image_url = data.get("image_url") or data.get("thumbnail_url")

        if image_url:
            return await self._send_photo(chat_id, image_url, template, data, parse_mode)

        return await self._send_message(chat_id, template, data, parse_mode)

    async def _send_message(
        self,
        chat_id: str,
        template: str | None,
        data: Dict[str, Any],
        parse_mode: str
    ) -> bool:
        """Send a text message.

        Args:
            chat_id: Telegram chat ID
            template: Message template
            data: Event data
            parse_mode: Parse mode (Markdown or HTML)

        Returns:
            True if sent successfully
        """
        text = self._render_template(template or data.get("message", ""), data)

        if not text:
            logger.warning("No message content to send")
            return False

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self._get_base_url()}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": parse_mode,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                result = response.json()
                if result.get("ok"):
                    logger.info(f"Telegram message sent successfully to {chat_id}")
                    return True
                else:
                    logger.error(f"Telegram API error: {result.get('description')}")
                    return False
        except httpx.HTTPError as e:
            logger.error(f"Telegram HTTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Telegram send error: {e}")
            return False

    async def _send_photo(
        self,
        chat_id: str,
        photo_url: str,
        template: str | None,
        data: Dict[str, Any],
        parse_mode: str
    ) -> bool:
        """Send a photo with caption.

        Args:
            chat_id: Telegram chat ID
            photo_url: URL of the image
            template: Caption template
            data: Event data
            parse_mode: Parse mode

        Returns:
            True if sent successfully
        """
        caption = self._render_template(template or data.get("message", ""), data)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self._get_base_url()}/sendPhoto",
                    json={
                        "chat_id": chat_id,
                        "photo": photo_url,
                        "caption": caption or None,
                        "parse_mode": parse_mode,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                result = response.json()
                if result.get("ok"):
                    logger.info(f"Telegram photo sent successfully to {chat_id}")
                    return True
                else:
                    logger.error(f"Telegram API error: {result.get('description')}")
                    return False
        except httpx.HTTPError as e:
            logger.error(f"Telegram HTTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Telegram send photo error: {e}")
            return False
