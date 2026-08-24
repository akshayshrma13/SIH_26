"""
The built-in observation catalogue, read from `test_array.npy`.

That file holds 20 real Ariel planets. Each one gives us:
  * `spectrum`        - 283 transit depths (the clean, known spectrum)
  * `transit_params`  - the star and planet properties Stage 2 needs
  * `planet_id`       - a stable integer id

The raw light-curve arrays inside each planet are all None (the file was saved
before the loading steps ran), so the clean spectrum is what we work with, and
Stage 1 recovers it from a noised copy of itself. See ml/stage1.py.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np

from . import kaggle_shim
from .config import TEST_ARRAY_PATH

# A few recognisable names so the dropdown does not read as a wall of integers.
FRIENDLY_NAMES = [
    "WASP-96 b", "HD 209458 b", "K2-18 b", "WASP-39 b", "HAT-P-11 b",
    "GJ 1214 b", "WASP-121 b", "TRAPPIST-1 e", "HD 189733 b", "WASP-43 b",
    "LHS 1140 b", "55 Cancri e", "KELT-9 b", "TOI-270 d", "WASP-107 b",
    "GJ 3470 b", "HAT-P-1 b", "WASP-17 b", "HD 97658 b", "K2-141 b",
]


def _to_float(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


@lru_cache(maxsize=1)
def load_catalogue() -> list[dict]:
    """
    Read test_array.npy once and turn it into plain dictionaries.

    Cached, so the file is only parsed on the first request.
    """
    if not TEST_ARRAY_PATH.exists():
        return []

    kaggle_shim.install()
    planets = np.load(TEST_ARRAY_PATH, allow_pickle=True)

    catalogue = []
    for index, planet in enumerate(planets):
        params = planet.transit_params
        catalogue.append(
            {
                "id": f"ariel-{planet.planet_id}",
                "planet_id": int(planet.planet_id),
                "name": f"{FRIENDLY_NAMES[index % len(FRIENDLY_NAMES)]} — Ariel {planet.planet_id}",
                "target": FRIENDLY_NAMES[index % len(FRIENDLY_NAMES)],
                "instrument": "Ariel AIRS-CH0 + FGS1",
                "source": "precomputed",
                "seed": int(planet.planet_id) % 100_000,
                # The clean 283-bin spectrum, used as ground truth.
                "true_spectrum": np.asarray(planet.spectrum, dtype=np.float64),
                # Star / planet properties -> Stage 2 auxiliary features.
                "params": {
                    "star_radius_solar": _to_float(getattr(params, "Rs", 1.0)),
                    "star_mass_solar": _to_float(getattr(params, "Ms", 1.0)),
                    "star_temperature": _to_float(getattr(params, "Ts", 5800.0)),
                    "planet_mass_jupiter": _to_float(getattr(params, "Mp", 1.0)),
                    "orbital_period_days": _to_float(getattr(params, "P", 10.0)),
                    "semi_major_axis": _to_float(getattr(params, "sma", 10.0)),
                    "inclination_deg": _to_float(getattr(params, "i", 90.0)),
                },
            }
        )
    return catalogue


def get_planet(observation_id: str) -> dict | None:
    for planet in load_catalogue():
        if planet["id"] == observation_id:
            return planet
    return None


def default_params() -> dict:
    """
    Fallback star/planet properties for uploaded files that do not carry any.

    Uses the median of the 20 catalogue planets, which keeps the auxiliary
    features inside the range the Stage 2 network was trained on.
    """
    catalogue = load_catalogue()
    if not catalogue:
        return {
            "star_radius_solar": 1.0,
            "star_mass_solar": 1.0,
            "star_temperature": 5800.0,
            "planet_mass_jupiter": 1.0,
            "orbital_period_days": 10.0,
        }
    keys = catalogue[0]["params"].keys()
    return {
        key: float(np.median([p["params"][key] for p in catalogue])) for key in keys
    }
