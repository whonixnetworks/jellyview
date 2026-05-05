"""Notifications router for Jellyview API."""
from datetime import datetime
from typing import List, Optional
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.notification import Notifier, NotificationRule, NotificationLog
from ..schemas.notification import (
    NotifierBase,
    NotifierResponse,
    NotificationRuleBase,
    NotificationRuleResponse,
    NotificationLogResponse,
)


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# Notifiers CRUD operations

@router.get("/notifiers", response_model=List[NotifierResponse])
async def list_notifiers(
    db: Session = Depends(get_db),
):
    """List all notifiers."""
    notifiers = db.query(Notifier).order_by(Notifier.name).all()

    # Get stats for each notifier
    result = []
    for notifier in notifiers:
        success_count = db.query(func.count(NotificationLog.id)).filter(
            NotificationLog.notifier_id == notifier.id,
            NotificationLog.status == "sent"
        ).scalar()

        failure_count = db.query(func.count(NotificationLog.id)).filter(
            NotificationLog.notifier_id == notifier.id,
            NotificationLog.status == "failed"
        ).scalar()

        last_triggered = db.query(func.max(NotificationLog.sent_at)).filter(
            NotificationLog.notifier_id == notifier.id
        ).scalar()

        result.append(NotifierResponse(
            id=notifier.id,
            name=notifier.name,
            notifier_type=notifier.type,
            is_enabled=notifier.enabled,
            config=json.loads(notifier.config) if notifier.config else {},
            created_at=notifier.created_at,
            updated_at=notifier.updated_at,
            last_triggered=last_triggered,
            success_count=success_count or 0,
            failure_count=failure_count or 0,
        ))

    return result


@router.post("/notifiers", response_model=NotifierResponse)
async def create_notifier(
    notifier: NotifierBase,
    db: Session = Depends(get_db),
):
    """Create a new notifier."""
    db_notifier = Notifier(
        name=notifier.name,
        type=notifier.notifier_type,
        enabled=notifier.is_enabled,
        config=json.dumps(notifier.config),
    )

    db.add(db_notifier)
    db.commit()
    db.refresh(db_notifier)

    return NotifierResponse(
        id=db_notifier.id,
        name=db_notifier.name,
        notifier_type=db_notifier.type,
        is_enabled=db_notifier.enabled,
        config=json.loads(db_notifier.config) if db_notifier.config else {},
        created_at=db_notifier.created_at,
        updated_at=db_notifier.updated_at,
        success_count=0,
        failure_count=0,
    )


@router.put("/notifiers/{notifier_id}", response_model=NotifierResponse)
async def update_notifier(
    notifier_id: int,
    notifier: NotifierBase,
    db: Session = Depends(get_db),
):
    """Update a notifier."""
    db_notifier = db.query(Notifier).filter(Notifier.id == notifier_id).first()

    if not db_notifier:
        raise HTTPException(status_code=404, detail="Notifier not found")

    db_notifier.name = notifier.name
    db_notifier.type = notifier.notifier_type
    db_notifier.enabled = notifier.is_enabled
    db_notifier.config = json.dumps(notifier.config)
    db_notifier.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_notifier)

    # Get stats
    success_count = db.query(func.count(NotificationLog.id)).filter(
        NotificationLog.notifier_id == notifier_id,
        NotificationLog.status == "sent"
    ).scalar()

    failure_count = db.query(func.count(NotificationLog.id)).filter(
        NotificationLog.notifier_id == notifier_id,
        NotificationLog.status == "failed"
    ).scalar()

    last_triggered = db.query(func.max(NotificationLog.sent_at)).filter(
        NotificationLog.notifier_id == notifier_id
    ).scalar()

    return NotifierResponse(
        id=db_notifier.id,
        name=db_notifier.name,
        notifier_type=db_notifier.type,
        is_enabled=db_notifier.enabled,
        config=json.loads(db_notifier.config) if db_notifier.config else {},
        created_at=db_notifier.created_at,
        updated_at=db_notifier.updated_at,
        last_triggered=last_triggered,
        success_count=success_count or 0,
        failure_count=failure_count or 0,
    )


@router.delete("/notifiers/{notifier_id}")
async def delete_notifier(
    notifier_id: int,
    db: Session = Depends(get_db),
):
    """Delete a notifier."""
    db_notifier = db.query(Notifier).filter(Notifier.id == notifier_id).first()

    if not db_notifier:
        raise HTTPException(status_code=404, detail="Notifier not found")

    db.delete(db_notifier)
    db.commit()

    return {"message": "Notifier deleted successfully"}


@router.post("/notifiers/{notifier_id}/test")
async def test_notifier(
    notifier_id: int,
    db: Session = Depends(get_db),
):
    """Send a test notification."""
    from ..services.notification.dispatcher import NotificationDispatcher, NOTIFIER_CLASSES, NotifierError
    from ..services.notification.base import NotifierError as BaseNotifierError

    db_notifier = db.query(Notifier).filter(Notifier.id == notifier_id).first()

    if not db_notifier:
        raise HTTPException(status_code=404, detail="Notifier not found")

    # Instantiate the notifier class and send a test message
    notifier_type = db_notifier.type
    notifier_class = NOTIFIER_CLASSES.get(notifier_type)

    if not notifier_class:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported notifier type: {notifier_type}. Supported types: {', '.join(NOTIFIER_CLASSES.keys())}"
        )

    try:
        config = json.loads(db_notifier.config) if db_notifier.config else {}
        notifier_instance = notifier_class(config)
    except (NotifierError, BaseNotifierError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid notifier configuration: {str(e)}")

    test_data = {
        "title": "JellyView Test Notification",
        "message": "This is a test notification from JellyView. If you received this, your notifier is configured correctly!",
        "event_type": "test",
    }

    try:
        success = await notifier_instance.send(
            event_type="test",
            data=test_data,
        )

        if success:
            # Log the test
            log = NotificationLog(
                notifier_id=notifier_id,
                event_type="test",
                event_data=json.dumps(test_data),
                status="sent",
                sent_at=datetime.utcnow(),
            )
            db.add(log)
            db.commit()

            return {
                "status": "success",
                "message": "Test notification sent successfully",
                "notifier_id": notifier_id,
            }
        else:
            # Log the failure
            log = NotificationLog(
                notifier_id=notifier_id,
                event_type="test",
                event_data=json.dumps(test_data),
                status="failed",
                error="Notifier returned False",
            )
            db.add(log)
            db.commit()

            return {
                "status": "error",
                "message": "Failed to send test notification. Check your notifier configuration.",
                "notifier_id": notifier_id,
            }
    except (NotifierError, BaseNotifierError) as e:
        return {
            "status": "error",
            "message": f"Notifier error: {str(e)}",
            "notifier_id": notifier_id,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
            "notifier_id": notifier_id,
        }


# Notification Rules CRUD operations

@router.get("/rules", response_model=List[NotificationRuleResponse])
async def list_notification_rules(
    db: Session = Depends(get_db),
    notifier_id: Optional[int] = Query(default=None, description="Filter by notifier"),
):
    """List all notification rules."""
    query = db.query(NotificationRule)

    if notifier_id:
        query = query.filter(NotificationRule.notifier_id == notifier_id)

    rules = query.order_by(NotificationRule.id).all()

    # Get stats and notifiers for each rule
    result = []
    for rule in rules:
        trigger_count = db.query(func.count(NotificationLog.id)).filter(
            NotificationLog.rule_id == rule.id
        ).scalar()

        last_triggered = db.query(func.max(NotificationLog.created_at)).filter(
            NotificationLog.rule_id == rule.id
        ).scalar()

        # Get notifier
        notifier = db.query(Notifier).filter(Notifier.id == rule.notifier_id).first()

        result.append(NotificationRuleResponse(
            id=rule.id,
            name=rule.name or rule.event_type,
            rule_type=rule.event_type,
            is_enabled=rule.enabled,
            conditions=json.loads(rule.filters) if rule.filters else {},
            notifier_ids=[rule.notifier_id],
            template=rule.template,
            created_at=rule.created_at,
            updated_at=datetime.utcnow(),  # No updated_at in model
            last_triggered=last_triggered,
            trigger_count=trigger_count or 0,
            notifiers=[NotifierResponse(
                id=notifier.id,
                name=notifier.name,
                notifier_type=notifier.type,
                is_enabled=notifier.enabled,
                config=json.loads(notifier.config) if notifier.config else {},
                created_at=notifier.created_at,
                updated_at=notifier.updated_at,
            )] if notifier else [],
        ))

    return result


@router.post("/rules", response_model=NotificationRuleResponse)
async def create_notification_rule(
    rule: NotificationRuleBase,
    db: Session = Depends(get_db),
):
    """Create a new notification rule."""
    if not rule.notifier_ids or len(rule.notifier_ids) == 0:
        raise HTTPException(status_code=400, detail="At least one notifier is required")

    # Create rule for each notifier
    created_rules = []
    for notifier_id in rule.notifier_ids:
        db_rule = NotificationRule(
            name=rule.name or rule.rule_type,
            notifier_id=notifier_id,
            event_type=rule.rule_type,
            enabled=rule.is_enabled,
            filters=json.dumps(rule.conditions),
            template=rule.template,
        )

        db.add(db_rule)
        db.commit()
        db.refresh(db_rule)
        created_rules.append(db_rule)

    # Return first created rule
    db_rule = created_rules[0]

    # Get notifier
    notifier = db.query(Notifier).filter(Notifier.id == db_rule.notifier_id).first()

    return NotificationRuleResponse(
        id=db_rule.id,
        name=db_rule.name or db_rule.event_type,
        rule_type=db_rule.event_type,
        is_enabled=db_rule.enabled,
        conditions=json.loads(db_rule.filters) if db_rule.filters else {},
        notifier_ids=[db_rule.notifier_id],
        template=db_rule.template,
        created_at=db_rule.created_at,
        updated_at=datetime.utcnow(),
        trigger_count=0,
        notifiers=[NotifierResponse(
            id=notifier.id,
            name=notifier.name,
            notifier_type=notifier.type,
            is_enabled=notifier.enabled,
            config=json.loads(notifier.config) if notifier.config else {},
            created_at=notifier.created_at,
            updated_at=notifier.updated_at,
        )] if notifier else [],
    )


@router.put("/rules/{rule_id}", response_model=NotificationRuleResponse)
async def update_notification_rule(
    rule_id: int,
    rule: NotificationRuleBase,
    db: Session = Depends(get_db),
):
    """Update a notification rule."""
    db_rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Notification rule not found")

    db_rule.name = rule.name or rule.rule_type
    db_rule.event_type = rule.rule_type
    db_rule.enabled = rule.is_enabled
    db_rule.filters = json.dumps(rule.conditions)
    db_rule.template = rule.template

    db.commit()
    db.refresh(db_rule)

    # Get notifier
    notifier = db.query(Notifier).filter(Notifier.id == db_rule.notifier_id).first()

    return NotificationRuleResponse(
        id=db_rule.id,
        name=db_rule.name or db_rule.event_type,
        rule_type=db_rule.event_type,
        is_enabled=db_rule.enabled,
        conditions=json.loads(db_rule.filters) if db_rule.filters else {},
        notifier_ids=[db_rule.notifier_id],
        template=db_rule.template,
        created_at=db_rule.created_at,
        updated_at=datetime.utcnow(),
        notifiers=[NotifierResponse(
            id=notifier.id,
            name=notifier.name,
            notifier_type=notifier.type,
            is_enabled=notifier.enabled,
            config=json.loads(notifier.config) if notifier.config else {},
            created_at=notifier.created_at,
            updated_at=notifier.updated_at,
        )] if notifier else [],
    )


@router.delete("/rules/{rule_id}")
async def delete_notification_rule(
    rule_id: int,
    db: Session = Depends(get_db),
):
    """Delete a notification rule."""
    db_rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Notification rule not found")

    db.delete(db_rule)
    db.commit()

    return {"message": "Notification rule deleted successfully"}


@router.post("/rules/{rule_id}/test")
async def test_notification_rule(
    rule_id: int,
    db: Session = Depends(get_db),
):
    """Test a notification rule by sending a test notification via its notifier."""
    from ..services.notification.dispatcher import NotificationDispatcher, NOTIFIER_CLASSES
    from ..services.notification.base import NotifierError

    db_rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Notification rule not found")

    db_notifier = db.query(Notifier).filter(Notifier.id == db_rule.notifier_id).first()
    if not db_notifier:
        raise HTTPException(status_code=404, detail="Notifier not found for this rule")

    # Send test notification
    notifier_type = db_notifier.type
    notifier_class = NOTIFIER_CLASSES.get(notifier_type)
    if not notifier_class:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported notifier type: {notifier_type}"
        )

    try:
        config = json.loads(db_notifier.config) if db_notifier.config else {}
        notifier_instance = notifier_class(config)
    except (NotifierError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid notifier configuration: {str(e)}")

    test_data = {
        "title": f"Test: {db_rule.name or db_rule.event_type}",
        "message": f"This is a test notification for rule '{db_rule.name or db_rule.event_type}'. "
                   f"Event type: {db_rule.event_type}",
        "event_type": db_rule.event_type,
        "username": "TestUser",
        "item_title": "Test Movie",
        "item_name": "Test Movie",
        "item_type": "Movie",
        "user_name": "TestUser",
        "item_id": "test-item-123",
        "session_id": "test-session-123",
        "play_method": "Transcode",
        "transcode_codec": "H264",
        "hw_accel": "VAAPI",
        "transcode_reasons": "ContainerBitrateExceedsLimit",
        "device_name": "Test Browser",
        "client_name": "Jellyfin Web",
        "library_name": "Movies",
        "watch_duration": "00:45:00",
    }

    # Add event-type-specific test data
    event_type = db_rule.event_type
    if event_type == "transcoding_start":
        test_data["title"] = "Transcoding Started"
        test_data["message"] = f"Transcoding Started: {test_data['hw_accel']}\n\nBy: {test_data['username']}\n\n{test_data['item_title']}"
    elif event_type == "transcoding_hw":
        test_data["title"] = "Hardware Transcoding"
        test_data["message"] = f"Hardware Transcoding: {test_data['hw_accel']}\n\nBy: {test_data['username']}\n\n{test_data['item_title']}"
    elif event_type == "stream_start":
        test_data["title"] = "Stream Started"
        test_data["message"] = f"Stream Started\n\nBy: {test_data['username']}\n\n{test_data['item_title']}"
    elif event_type == "stream_stop":
        test_data["title"] = "Stream Stopped"
        test_data["message"] = f"Stream Stopped\n\nBy: {test_data['username']}\n\n{test_data['item_title']}"
    elif event_type == "stream_pause":
        test_data["title"] = "Stream Paused"
    elif event_type == "stream_resume":
        test_data["title"] = "Stream Resumed"
    elif event_type == "item_added":
        test_data["title"] = "Item Added"
        test_data["message"] = f"New item added: {test_data['item_title']}"
    elif event_type == "user_created":
        test_data["title"] = "User Created"
    elif event_type == "server_down":
        test_data["title"] = "Server Down"
    elif event_type == "server_up":
        test_data["title"] = "Server Up"

    try:
        success = await notifier_instance.send(
            event_type=db_rule.event_type,
            data=test_data,
            template=db_rule.template,
        )

        # Log the test
        log = NotificationLog(
            notifier_id=db_notifier.id,
            rule_id=rule_id,
            event_type=db_rule.event_type,
            event_data=json.dumps(test_data),
            status="sent" if success else "failed",
            sent_at=datetime.utcnow() if success else None,
            error=None if success else "Notifier returned False",
        )
        db.add(log)
        db.commit()

        if success:
            return {
                "status": "success",
                "message": f"Test notification sent via rule '{db_rule.name}'",
                "rule_id": rule_id,
                "notifier_id": db_notifier.id,
            }
        else:
            return {
                "status": "error",
                "message": "Notification was not sent. Check notifier configuration.",
                "rule_id": rule_id,
            }
    except NotifierError as e:
        log = NotificationLog(
            notifier_id=db_notifier.id,
            rule_id=rule_id,
            event_type=db_rule.event_type,
            event_data=json.dumps(test_data),
            status="failed",
            error=str(e),
        )
        db.add(log)
        db.commit()
        return {
            "status": "error",
            "message": f"Notifier error: {str(e)}",
            "rule_id": rule_id,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}",
            "rule_id": rule_id,
        }


# Notification Log

@router.get("/log", response_model=List[NotificationLogResponse])
async def get_notification_log(
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=1000, description="Number of results"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    rule_id: Optional[int] = Query(default=None, description="Filter by rule"),
    notifier_id: Optional[int] = Query(default=None, description="Filter by notifier"),
):
    """Get notification delivery log."""
    query = db.query(NotificationLog)

    if status:
        query = query.filter(NotificationLog.status == status)

    if rule_id:
        query = query.filter(NotificationLog.rule_id == rule_id)

    if notifier_id:
        query = query.filter(NotificationLog.notifier_id == notifier_id)

    results = query.order_by(desc(NotificationLog.created_at)).limit(limit).all()

    # Get related data
    log_entries = []
    for entry in results:
        rule = db.query(NotificationRule).filter(NotificationRule.id == entry.rule_id).first() if entry.rule_id else None
        notifier = db.query(Notifier).filter(Notifier.id == entry.notifier_id).first() if entry.notifier_id else None

        log_entries.append(NotificationLogResponse(
            id=entry.id,
            rule_id=entry.rule_id,
            rule_name=rule.event_type if rule else None,
            notifier_id=entry.notifier_id,
            notifier_name=notifier.name if notifier else None,
            triggered_at=entry.created_at,
            status=entry.status,
            message=None,  # No message field in model
            error_details=entry.error,
            context=json.loads(entry.event_data) if entry.event_data else None,
        ))

    return log_entries


@router.post("/log/{log_id}/retry")
async def retry_notification(
    log_id: int,
    db: Session = Depends(get_db),
):
    """Retry a failed notification."""
    log_entry = db.query(NotificationLog).filter(NotificationLog.id == log_id).first()

    if not log_entry:
        raise HTTPException(status_code=404, detail="Log entry not found")

    # TODO: Implement actual retry logic
    # This would re-trigger the notification using the same event data

    return {
        "status": "success",
        "message": "Notification retry initiated",
        "log_id": log_id,
    }
