"""
Background task queue for long-running operations.

Architecture
~~~~~~~~~~~~
  - **In-process queue** runs asyncio.Tasks in the current event loop.
  - **DB persistence** writes task metadata (state, progress, checkpoints)
    to the ``background_tasks`` table so status survives process restarts.
  - **Checkpointing** allows multi-phase tasks to record which phase they
    completed, enabling future resume-from-checkpoint logic.

Production upgrade path
~~~~~~~~~~~~~~~~~~~~~~~
  Replace ``InProcessTaskQueue`` with an ARQ / Celery worker that reads
  from Redis.  The ``TaskQueueProtocol`` interface stays the same so
  callers (routes.py) need zero changes.
"""

import asyncio
import uuid
import logging
import traceback
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Task state enum
# ---------------------------------------------------------------------------

class TaskState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# Task result — in-memory representation with checkpoint support (Fix 10)
# ---------------------------------------------------------------------------

class TaskResult:
    """Tracks the lifecycle of a background task, including phase checkpoints."""

    def __init__(self, task_id: str, task_type: str):
        self.task_id = task_id
        self.task_type = task_type
        self.state = TaskState.PENDING
        self.progress: float = 0.0  # 0-100
        self.message: str = "Queued"
        self.result: Any = None
        self.error: Optional[str] = None
        self.error_traceback: Optional[str] = None
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None

        # Fix 10: Checkpointing — phases record their completion here
        self._checkpoints: Dict[str, dict] = {}
        self._current_phase: Optional[str] = None
        self._total_phases: int = 0

    # ── Checkpoint API (Fix 10) ──────────────────────────────────────────

    def begin_phase(self, phase_name: str, phase_index: int, total_phases: int, message: str = ""):
        """Mark the start of a named phase.  Called by multi-step tasks."""
        self._current_phase = phase_name
        self._total_phases = total_phases
        self.message = message or f"Phase {phase_index + 1}/{total_phases}: {phase_name}"
        # Auto-compute progress from phase index
        self.progress = round((phase_index / total_phases) * 100, 1)
        logger.debug("Task %s entering phase %s (%d/%d)", self.task_id, phase_name, phase_index + 1, total_phases)

    def checkpoint(self, phase_name: str, *, data: Optional[dict] = None):
        """Record successful completion of a phase.

        ``data`` is an optional dict of phase-specific outputs that can be
        used for resume-from-checkpoint in a future implementation.
        """
        self._checkpoints[phase_name] = {
            "completed_at": datetime.utcnow().isoformat() + "Z",
            "data": data or {},
        }
        logger.info("Task %s checkpointed phase '%s'", self.task_id, phase_name)

    @property
    def last_checkpoint(self) -> Optional[str]:
        """Name of the most recently completed phase."""
        if not self._checkpoints:
            return None
        return max(self._checkpoints, key=lambda k: self._checkpoints[k]["completed_at"])

    @property
    def checkpoints(self) -> Dict[str, dict]:
        return dict(self._checkpoints)

    # ── Serialization ────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        d = {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "state": self.state.value,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "created_at": self.created_at.isoformat() + "Z",
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
            "completed_at": self.completed_at.isoformat() + "Z" if self.completed_at else None,
            "duration_seconds": (
                (self.completed_at or datetime.utcnow()) - self.started_at
            ).total_seconds() if self.started_at else None,
            # Fix 10: checkpoint info
            "current_phase": self._current_phase,
            "last_checkpoint": self.last_checkpoint,
            "checkpoints": {k: v["completed_at"] for k, v in self._checkpoints.items()},
        }
        return d


# ---------------------------------------------------------------------------
# Abstract protocol — swap implementations without touching callers (Fix 9)
# ---------------------------------------------------------------------------

class TaskQueueProtocol(ABC):
    """Interface that both in-process and Redis-backed queues implement."""

    @abstractmethod
    async def enqueue(self, func: Callable, *args, task_type: str = "generic", **kwargs) -> str: ...

    @abstractmethod
    def get_status(self, task_id: str) -> Optional[dict]: ...

    @abstractmethod
    def get_result(self, task_id: str) -> Any: ...

    @abstractmethod
    def list_tasks(self, task_type: Optional[str] = None, limit: int = 50) -> list: ...

    @abstractmethod
    async def cancel(self, task_id: str) -> bool: ...

    @abstractmethod
    def cleanup_old(self, max_age_hours: int = 24): ...


# ---------------------------------------------------------------------------
# DB persistence layer (Fix 9) — writes task metadata to background_tasks
# ---------------------------------------------------------------------------

async def _persist_task_state(task: TaskResult):
    """Write task metadata to the ``background_tasks`` DB table.

    Best-effort: failures are logged but never crash the task itself.
    This runs inside the event loop (not the thread-pool executor).
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.models import BackgroundTask
        from sqlalchemy import select as sa_select, update as sa_update

        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                sa_select(BackgroundTask).where(BackgroundTask.id == task.task_id)
            )
            row = existing.scalar_one_or_none()

            if row is None:
                row = BackgroundTask(
                    id=task.task_id,
                    task_type=task.task_type,
                    state=task.state.value,
                    progress=task.progress,
                    message=task.message,
                    error=task.error,
                    error_traceback=task.error_traceback,
                    created_at=task.created_at,
                    started_at=task.started_at,
                    completed_at=task.completed_at,
                    checkpoints={k: v for k, v in task._checkpoints.items()},
                    current_phase=task._current_phase,
                )
                session.add(row)
            else:
                await session.execute(
                    sa_update(BackgroundTask)
                    .where(BackgroundTask.id == task.task_id)
                    .values(
                        state=task.state.value,
                        progress=task.progress,
                        message=task.message,
                        error=task.error,
                        error_traceback=task.error_traceback,
                        started_at=task.started_at,
                        completed_at=task.completed_at,
                        checkpoints={k: v for k, v in task._checkpoints.items()},
                        current_phase=task._current_phase,
                    )
                )
            await session.commit()
    except Exception as exc:
        logger.warning("Failed to persist task %s state to DB: %s", task.task_id, exc)


async def _load_historical_tasks(limit: int = 100) -> List[dict]:
    """Load recent tasks from DB (for status queries after process restart)."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.models import BackgroundTask
        from sqlalchemy import select as sa_select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                sa_select(BackgroundTask)
                .order_by(BackgroundTask.created_at.desc())
                .limit(limit)
            )
            rows = result.scalars().all()
            return [
                {
                    "task_id": r.id,
                    "task_type": r.task_type,
                    "state": r.state,
                    "progress": r.progress,
                    "message": r.message,
                    "error": r.error,
                    "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
                    "started_at": r.started_at.isoformat() + "Z" if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() + "Z" if r.completed_at else None,
                    "duration_seconds": (
                        (r.completed_at - r.started_at).total_seconds()
                        if r.started_at and r.completed_at else None
                    ),
                    "current_phase": r.current_phase,
                    "checkpoints": r.checkpoints or {},
                }
                for r in rows
            ]
    except Exception as exc:
        logger.warning("Failed to load historical tasks from DB: %s", exc)
        return []


# ---------------------------------------------------------------------------
# In-process queue with DB persistence + checkpointing (Fix 9 + 10)
# ---------------------------------------------------------------------------

class InProcessTaskQueue(TaskQueueProtocol):
    """In-process async task queue with DB-backed persistence.

    Tasks run as ``asyncio.Task`` objects in the current event loop.
    State is mirrored to the ``background_tasks`` DB table at key
    lifecycle events (enqueue, start, checkpoint, complete, fail) so
    status survives process restarts.
    """

    def __init__(self):
        self._tasks: Dict[str, TaskResult] = {}
        self._running: Dict[str, asyncio.Task] = {}

    async def enqueue(
        self,
        func: Callable,
        *args,
        task_type: str = "generic",
        **kwargs,
    ) -> str:
        """Submit a coroutine for background execution. Returns task_id."""
        task_id = str(uuid.uuid4())
        task_result = TaskResult(task_id=task_id, task_type=task_type)
        self._tasks[task_id] = task_result

        # Persist initial PENDING state to DB
        asyncio.ensure_future(_persist_task_state(task_result))

        async def _run():
            task_result.state = TaskState.RUNNING
            task_result.started_at = datetime.utcnow()
            task_result.message = "Processing..."
            await _persist_task_state(task_result)

            try:
                # Pass a progress callback so tasks can report progress
                result = await func(*args, task_status=task_result, **kwargs)
                task_result.result = result
                task_result.state = TaskState.COMPLETED
                task_result.progress = 100.0
                task_result.message = "Completed"
                task_result.completed_at = datetime.utcnow()
                logger.info(
                    "Task %s (%s) completed in %.1fs",
                    task_id, task_type,
                    (task_result.completed_at - task_result.started_at).total_seconds(),
                )
            except asyncio.CancelledError:
                task_result.state = TaskState.CANCELLED
                task_result.error = "Cancelled"
                task_result.message = "Cancelled"
                task_result.completed_at = datetime.utcnow()
                logger.info("Task %s (%s) cancelled", task_id, task_type)
            except Exception as e:
                task_result.state = TaskState.FAILED
                task_result.error = str(e)
                task_result.error_traceback = traceback.format_exc()
                task_result.message = f"Failed: {str(e)}"
                task_result.completed_at = datetime.utcnow()
                logger.error(
                    "Task %s (%s) failed at phase '%s': %s\n%s",
                    task_id, task_type, task_result._current_phase or "unknown",
                    e, task_result.error_traceback,
                )

            # Persist final state to DB
            await _persist_task_state(task_result)

        self._running[task_id] = asyncio.create_task(_run())
        logger.info("Task %s (%s) enqueued", task_id, task_type)
        return task_id

    def get_status(self, task_id: str) -> Optional[dict]:
        """Get current status of a task (in-memory first, then DB)."""
        task = self._tasks.get(task_id)
        if task is not None:
            return task.to_dict()
        return None

    async def get_status_with_fallback(self, task_id: str) -> Optional[dict]:
        """Get status from memory, falling back to DB for historical tasks."""
        status = self.get_status(task_id)
        if status is not None:
            return status
        # Try DB (task may have been from a previous process)
        try:
            from app.core.database import AsyncSessionLocal
            from app.models import BackgroundTask
            from sqlalchemy import select as sa_select

            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    sa_select(BackgroundTask).where(BackgroundTask.id == task_id)
                )
                row = result.scalar_one_or_none()
                if row:
                    return {
                        "task_id": row.id,
                        "task_type": row.task_type,
                        "state": row.state,
                        "progress": row.progress,
                        "message": row.message,
                        "error": row.error,
                        "created_at": row.created_at.isoformat() + "Z" if row.created_at else None,
                        "started_at": row.started_at.isoformat() + "Z" if row.started_at else None,
                        "completed_at": row.completed_at.isoformat() + "Z" if row.completed_at else None,
                        "duration_seconds": (
                            (row.completed_at - row.started_at).total_seconds()
                            if row.started_at and row.completed_at else None
                        ),
                        "current_phase": row.current_phase,
                        "last_checkpoint": None,
                        "checkpoints": row.checkpoints or {},
                    }
        except Exception:
            pass
        return None

    def get_result(self, task_id: str) -> Any:
        """Get the result of a completed task."""
        task = self._tasks.get(task_id)
        if task is None:
            return None
        if task.state == TaskState.COMPLETED:
            return task.result
        return None

    def list_tasks(self, task_type: Optional[str] = None, limit: int = 50) -> list:
        """List recent tasks, optionally filtered by type."""
        tasks = list(self._tasks.values())
        if task_type:
            tasks = [t for t in tasks if t.task_type == task_type]
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        return [t.to_dict() for t in tasks[:limit]]

    async def list_tasks_with_history(
        self, task_type: Optional[str] = None, limit: int = 50
    ) -> list:
        """List tasks from memory + DB historical tasks."""
        # In-memory tasks first (most up-to-date)
        in_memory = self.list_tasks(task_type=task_type, limit=limit)
        in_memory_ids = {t["task_id"] for t in in_memory}

        if len(in_memory) >= limit:
            return in_memory

        # Supplement with DB historical tasks
        remaining = limit - len(in_memory)
        historical = await _load_historical_tasks(limit=remaining + 20)
        if task_type:
            historical = [t for t in historical if t["task_type"] == task_type]
        # Exclude tasks already in memory
        historical = [t for t in historical if t["task_id"] not in in_memory_ids]

        combined = in_memory + historical[:remaining]
        return combined

    async def cancel(self, task_id: str) -> bool:
        """Cancel a running task."""
        aio_task = self._running.get(task_id)
        if aio_task and not aio_task.done():
            aio_task.cancel()
            task = self._tasks.get(task_id)
            if task:
                task.state = TaskState.CANCELLED
                task.error = "Cancelled by user"
                task.message = "Cancelled"
                task.completed_at = datetime.utcnow()
                await _persist_task_state(task)
            return True
        return False

    def cleanup_old(self, max_age_hours: int = 24):
        """Remove completed/failed tasks older than max_age_hours from memory."""
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        to_remove = [
            tid for tid, t in self._tasks.items()
            if t.completed_at and t.completed_at < cutoff
        ]
        for tid in to_remove:
            del self._tasks[tid]
            self._running.pop(tid, None)

    async def mark_stale_running_tasks(self):
        """On startup, mark any DB tasks stuck in 'running' as failed.

        If the process crashed, these tasks will never complete.
        Called once during application startup.
        """
        try:
            from app.core.database import AsyncSessionLocal
            from app.models import BackgroundTask
            from sqlalchemy import update as sa_update

            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    sa_update(BackgroundTask)
                    .where(BackgroundTask.state.in_(["pending", "running"]))
                    .values(
                        state="failed",
                        error="Process restarted — task was orphaned",
                        message="Failed: process restarted before completion",
                        completed_at=datetime.utcnow(),
                    )
                )
                if result.rowcount > 0:
                    logger.warning(
                        "Marked %d orphaned tasks as failed on startup", result.rowcount
                    )
                await session.commit()
        except Exception as exc:
            logger.warning("Failed to mark stale tasks: %s", exc)


# Singleton
task_queue = InProcessTaskQueue()
