"""Base notification system."""
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict

logger = logging.getLogger(__name__)


class NotifierError(Exception):
    """Base exception for notifier errors."""
    pass


class NotifierBase(ABC):
    """Abstract base class for notification notifiers."""

    def __init__(self, config: Dict[str, Any]) -> None:
        """Initialize the notifier with configuration.

        Args:
            config: Configuration dictionary (type-specific)

        Raises:
            NotifierError: If configuration is invalid
        """
        self.config = config
        self._validate_config()

    @abstractmethod
    def _validate_config(self) -> None:
        """Validate the configuration.

        Raises:
            NotifierError: If configuration is invalid
        """
        pass

    @abstractmethod
    async def send(self, event_type: str, data: Dict[str, Any], template: str | None = None) -> bool:
        """Send a notification.

        Args:
            event_type: Type of event (e.g., "playback.started", "session.ended")
            data: Event data dictionary
            template: Optional message template string

        Returns:
            True if notification was sent successfully, False otherwise
        """
        pass

    def _render_template(self, template: str, data: Dict[str, Any]) -> str:
        """Render a template with variable substitution.

        Supports both {variable} and {{variable}} placeholder syntax.
        Double-curly syntax (from frontend UI) is converted to single-curly
        before Python string formatting is applied.

        Args:
            template: Template string with {variable} or {{variable}} placeholders
            data: Data dictionary for substitution

        Returns:
            Rendered template string
        """
        try:
            # Convert {{variable}} double-curly syntax (from frontend) to {variable}
            # The frontend uses {{var}} in JSX which becomes {var} in the stored template,
            # but some templates may be stored as {{var}} directly
            normalized = template.replace("{{", "{").replace("}}", "}")
            return normalized.format(**data)
        except KeyError as e:
            logger.warning(f"Template variable not found: {e}")
            # Fall back: try replacing just the known variables one by one
            result = template
            for key, value in data.items():
                # Replace both {{key}} and {key} patterns
                result = result.replace("{{" + str(key) + "}}", str(value))
                result = result.replace("{" + str(key) + "}", str(value))
            return result
        except (IndexError, ValueError) as e:
            logger.error(f"Template rendering error: {e}")
            return template

    async def close(self) -> None:
        """Clean up resources (override if needed)."""
        pass
