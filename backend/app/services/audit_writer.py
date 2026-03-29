"""
BLOCKING-FIX 1: Concrete audit-log writer.

This module provides a single async function `write_audit_log` that creates
a row in the `audit_logs` table.  It is intentionally simple, dependency-free
(no class instantiation, no service hierarchy), and is designed to be called
from any route handler with minimal ceremony.

Usage in a route:
    from app.services.audit_writer import write_audit_log

    await write_audit_log(
        db, user_id=str(current_user.id),
        action="analyze_dataset",
        resource_type="project", resource_id=project_id,
        project_id=project_id,
        details={"dataset_id": ds_id, "records": n},
        regulatory=True,
    )
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("audit_writer")


async def write_audit_log(
    db: AsyncSession,
    *,
    user_id: str,
    action: str,
    resource_type: str = "",
    resource_id: Optional[str] = None,
    project_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    regulatory: bool = False,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[str]:
    """Write one audit-log row.  Returns the log entry ID on success, None on failure.

    This function NEVER raises — it catches all exceptions internally so callers
    don't need try/except.  Failures are logged at WARNING level.
    """
    from app.models import AuditLog  # late import to avoid circular deps

    entry_id = str(uuid.uuid4())
    try:
        entry = AuditLog(
            id=entry_id,
            project_id=project_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            old_values=old_values,
            new_values=new_values,
            change_summary=f"{action} on {resource_type}" + (f" {resource_id}" if resource_id else ""),
            timestamp=datetime.utcnow(),
            regulatory_significance=regulatory,
        )
        db.add(entry)
        await db.flush()  # flush, don't commit — let the caller's transaction handle it
        return entry_id
    except Exception as exc:
        logger.warning("Failed to write audit log [%s]: %s", action, exc)
        try:
            await db.rollback()
        except Exception:
            pass  # Rollback of failed audit log — nothing more to do
        return None
