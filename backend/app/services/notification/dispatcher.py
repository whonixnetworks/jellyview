"""Notification dispatcher service."""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .base import NotifierBase, NotifierError
from .telegram import TelegramNotifier
from .discord import DiscordNotifier
from .email import EmailNotifier
from .webhook import WebhookNotifier
from .pushover import PushoverNotifier

logger = logging.getLogger(__name__)

# Notifier type registry
NOTIFIER_CLASSES = {
    "telegram": TelegramNotifier,
    "discord": DiscordNotifier,
    "email": EmailNotifier,
    "webhook": WebhookNotifier,
    "pushover": PushoverNotifier,
}


class NotificationDispatcher:
    """Dispatcher that routes events to configured notifiers based on rules."""

    def __init__(self, db: Session) -> None:
        """Initialize the notification dispatcher.

        Args:
            db: Database session
        """
        self.db = db
        self._notifier_cache: Dict[int, NotifierBase] = {}

    def _get_notifier(self, notifier_config: Dict[str, Any]) -> NotifierBase:
        """Get or create a notifier instance.

        Args:
            notifier_config: Notifier configuration dict

        Returns:
            Notifier instance

        Raises:
            NotifierError: If notifier type is invalid
        """
        notifier_id = notifier_config["id"]

        # Check cache first
        if notifier_id in self._notifier_cache:
            return self._notifier_cache[notifier_id]

        # Create new notifier instance
        notifier_type = notifier_config["type"]
        notifier_class = NOTIFIER_CLASSES.get(notifier_type)

        if not notifier_class:
            raise NotifierError(f"Unknown notifier type: {notifier_type}")

        config = json.loads(notifier_config["config"])
        notifier = notifier_class(config)

        # Cache the instance
        self._notifier_cache[notifier_id] = notifier
        return notifier

    def _load_notifiers(self) -> List[Dict[str, Any]]:
        """Load enabled notifiers from database.

        Returns:
            List of notifier configuration dictionaries
        """
        from ...models.notification import Notifier

        notifiers = self.db.query(Notifier).filter(Notifier.enabled == True).all()

        return [
            {
                "id": n.id,
                "name": n.name,
                "type": n.type,
                "config": n.config,
            }
            for n in notifiers
        ]

    def _load_rules(self, event_type: str) -> List[Dict[str, Any]]:
        """Load enabled rules matching event type from database.

        Args:
            event_type: Event type to filter by (notification rule type, e.g. stream_start)

        Returns:
            List of rule configuration dictionaries
        """
        from ...models.notification import NotificationRule

        rules = (
            self.db.query(NotificationRule)
            .filter(NotificationRule.event_type == event_type)
            .filter(NotificationRule.enabled == True)
            .all()
        )

        return [
            {
                "id": r.id,
                "notifier_id": r.notifier_id,
                "event_type": r.event_type,
                "filters": r.filters,
                "template": r.template,
            }
            for r in rules
        ]

    def _match_filters(self, filters_str: str, data: Dict[str, Any]) -> bool:
        """Check if data matches filter criteria.

        Args:
            filters_str: JSON string of filter rules
            data: Event data to match against

        Returns:
            True if data matches all filters, False otherwise
        """
        if not filters_str:
            return True

        try:
            filters = json.loads(filters_str)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid filter JSON: {e}")
            return True  # Allow through if filters are invalid

        for field, expected_value in filters.items():
            if field not in data:
                logger.debug(f"Filter field '{field}' not in event data")
                return False

            actual_value = data[field]

            # Handle different comparison types
            if isinstance(expected_value, dict):
                # Complex comparison
                for op, value in expected_value.items():
                    if op == "equals":
                        if actual_value != value:
                            return False
                    elif op == "not_equals":
                        if actual_value == value:
                            return False
                    elif op == "contains":
                        if value not in str(actual_value):
                            return False
                    elif op == "in":
                        if actual_value not in value:
                            return False
                    elif op == "gt":
                        if not (isinstance(actual_value, (int, float)) and actual_value > value):
                            return False
                    elif op == "lt":
                        if not (isinstance(actual_value, (int, float)) and actual_value < value):
                            return False
                    elif op == "gte":
                        if not (isinstance(actual_value, (int, float)) and actual_value >= value):
                            return False
                    elif op == "lte":
                        if not (isinstance(actual_value, (int, float)) and actual_value <= value):
                            return False
            else:
                # Simple equality check
                if actual_value != expected_value:
                    return False

        return True

    def _log_notification(
        self,
        notifier_id: int | None,
        rule_id: int | None,
        event_type: str,
        event_data: Dict[str, Any],
        status: str,
        error: str | None = None,
    ) -> None:
        """Log notification attempt to database.

        Args:
            notifier_id: Notifier ID
            rule_id: Rule ID
            event_type: Event type
            event_data: Event data (serialized to JSON string)
            status: Notification status (pending, sent, failed)
            error: Error message if failed
        """
        from ...models.notification import NotificationLog

        log = NotificationLog(
            notifier_id=notifier_id,
            rule_id=rule_id,
            event_type=event_type,
            event_data=json.dumps(event_data),
            status=status,
            error=error,
            sent_at=datetime.utcnow() if status == "sent" else None,
        )
        self.db.add(log)
        self.db.commit()

    async def dispatch(
        self,
        event_type: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Dispatch an event to matching notifiers.

        Args:
            event_type: Type of event (e.g., "playback.started")
            data: Event data dictionary

        Returns:
            Summary dictionary with results
        """
        logger.info(f"Dispatching event: {event_type}")

        # Load matching rules
        rules = self._load_rules(event_type)

        if not rules:
            logger.debug(f"No rules found for event type: {event_type}")
            return {"event_type": event_type, "notifications_sent": 0, "errors": []}

        # Load all notifiers
        notifiers_dict = {n["id"]: n for n in self._load_notifiers()}

        results = {
            "event_type": event_type,
            "notifications_sent": 0,
            "notifications_failed": 0,
            "errors": [],
        }

        # Process each rule
        for rule in rules:
            notifier_id = rule["notifier_id"]

            # Check if notifier exists and is enabled
            if notifier_id not in notifiers_dict:
                logger.warning(f"Notifier {notifier_id} not found or disabled, skipping rule {rule['id']}")
                self._log_notification(
                    notifier_id=notifier_id,
                    rule_id=rule["id"],
                    event_type=event_type,
                    event_data=data,
                    status="failed",
                    error="Notifier not found or disabled",
                )
                continue

            # Check filters
            if not self._match_filters(rule["filters"], data):
                logger.debug(f"Data does not match filters for rule {rule['id']}, skipping")
                continue

            try:
                # Get notifier instance
                notifier_config = notifiers_dict[notifier_id]
                notifier = self._get_notifier(notifier_config)

                # Send notification
                success = await notifier.send(
                    event_type=event_type,
                    data=data,
                    template=rule["template"],
                )

                if success:
                    results["notifications_sent"] += 1
                    logger.info(f"Notification sent successfully via rule {rule['id']}")
                    self._log_notification(
                        notifier_id=notifier_id,
                        rule_id=rule["id"],
                        event_type=event_type,
                        event_data=data,
                        status="sent",
                    )
                else:
                    results["notifications_failed"] += 1
                    error_msg = "Notifier returned False"
                    results["errors"].append({
                        "rule_id": rule["id"],
                        "notifier_id": notifier_id,
                        "error": error_msg,
                    })
                    logger.error(f"Notification failed via rule {rule['id']}: {error_msg}")
                    self._log_notification(
                        notifier_id=notifier_id,
                        rule_id=rule["id"],
                        event_type=event_type,
                        event_data=data,
                        status="failed",
                        error=error_msg,
                    )

            except NotifierError as e:
                results["notifications_failed"] += 1
                error_msg = str(e)
                results["errors"].append({
                    "rule_id": rule["id"],
                    "notifier_id": notifier_id,
                    "error": error_msg,
                })
                logger.error(f"Notifier error for rule {rule['id']}: {error_msg}")
                self._log_notification(
                    notifier_id=notifier_id,
                    rule_id=rule["id"],
                    event_type=event_type,
                    event_data=data,
                    status="failed",
                    error=error_msg,
                )

            except Exception as e:
                results["notifications_failed"] += 1
                error_msg = f"Unexpected error: {e}"
                results["errors"].append({
                    "rule_id": rule["id"],
                    "notifier_id": notifier_id,
                    "error": error_msg,
                })
                logger.exception(f"Unexpected error for rule {rule['id']}")
                self._log_notification(
                    notifier_id=notifier_id,
                    rule_id=rule["id"],
                    event_type=event_type,
                    event_data=data,
                    status="failed",
                    error=error_msg,
                )

        logger.info(
            f"Event dispatch complete: {results['notifications_sent']} sent, "
            f"{results['notifications_failed']} failed"
        )
        return results

    def clear_cache(self) -> None:
        """Clear the notifier cache."""
        self._notifier_cache.clear()
        logger.info("Notifier cache cleared")

    async def close(self) -> None:
        """Close all notifier instances and clean up."""
        for notifier in self._notifier_cache.values():
            try:
                await notifier.close()
            except Exception as e:
                logger.error(f"Error closing notifier: {e}")
        self._notifier_cache.clear()
        logger.info("Notification dispatcher closed")
