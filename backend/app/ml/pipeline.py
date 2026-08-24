"""
The full two-stage pipeline, wired together.

    observed spectrum (283)
        -> STAGE 1  statistical estimator -> recovered + uncertainty (283)
        -> ADAPTER  283 -> 33 AIRS bins   -> spectrum33, noise33
        -> STAGE 2  composition network   -> 7 quantities with quartiles
        -> a single JSON-ready result dictionary

Both stages always run, in this order. There is nothing to choose between.

`progress` is an optional callback `progress(percent, message)` that the SSE
endpoint uses to stream live updates to the frontend.
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

from ..config import MOLECULES, PIPELINE_STAGES, TARGET_NAMES
from . import stage1, stage2, wavelengths

# Transit depths are stored as a fraction; the charts show parts-per-million.
PPM = 1e6

STAGE_MESSAGES = [
    "Loading observation",
    "Estimating noise level",
    "Shrinking bins toward local means",
    "Smoothing and building the 1-sigma band",
    "Predicting atmospheric composition",
]


def run_pipeline(
    observed: np.ndarray,
    params: dict,
    observation: dict,
    true_spectrum: np.ndarray | None = None,
    progress=None,
) -> dict:
    """Run both stages and return the result dictionary the API serves."""

    def report(percent: int, message: str) -> None:
        if progress is not None:
            progress(percent, message)

    grid283 = wavelengths.stage1_wavelength_grid()
    observed = np.asarray(observed, dtype=np.float64)

    # ── Stage 1 ───────────────────────────────────────────────────────────────
    report(5, STAGE_MESSAGES[0])
    report(20, STAGE_MESSAGES[1])

    report(40, STAGE_MESSAGES[2])
    recovery = stage1.recover_spectrum(observed)

    report(60, STAGE_MESSAGES[3])

    # ── Adapter: 283 -> 33 ────────────────────────────────────────────────────
    spectrum33 = wavelengths.rebin_283_to_33(recovery["recovered"])
    noise33 = wavelengths.rebin_283_to_33(recovery["sigma"], is_noise=True)

    # ── Stage 2 ───────────────────────────────────────────────────────────────
    report(75, STAGE_MESSAGES[4])
    aux5 = stage2.build_aux_features(params)
    prediction = stage2.predict(spectrum33, noise33, aux5)

    report(90, "Finalising result")

    # ── Assemble the response ─────────────────────────────────────────────────
    spectrum_points = []
    for i in range(len(grid283)):
        point = {
            "wavelength": round(float(grid283[i]), 4),
            "observed": round(float(observed[i] * PPM), 2),
            "recovered": round(float(recovery["recovered"][i] * PPM), 2),
            "lower": round(float(recovery["lower"][i] * PPM), 2),
            "upper": round(float(recovery["upper"][i] * PPM), 2),
            "sigma": round(float(recovery["sigma"][i] * PPM), 2),
        }
        if true_spectrum is not None:
            point["truth"] = round(float(true_spectrum[i] * PPM), 2)
        spectrum_points.append(point)

    composition = [
        {
            "molecule": m["molecule"],
            "formula": m["formula"],
            "abundance": round(prediction[m["key"]]["q2"], 3),
            "lower": round(prediction[m["key"]]["q1"], 3),
            "upper": round(prediction[m["key"]]["q3"], 3),
            "confidence": stage2.confidence_from_spread(prediction[m["key"]]["h"]),
        }
        for m in MOLECULES
    ]

    metrics = {
        "noiseReductionPercent": _noise_reduction(observed, recovery["recovered"]),
        "meanSigmaPpm": round(float(np.mean(recovery["sigma"]) * PPM), 3),
        "bins": len(grid283),
        "stage2Bins": wavelengths.N_STAGE2_BINS,
    }
    if true_spectrum is not None:
        metrics["rmsePpm"] = round(
            float(np.sqrt(np.mean((recovery["recovered"] - true_spectrum) ** 2)) * PPM), 3
        )
        metrics["observedRmsePpm"] = round(
            float(np.sqrt(np.mean((observed - true_spectrum) ** 2)) * PPM), 3
        )

    return {
        "id": observation["id"],
        "observation": {k: v for k, v in observation.items() if k != "true_spectrum"},
        "stages": [{"id": s["id"], "name": s["name"], "type": s["type"]} for s in PIPELINE_STAGES],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "spectrum": spectrum_points,
        "composition": composition,
        "planetProperties": {
            "radiusJupiter": _triplet(prediction["planet_radius"]),
            "temperatureK": _triplet(prediction["planet_temp"]),
        },
        "rawPrediction": {name: prediction[name] for name in TARGET_NAMES},
        "metrics": metrics,
    }


def _triplet(entry: dict) -> dict:
    return {
        "value": round(entry["q2"], 4),
        "lower": round(entry["q1"], 4),
        "upper": round(entry["q3"], 4),
    }


def _noise_reduction(observed: np.ndarray, recovered: np.ndarray) -> float:
    """How much bin-to-bin scatter the denoiser removed, as a percentage."""
    before = float(np.std(np.diff(observed)))
    after = float(np.std(np.diff(recovered)))
    if before <= 0:
        return 0.0
    return round(max(0.0, (1.0 - after / before)) * 100.0, 2)
