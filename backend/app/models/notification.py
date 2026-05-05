from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from app.database import Base


class Notifier(Base):
    """Notification notifiers (telegram, discord, email, webhook)."""
    __tablename__ = "notifiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    config = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_notifiers_type', 'type'),
        Index('idx_notifiers_enabled', 'enabled'),
    )


class NotificationRule(Base):
    """Notification rules (which events trigger which notifiers)."""
    __tablename__ = "notification_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=True, default='')
    notifier_id = Column(Integer, ForeignKey('notifiers.id', ondelete='CASCADE'), nullable=False)
    event_type = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    filters = Column(String, nullable=True)
    template = Column(String(2048), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_notification_rules_notifier', 'notifier_id'),
        Index('idx_notification_rules_event_type', 'event_type'),
        Index('idx_notification_rules_enabled', 'enabled'),
    )


class NotificationLog(Base):
    """Notification log for tracking delivery status."""
    __tablename__ = "notification_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    notifier_id = Column(Integer, ForeignKey('notifiers.id', ondelete='SET NULL'), nullable=True)
    rule_id = Column(Integer, ForeignKey('notification_rules.id', ondelete='SET NULL'), nullable=True)
    event_type = Column(String(100), nullable=False)
    event_data = Column(String, nullable=True)
    status = Column(String(50), default='pending', nullable=False)
    error = Column(String(2048), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_notification_log_notifier', 'notifier_id'),
        Index('idx_notification_log_status', 'status'),
        Index('idx_notification_log_created', 'created_at'),
        Index('idx_notification_log_event_type', 'event_type'),
    )
