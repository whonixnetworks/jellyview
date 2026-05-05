"""Generic webhook notification service."""
import json
import logging
from typing import Any, Dict

import httpx

from .base import NotifierBase, NotifierError

logger = logging.getLogger(__name__)


class WebhookNotifier(NotifierBase):
    """Generic webhook notification notifier."""

    def _validate_config(self) -> None:
        """Validate webhook configuration."""
        if "url" not in self.config:
            raise NotifierError("url is required for Webhook notifier")

        # Validate URL format
        url = self.config["url"]
        if not url.startswith(("http://", "https://")):
            raise NotifierError("url must start with http:// or https://")

    async def send(self, event_type: str, data: Dict[str, Any], template: str | None = None) -> bool:
        """Send a webhook notification.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            True if sent successfully
        """
        url = self.config["url"]

        # Build payload
        payload = self._build_payload(event_type, data, template)

        # Build headers
        headers = self._build_headers()

        try:
            async with httpx.AsyncClient() as client:
                method = self.config.get("method", "POST").upper()
                timeout = self.config.get("timeout", 30.0)

                response = await client.request(
                    method=method,
                    url=url,
                    json=payload,
                    headers=headers,
                    timeout=timeout,
                )
                response.raise_for_status()
                logger.info(f"Webhook sent successfully to {url}")
                return True

        except httpx.HTTPStatusError as e:
            logger.error(f"Webhook HTTP error: {e.response.status_code} - {e.response.text}")
            return False
        except httpx.HTTPError as e:
            logger.error(f"Webhook HTTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Webhook send error: {e}")
            return False

    def _build_payload(
        self,
        event_type: str,
        data: Dict[str, Any],
        template: str | None
    ) -> Dict[str, Any]:
        """Build webhook payload.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            Payload dictionary
        """
        # Use configured payload template if available
        payload_template = self.config.get("payload_template")

        if payload_template:
            # Parse JSON template
            try:
                template_dict = json.loads(payload_template)
                payload = self._render_json_template(template_dict, event_type, data, template)
                return payload
            except json.JSONDecodeError:
                logger.error("Invalid JSON payload_template configuration")
            except Exception as e:
                logger.error(f"Payload template error: {e}")

        # Default payload structure
        payload: Dict[str, Any] = {
            "event_type": event_type,
            "data": data,
            "timestamp": data.get("timestamp") or data.get("created_at"),
        }

        # Add rendered message if template provided
        if template:
            payload["message"] = self._render_template(template, data)
        elif "message" in data:
            payload["message"] = data["message"]

        # Apply include_fields filter if configured
        include_fields = self.config.get("include_fields")
        if include_fields and isinstance(include_fields, list):
            payload = {k: v for k, v in payload.items() if k in include_fields}
            payload["data"] = {k: v for k, v in data.items() if k in include_fields}

        return payload

    def _render_json_template(
        self,
        template_dict: Dict[str, Any],
        event_type: str,
        data: Dict[str, Any],
        message_template: str | None
    ) -> Dict[str, Any]:
        """Render JSON template with variable substitution.

        Args:
            template_dict: Template dictionary
            event_type: Event type
            data: Event data
            message_template: Optional message template

        Returns:
            Rendered dictionary
        """
        result = {}

        for key, value in template_dict.items():
            if isinstance(value, str):
                # Apply string template substitution
                template_data = {
                    "event_type": event_type,
                    "message": self._render_template(message_template or "", data),
                    **data,
                }
                result[key] = self._render_template(value, template_data)
            elif isinstance(value, dict):
                # Recursively render nested dict
                result[key] = self._render_json_template(value, event_type, data, message_template)
            elif isinstance(value, list):
                # Process list items
                result[key] = [
                    self._render_json_template(item, event_type, data, message_template)
                    if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                # Keep as-is
                result[key] = value

        return result

    def _build_headers(self) -> Dict[str, str]:
        """Build request headers.

        Returns:
            Headers dictionary
        """
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "JellyView/1.0",
        }

        # Add custom headers from config
        custom_headers = self.config.get("headers")
        if custom_headers and isinstance(custom_headers, dict):
            headers.update(custom_headers)

        # Add authorization header if configured
        auth_token = self.config.get("auth_token")
        if auth_token:
            auth_type = self.config.get("auth_type", "Bearer")
            headers["Authorization"] = f"{auth_type} {auth_token}"

        return headers
