"""Email notification service."""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict

import aiosmtplib

from .base import NotifierBase, NotifierError

logger = logging.getLogger(__name__)


class EmailNotifier(NotifierBase):
    """Email notification notifier using SMTP."""

    def _validate_config(self) -> None:
        """Validate email configuration."""
        required_fields = ["smtp_host", "smtp_port", "from_email"]
        for field in required_fields:
            if field not in self.config:
                raise NotifierError(f"{field} is required for Email notifier")

        # Validate port is integer
        try:
            self.config["smtp_port"] = int(self.config["smtp_port"])
        except (ValueError, TypeError):
            raise NotifierError("smtp_port must be a valid integer")

        # Validate port range
        if not (1 <= self.config["smtp_port"] <= 65535):
            raise NotifierError("smtp_port must be between 1 and 65535")

        # Default recipient from_email if not specified
        if "to_email" not in self.config:
            self.config["to_email"] = self.config["from_email"]

    async def send(self, event_type: str, data: Dict[str, Any], template: str | None = None) -> bool:
        """Send an email notification.

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            True if sent successfully
        """
        subject = data.get("subject") or event_type.replace(".", " ").title()

        # Build email content
        text_content, html_content = self._build_content(event_type, data, template)

        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = self.config["from_email"]
        message["To"] = self.config["to_email"]

        # Add plain text and HTML parts
        message.attach(MIMEText(text_content, "plain", "utf-8"))
        message.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            await self._send_smtp(message)
            logger.info(f"Email sent successfully to {self.config['to_email']}")
            return True
        except Exception as e:
            logger.error(f"Email send error: {e}")
            return False

    def _build_content(
        self,
        event_type: str,
        data: Dict[str, Any],
        template: str | None
    ) -> tuple[str, str]:
        """Build email content (text and HTML).

        Args:
            event_type: Type of event
            data: Event data
            template: Optional message template

        Returns:
            Tuple of (text_content, html_content)
        """
        # Use template or default message
        if template:
            message = self._render_template(template, data)
        else:
            message = data.get("message", "")

        # Plain text version
        text_content = f"Event: {event_type}\n\n{message}\n"

        # Add key-value data
        for key, value in data.items():
            if key not in ["message", "subject", "image_url", "thumbnail_url"]:
                text_content += f"{key}: {value}\n"

        # HTML version
        image_url = data.get("image_url") or data.get("thumbnail_url")
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
                {event_type.replace('.', ' ').title()}
            </h2>
        """

        if image_url:
            html_content += f'<img src="{image_url}" alt="Event Image" style="max-width: 100%; border-radius: 8px; margin: 20px 0;"><br>'

        html_content += f"""
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                {message.replace(chr(10), '<br>')}
            </div>
        """

        # Add key-value data as a table
        html_content += '<table style="width: 100%; margin: 20px 0; border-collapse: collapse;">'
        for key, value in data.items():
            if key not in ["message", "subject", "image_url", "thumbnail_url"]:
                html_content += f"""
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555;">{key}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd;">{value}</td>
                </tr>
                """
        html_content += "</table>"

        html_content += """
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This is an automated notification from JellyView.
            </p>
        </body>
        </html>
        """

        return text_content, html_content

    async def _send_smtp(self, message: MIMEMultipart) -> None:
        """Send email via SMTP.

        Args:
            message: MIME message to send

        Raises:
            Exception: If SMTP send fails
        """
        smtp_host = self.config["smtp_host"]
        smtp_port = self.config["smtp_port"]
        use_tls = self.config.get("use_tls", True)
        username = self.config.get("username")
        password = self.config.get("password")

        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=username,
            password=password,
            use_tls=use_tls,
            timeout=30.0,
        )
