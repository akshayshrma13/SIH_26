"""
Every HTTP endpoint the frontend uses.

The paths and the JSON field names match BACKEND_PLAN.md and the types in
`lib/demo-data.ts`, so the frontend can consume them without changes.
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import catalogue, jobs, parsing, storage
from .config import PIPELINE_STAGES, UPLOAD_DIR
from .ml import pipeline, stage1, stage2

router = APIRouter(prefix="/api")


# ─── Request bodies ───────────────────────────────────────────────────────────
class InferenceRequest(BaseModel):
    observationId: str


# ─── Health & models ──────────────────────────────────────────────────────────
@router.get("/health")
def health():
    return {
        "status": "ok",
        "stage1": {
            "name": PIPELINE_STAGES[0]["name"],
            "type": "statistical",
            "ready": True,  # no file to load - it is pure computation
        },
        "stage2": {
            "name": PIPELINE_STAGES[1]["name"],
            "type": "machine-learning",
            "file": "stage1_model.pt",
            "ready": stage2.is_available(),
        },
        "catalogueSize": len(catalogue.load_catalogue()),
    }


@router.get("/models")
def list_models():
    """
    The two pipeline stages shown on the Inference page.

    These are not alternatives - both always run, in `stage` order. Stage 1 is
    a statistical estimator, Stage 2 is the trained PyTorch network.
    """
    return PIPELINE_STAGES


# ─── Observations ─────────────────────────────────────────────────────────────
@router.get("/observations")
def list_observations():
    """Everything the user can run inference on: the 20 built-ins + uploads."""
    items = [
        {
            "id": planet["id"],
            "name": planet["name"],
            "target": planet["target"],
            "instrument": planet["instrument"],
            "source": "precomputed",
            "status": "complete" if storage.load_result(planet["id"]) else "queued",
            "createdAt": "2026-08-01T00:00:00Z",
        }
        for planet in catalogue.load_catalogue()
    ]
    items += [
        {
            "id": upload["id"],
            "name": upload["name"],
            "target": upload.get("target", "Uploaded target"),
            "instrument": upload.get("instrument", "User upload"),
            "source": "uploaded",
            "status": "complete" if storage.load_result(upload["id"]) else "queued",
            "createdAt": upload["createdAt"],
        }
        for upload in storage.list_uploads()
    ]
    return items


@router.post("/upload")
async def upload_observation(file: UploadFile = File(...)):
    """Save a telescope observation file and return its new observation id."""
    observation_id = storage.new_id("upload")
    suffix = ("." + file.filename.rsplit(".", 1)[-1]) if "." in (file.filename or "") else ".csv"
    saved_path = UPLOAD_DIR / f"{observation_id}{suffix}"
    saved_path.write_bytes(await file.read())

    try:
        parsed = parsing.parse_observation_file(saved_path)
    except parsing.ParseError as exc:
        saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(exc))

    meta = {
        "id": observation_id,
        "name": file.filename or saved_path.name,
        "target": "Uploaded target",
        "instrument": "User upload",
        "source": "uploaded",
        "status": "queued",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "file": saved_path.name,
        "sizeBytes": saved_path.stat().st_size,
        "rows": parsed["rows"],
        "columns": parsed["columns"],
        "depthColumn": parsed["depthColumn"],
        "wavelengthColumn": parsed["wavelengthColumn"],
        # The resampled 283-bin spectrum, stored so inference can reuse it.
        "spectrum": [float(v) for v in parsed["spectrum"]],
        # No star/planet properties in a bare CSV, so use catalogue medians.
        "params": catalogue.default_params(),
    }
    storage.save_upload_meta(observation_id, meta)

    preview = {k: v for k, v in meta.items() if k not in ("spectrum", "params")}
    preview["preview"] = [
        {"wavelength": round(w, 4), "depth": round(d * 1e6, 2)}
        for w, d in zip(
            pipeline.wavelengths.stage1_wavelength_grid()[::8], parsed["spectrum"][::8]
        )
    ]
    return preview


# ─── Inference ────────────────────────────────────────────────────────────────
def _inputs_for(observation_id: str):
    """Return (observed spectrum, params, observation dict, true spectrum|None)."""
    planet = catalogue.get_planet(observation_id)
    if planet is not None:
        observed = stage1.add_instrument_noise(planet["true_spectrum"], seed=planet["seed"])
        observation = {
            "id": planet["id"],
            "name": planet["name"],
            "target": planet["target"],
            "instrument": planet["instrument"],
            "source": "precomputed",
            "planetId": planet["planet_id"],
            "params": planet["params"],
        }
        return observed, planet["params"], observation, planet["true_spectrum"]

    upload = storage.load_upload_meta(observation_id)
    if upload is not None:
        observation = {
            "id": upload["id"],
            "name": upload["name"],
            "target": upload["target"],
            "instrument": upload["instrument"],
            "source": "uploaded",
            "params": upload["params"],
        }
        return np.array(upload["spectrum"], dtype=float), upload["params"], observation, None

    raise HTTPException(status_code=404, detail=f"unknown observation '{observation_id}'")


def _run_job(job_id: str, observation_id: str) -> None:
    """Runs in a worker thread so the event loop stays free for SSE."""
    try:
        jobs.update(job_id, status="running", progress=1, message="Starting")
        observed, params, observation, truth = _inputs_for(observation_id)

        def on_progress(percent: int, message: str) -> None:
            jobs.update(job_id, progress=percent, message=message)

        result = pipeline.run_pipeline(
            observed, params, observation, true_spectrum=truth, progress=on_progress,
        )
        storage.save_result(result)
        jobs.update(job_id, status="complete", progress=100, message="Inference complete")
    except Exception as exc:  # keep the job record instead of a silent crash
        jobs.update(job_id, status="failed", message=str(exc), error=str(exc))


@router.post("/inference")
async def start_inference(request: InferenceRequest):
    """Kick off the pipeline and return a job id to follow on /api/status."""
    _inputs_for(request.observationId)  # 404 early if the id is unknown

    job_id = storage.new_id("job")
    jobs.create(job_id, request.observationId)
    asyncio.create_task(asyncio.to_thread(_run_job, job_id, request.observationId))
    return {"jobId": job_id, "observationId": request.observationId, "status": "queued"}


@router.get("/status/{job_id}")
async def stream_status(job_id: str):
    """
    Server-Sent Events stream of a job's progress.

    Each message is a line `data: {...}` followed by a blank line - that is the
    SSE format the browser's EventSource understands.
    """
    if jobs.get(job_id) is None:
        raise HTTPException(status_code=404, detail=f"unknown job '{job_id}'")

    async def event_stream():
        while True:
            job = jobs.get(job_id)
            if job is None:
                break
            yield f"data: {json.dumps(job)}\n\n"
            if jobs.is_finished(job):
                break
            await asyncio.sleep(0.1)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    """Plain (non-streaming) job status, handy for polling or debugging."""
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"unknown job '{job_id}'")
    return job


# ─── Results ──────────────────────────────────────────────────────────────────
def _result_or_compute(observation_id: str) -> dict:
    """Return a saved result, computing it once on the spot if needed."""
    saved = storage.load_result(observation_id)
    if saved is not None:
        return saved

    observed, params, observation, truth = _inputs_for(observation_id)
    result = pipeline.run_pipeline(observed, params, observation, true_spectrum=truth)
    storage.save_result(result)
    return result


@router.get("/results/{observation_id}")
def get_result(observation_id: str):
    return _result_or_compute(observation_id)


@router.get("/chemical-composition/{observation_id}")
def get_composition(observation_id: str):
    result = _result_or_compute(observation_id)
    return {
        "id": result["id"],
        "composition": result["composition"],
        "planetProperties": result["planetProperties"],
    }


@router.get("/demo-results")
def demo_results():
    """
    Pre-computed results for the dashboard showcase.

    Runs the real pipeline on the first three catalogue planets the first time
    it is called, then serves the saved JSON.
    """
    planets = catalogue.load_catalogue()[:3]
    if not planets:
        raise HTTPException(status_code=503, detail="test_array.npy not found")
    return [_result_or_compute(planet["id"]) for planet in planets]


@router.get("/results/{observation_id}/export.csv")
def export_csv(observation_id: str):
    """Download the recovered spectrum as CSV (Results page export)."""
    result = _result_or_compute(observation_id)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["wavelength_um", "observed_ppm", "recovered_ppm", "lower_ppm", "upper_ppm"])
    for point in result["spectrum"]:
        writer.writerow(
            [point["wavelength"], point["observed"], point["recovered"],
             point["lower"], point["upper"]]
        )

    return StreamingResponse(
        io.BytesIO(buffer.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{observation_id}-spectrum.csv"'},
    )
