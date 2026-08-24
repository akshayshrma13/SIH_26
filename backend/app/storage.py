"""
The tiny file-based "database".

Instead of running PostgreSQL we just write JSON files into ./data:

    data/uploads/<id>.csv         the file the user uploaded
    data/uploads/<id>.json        metadata about that upload
    data/results/<id>.json        a finished pipeline result

That is enough for a local app and it means anyone can open the files and read
them in a text editor.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from .config import RESULTS_DIR, UPLOAD_DIR


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


# ─── Uploads ──────────────────────────────────────────────────────────────────
def save_upload_meta(observation_id: str, meta: dict) -> None:
    _write_json(UPLOAD_DIR / f"{observation_id}.json", meta)


def load_upload_meta(observation_id: str) -> dict | None:
    return _read_json(UPLOAD_DIR / f"{observation_id}.json")


def list_uploads() -> list[dict]:
    uploads = [_read_json(p) for p in sorted(UPLOAD_DIR.glob("*.json"))]
    return [u for u in uploads if u]


# ─── Results ──────────────────────────────────────────────────────────────────
def save_result(result: dict) -> None:
    _write_json(RESULTS_DIR / f"{result['id']}.json", result)


def load_result(observation_id: str) -> dict | None:
    return _read_json(RESULTS_DIR / f"{observation_id}.json")


def list_results() -> list[dict]:
    results = [_read_json(p) for p in sorted(RESULTS_DIR.glob("*.json"))]
    return [r for r in results if r]
