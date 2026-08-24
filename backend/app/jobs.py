"""
Keeps track of running inference jobs so the SSE endpoint can report progress.

Jobs live in a plain dictionary in memory. That is fine for a local single-user
app: if the server restarts, any half-finished job is gone anyway.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone

_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def create(job_id: str, observation_id: str) -> dict:
    job = {
        "jobId": job_id,
        "observationId": observation_id,
        "status": "queued",       # queued | running | complete | failed
        "progress": 0,
        "message": "Queued",
        "error": None,
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    with _lock:
        _jobs[job_id] = job
    return job


def update(job_id: str, **fields) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].update(fields)


def get(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def is_finished(job: dict) -> bool:
    return job["status"] in ("complete", "failed")
