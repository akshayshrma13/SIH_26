"""
STAGE 2 - Atmospheric composition + temperature.

This is a REAL PyTorch model: `stage1_model.pt` plus `stage1_scalers.pkl`
(the file names are the ones on disk; despite the "stage1" prefix this is the
network `train.py` builds, and in our pipeline it runs second).

Network shape, straight from train.py:

  input  (104) = spectrum(33) + noise(33) + transit_depth(33) + aux(5)
  output  (14) = 7 medians (Q2) + 7 half-widths (h, forced positive)

The 7 quantities, in order:
  planet_radius, planet_temp, log_H2O, log_CO2, log_CO, log_CH4, log_NH3

From the 14 outputs we rebuild a quartile triplet per quantity:
  Q1 = Q2 - h        Q2 = median        Q3 = Q2 + h
which is what gives the frontend its uncertainty numbers.
"""

from __future__ import annotations

import pickle

import numpy as np
import torch
import torch.nn as nn

from ..config import (
    JUPITER_MASS_KG,
    SOLAR_MASS_KG,
    SOLAR_RADIUS_M,
    STAGE2_MODEL_PATH,
    STAGE2_SCALERS_PATH,
    TARGET_NAMES,
)


class CompositionNet(nn.Module):
    """Exactly the architecture from train.py - the weights only fit this one."""

    def __init__(self, in_dim: int = 104):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 512), nn.BatchNorm1d(512), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(256, 128), nn.BatchNorm1d(128), nn.GELU(),
            nn.Linear(128, 14),
        )
        self.softplus = nn.Softplus()

    def forward(self, x):
        out = self.net(x)
        q2 = out[:, :7]                     # medians, can be any sign
        h = self.softplus(out[:, 7:])       # half-widths, always positive
        return torch.cat([q2, h], dim=1)


# The model and scalers are loaded once and reused for every request.
_model: CompositionNet | None = None
_scalers: dict | None = None


def load_model() -> tuple[CompositionNet, dict]:
    global _model, _scalers
    if _model is None:
        with open(STAGE2_SCALERS_PATH, "rb") as handle:
            _scalers = pickle.load(handle)

        _model = CompositionNet()
        state = torch.load(STAGE2_MODEL_PATH, map_location="cpu", weights_only=False)
        _model.load_state_dict(state)
        _model.eval()  # important: uses the stored BatchNorm statistics
    return _model, _scalers  # type: ignore[return-value]


def is_available() -> bool:
    return STAGE2_MODEL_PATH.exists() and STAGE2_SCALERS_PATH.exists()


def build_aux_features(params: dict) -> np.ndarray:
    """
    The 5 auxiliary (non-spectral) inputs the network was trained on, in the
    order train.py used:

        star_mass_kg, star_radius_m, star_temperature,
        planet_mass_kg, planet_orbital_period

    `params` holds the values as stored in `test_array.npy`, where stellar mass
    and radius are in solar units and planet mass is in Jupiter masses, so they
    are converted to SI here.
    """
    return np.array(
        [
            params["star_mass_solar"] * SOLAR_MASS_KG,
            params["star_radius_solar"] * SOLAR_RADIUS_M,
            params["star_temperature"],
            params["planet_mass_jupiter"] * JUPITER_MASS_KG,
            params["orbital_period_days"],
        ],
        dtype=np.float64,
    )


def predict(spectrum33: np.ndarray, noise33: np.ndarray, aux5: np.ndarray) -> dict:
    """
    Run the network on a single planet.

    Returns {"planet_radius": {"q1":..,"q2":..,"q3":..,"h":..}, ...} for all
    seven quantities, in physical units.
    """
    model, scalers = load_model()

    # train.py used the instrument spectrum a second time as "transit depth",
    # because in that dataset the spectrum already *is* the transit depth.
    features = np.concatenate([spectrum33, noise33, spectrum33, aux5])
    features = np.nan_to_num(features, nan=0.0, posinf=1e6, neginf=-1e6)

    x = scalers["X"].transform(features.reshape(1, -1)).astype(np.float32)

    with torch.no_grad():
        raw = model(torch.from_numpy(x)).numpy()

    raw = scalers["y"].inverse_transform(raw)[0]  # back to physical units
    medians, half_widths = raw[:7], np.abs(raw[7:])

    return {
        name: {
            "q1": float(medians[i] - half_widths[i]),
            "q2": float(medians[i]),
            "q3": float(medians[i] + half_widths[i]),
            "h": float(half_widths[i]),
        }
        for i, name in enumerate(TARGET_NAMES)
    }


def confidence_from_spread(half_width: float) -> float:
    """
    Turn a half-width into the 0-1 "confidence" number the frontend charts show.

    A narrow posterior means the network is sure. For log-abundances a spread
    of ~1 dex is a genuinely wide posterior, so we map h through 1/(1+h): h=0
    gives 1.0, h=1 dex gives 0.5, h=3 dex gives 0.25.
    """
    return float(round(1.0 / (1.0 + max(half_width, 0.0)), 4))
