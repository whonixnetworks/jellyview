"""Backup router for Jellyview API."""
import asyncio
import json
import logging
from datetime import datetime
from typing import List, Optional
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db, SessionLocal
from ..models.backup import BackupJob
from ..schemas.backup import BackupJobResponse, BackupJobCreate
from ..services.backup_service import BackupService
from ..services.jellyfin import JellyfinClient
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backup", tags=["backup"])


def _get_jellyfin_client() -> Optional[JellyfinClient]:
    """Get JellyfinClient from DB config or env vars."""
    db = SessionLocal()
    try:
        from ..models.settings import AppSettings
        config_entry = db.query(AppSettings).filter(AppSettings.key == "jellyfin_config").first()
        if config_entry:
            config = json.loads(config_entry.value)
            url = config.get("url", "")
            api_key = config.get("api_key", "")
            if url and api_key:
                return JellyfinClient(base_url=url, api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to load Jellyfin config for backup: {e}")
    finally:
        db.close()

    # Fallback to env vars
    if settings.jellyfin_url and settings.jellyfin_api_key:
        return JellyfinClient(base_url=settings.jellyfin_url, api_key=settings.jellyfin_api_key)
    return None


class DryRunRequest(BaseModel):
    """Schema for dry run import."""
    filename: str


class ImportRequest(BaseModel):
    """Schema for import request."""
    filename: str


def _job_to_dict(job: BackupJob) -> dict:
    """Convert a BackupJob model to a dict matching the frontend BackupJob type."""
    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "filename": job.filename,
        "progress": job.progress or 0,
        "current_step": job.current_step,
        "total_users": job.total_users or 0,
        "total_items": job.total_items or 0,
        "processed": job.processed or 0,
        "matched": job.matched or 0,
        "unmatched": job.unmatched or 0,
        "errors": job.errors or 0,
        "error_log": json.loads(job.error_log) if job.error_log else [],
        "dry_run": job.dry_run or False,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }


async def _run_export_job(job_id: int):
    """Background task to run the export job."""
    db = SessionLocal()
    try:
        job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
        if not job:
            logger.error(f"Export job {job_id} not found")
            return

        jellyfin_client = _get_jellyfin_client()
        if not jellyfin_client:
            job.status = "failed"
            job.current_step = "No Jellyfin connection configured"
            job.error_log = json.dumps(["No Jellyfin connection configured"])
            db.commit()
            return

        service = BackupService(jellyfin_client=jellyfin_client)
        try:
            stats = await service.export_watch_stats(str(job_id))

            if stats.get("errors", 0) > 0 and job.status != "failed":
                # Job completed with some errors
                db.refresh(job)
                if job.current_step:
                    job.current_step = f"Export completed with {stats['errors']} errors"

            # Refresh to get final state from BackupService
            db.refresh(job)

        except Exception as e:
            logger.error(f"Export job {job_id} failed: {e}", exc_info=True)
            db.refresh(job)
            if job.status != "failed":
                job.status = "failed"
                job.current_step = f"Export failed: {str(e)}"
                job.error_log = json.dumps([str(e)])
                db.commit()
        finally:
            await jellyfin_client.close()
    except Exception as e:
        logger.error(f"Export background task error: {e}", exc_info=True)
    finally:
        db.close()


@router.get("/status")
async def get_backup_status(
    db: Session = Depends(get_db),
):
    """Get current backup/restore job status."""
    # Get the most recent running or pending job
    job = db.query(BackupJob).filter(
        BackupJob.status.in_(["pending", "running"])
    ).order_by(BackupJob.created_at.desc()).first()

    if not job:
        return None

    return _job_to_dict(job)


@router.post("/export")
async def start_backup_job(
    db: Session = Depends(get_db),
):
    """Start backup job (async). Creates the job and kicks off background execution."""
    # Create a new backup job
    job = BackupJob(
        job_type="export",
        status="pending",
        filename=f"watch_stats_backup_{int(datetime.utcnow().timestamp())}.json",
        progress=0,
        current_step="Initializing",
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # Start the export in the background
    asyncio.create_task(_run_export_job(job.id))

    # Return job data matching frontend BackupJob type
    return _job_to_dict(job)


@router.get("/export/{job_id}")
async def get_backup_job_progress(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Get backup job progress."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")

    return _job_to_dict(job)


@router.get("/download/{job_id}")
async def download_backup(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Download the backup JSON file."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")

    if not job.filename:
        raise HTTPException(status_code=400, detail="Backup file not available")

    if job.status != "completed":
        raise HTTPException(status_code=400, detail=f"Backup is not ready (status: {job.status})")

    file_path = Path(settings.data_dir) / "backups" / job.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Backup file not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type="application/json",
        filename=job.filename,
    )


@router.get("/list")
async def list_backups(
    db: Session = Depends(get_db),
):
    """List saved backup files."""
    # Get all completed export jobs
    jobs = db.query(BackupJob).filter(
        BackupJob.job_type == "export",
        BackupJob.status == "completed"
    ).order_by(BackupJob.created_at.desc()).all()

    backups = []
    for job in jobs:
        if job.filename:
            file_path = Path(settings.data_dir) / "backups" / job.filename
            file_size = file_path.stat().st_size if file_path.exists() else 0

            backups.append({
                "id": job.id,
                "filename": job.filename,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "modified_at": job.completed_at.isoformat() if job.completed_at else None,
                "size": file_size,
                "total_users": job.total_users,
                "total_items": job.total_items,
            })

    return backups


@router.delete("/{filename}")
async def delete_backup(
    filename: str,
    db: Session = Depends(get_db),
):
    """Delete a saved backup file."""
    # Find the backup job
    job = db.query(BackupJob).filter(
        BackupJob.job_type == "export",
        BackupJob.filename == filename
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Backup not found")

    # Delete the actual file
    if job.filename:
        file_path = Path(settings.data_dir) / "backups" / job.filename
        if file_path.exists():
            file_path.unlink()

    # Delete the job record
    db.delete(job)
    db.commit()

    return {
        "status": "success",
        "message": "Backup deleted successfully",
        "filename": filename,
    }


@router.post("/import")
async def start_import_job(
    request: ImportRequest,
    db: Session = Depends(get_db),
):
    """Start restore job (upload JSON, async)."""
    # Verify file exists
    file_path = Path(settings.data_dir) / "backups" / request.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")

    # Create a new import job
    job = BackupJob(
        job_type="import",
        status="pending",
        filename=request.filename,
        progress=0,
        current_step="Initializing",
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # TODO: Implement actual import job execution
    # This would run asynchronously and update the job status

    return _job_to_dict(job)


@router.get("/import/{job_id}")
async def get_import_job_progress(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Get restore job progress."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    return _job_to_dict(job)


@router.post("/import/{job_id}/dry-run")
async def dry_run_import(
    job_id: int,
    request: DryRunRequest,
    db: Session = Depends(get_db),
):
    """Preview what would be restored (no writes)."""
    # Verify file exists
    file_path = Path(settings.data_dir) / "backups" / request.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")

    # TODO: Implement actual dry-run logic
    # This would parse the backup file and show what would be restored

    # Mock response
    return {
        "status": "success",
        "message": "Dry run completed",
        "filename": request.filename,
        "summary": {
            "users_to_import": 3,
            "items_to_import": 4521,
            "records_to_restore": 8934,
        },
        "details": {
            "users": [
                {
                    "username": "admin",
                    "matched": True,
                    "items_count": 1247,
                },
                {
                    "username": "user1",
                    "matched": True,
                    "items_count": 2341,
                },
                {
                    "username": "guest",
                    "matched": False,
                    "items_count": 933,
                },
            ],
        },
    }