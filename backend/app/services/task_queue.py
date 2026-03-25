"""
Background task queue for long-running operations.

Architecture:
  - Production: Uses ARQ (async Redis queue) for distributed task processing
  - Development: Uses in-process asyncio tasks with status tracking

All tasks are tracked via a TaskStatus model that provides:
  - Polling endpoint for frontend progress bars
  - Result storage for completed tasks
  - Error capture for failed tasks
"""

import asyncio
import uuid
import logging
import traceback
from datetime import datetime
from typing import Any, Callable, Dict, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class TaskState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskResult:
    """Tracks the lifecycle of a background task."""
    def __init__(self, task_id: str, task_type: str):
        self.task_id = task_id
        self.task_type = task_type
        self.state = TaskState.PENDING
        self.progress: float = 0.0  # 0-100
        self.message: str = "Queued"
        self.result: Any = None
        self.error: Optional[str] = None
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
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
        }


class InProcessTaskQueue:
    """In-process async task queue (development / single-worker mode).

    Tasks run as asyncio.Tasks in the same event loop. Results are stored
    in memory and survive until the process restarts.
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

        async def _run():
            task_result.state = TaskState.RUNNING
            task_result.started_at = datetime.utcnow()
            task_result.message = "Processing..."
            try:
                # Pass a progress callback so tasks can report progress
                result = await func(*args, task_status=task_result, **kwargs)
                task_result.result = result
                task_result.state = TaskState.COMPLETED
                task_result.progress = 100.0
                task_result.message = "Completed"
                task_result.completed_at = datetime.utcnow()
                logger.info(f"Task {task_id} ({task_type}) completed in "
                           f"{(task_result.completed_at - task_result.started_at).total_seconds():.1f}s")
            except Exception as e:
                task_result.state = TaskState.FAILED
                task_result.error = str(e)
                task_result.message = f"Failed: {str(e)}"
                task_result.completed_at = datetime.utcnow()
                logger.error(f"Task {task_id} ({task_type}) failed: {e}\n{traceback.format_exc()}")

        self._running[task_id] = asyncio.create_task(_run())
        logger.info(f"Task {task_id} ({task_type}) enqueued")
        return task_id

    def get_status(self, task_id: str) -> Optional[dict]:
        """Get current status of a task."""
        task = self._tasks.get(task_id)
        if task is None:
            return None
        return task.to_dict()

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

    async def cancel(self, task_id: str) -> bool:
        """Cancel a running task."""
        aio_task = self._running.get(task_id)
        if aio_task and not aio_task.done():
            aio_task.cancel()
            task = self._tasks.get(task_id)
            if task:
                task.state = TaskState.FAILED
                task.error = "Cancelled by user"
                task.message = "Cancelled"
                task.completed_at = datetime.utcnow()
            return True
        return False

    def cleanup_old(self, max_age_hours: int = 24):
        """Remove completed/failed tasks older than max_age_hours."""
        cutoff = datetime.utcnow()
        from datetime import timedelta
        cutoff = cutoff - timedelta(hours=max_age_hours)
        to_remove = [
            tid for tid, t in self._tasks.items()
            if t.completed_at and t.completed_at < cutoff
        ]
        for tid in to_remove:
            del self._tasks[tid]
            self._running.pop(tid, None)


# Singleton
task_queue = InProcessTaskQueue()
