"""
Reads an uploaded observation file and turns it into a 283-bin spectrum.

Supported:
  * CSV  - a wavelength column and a depth/flux column (names are matched
           loosely, so `wl`, `wavelength`, `lambda` all work).
  * FITS - the first table extension, same column matching. Needs astropy;
           if astropy is not installed the upload is rejected with a clear
           message instead of crashing.
  * NPY  - a plain array of 283 depths, or an (N, 2) array of
           (wavelength, depth) pairs.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .ml import wavelengths

WAVELENGTH_NAMES = ["wavelength", "wl", "lambda", "wave", "micron", "um"]
DEPTH_NAMES = ["depth", "transit_depth", "spectrum", "flux", "value", "signal"]
NOISE_NAMES = ["noise", "sigma", "error", "err", "uncertainty", "noise_est"]


class ParseError(Exception):
    """Raised when we cannot make sense of an uploaded file."""


def _find_column(columns: list[str], candidates: list[str]) -> str | None:
    lowered = {c.lower().strip(): c for c in columns}
    for candidate in candidates:
        for key, original in lowered.items():
            if candidate in key:
                return original
    return None


def _from_dataframe(frame: pd.DataFrame) -> dict:
    columns = list(frame.columns.astype(str))
    numeric = frame.select_dtypes("number")

    depth_col = _find_column(columns, DEPTH_NAMES)
    wl_col = _find_column(columns, WAVELENGTH_NAMES)
    noise_col = _find_column(columns, NOISE_NAMES)

    # If nothing matched by name, fall back to column position.
    if depth_col is None:
        if numeric.shape[1] == 0:
            raise ParseError("no numeric columns found in the file")
        depth_col = numeric.columns[1] if numeric.shape[1] > 1 else numeric.columns[0]
    if wl_col is None and numeric.shape[1] > 1:
        wl_col = numeric.columns[0]

    depth = pd.to_numeric(frame[depth_col], errors="coerce").to_numpy(dtype=float)
    valid = ~np.isnan(depth)

    if wl_col is not None and wl_col != depth_col:
        wl = pd.to_numeric(frame[wl_col], errors="coerce").to_numpy(dtype=float)
        valid &= ~np.isnan(wl)
        wl, depth = wl[valid], depth[valid]
    else:
        depth = depth[valid]
        wl = np.linspace(
            wavelengths.AIRS_LO_UM, wavelengths.AIRS_HI_UM, len(depth)
        )

    if len(depth) < 4:
        raise ParseError("need at least 4 usable rows")

    # Values given in ppm (e.g. 2400) are rescaled to fractions (0.0024), which
    # is the unit the models were trained on.
    if np.nanmedian(np.abs(depth)) > 1.0:
        depth = depth / 1e6

    return {
        "spectrum": wavelengths.resample_to_stage1_grid(wl, depth),
        "rows": int(len(depth)),
        "columns": columns,
        "wavelengthColumn": str(wl_col) if wl_col else None,
        "depthColumn": str(depth_col),
        "noiseColumn": str(noise_col) if noise_col else None,
    }


def parse_observation_file(path: Path) -> dict:
    suffix = path.suffix.lower()

    if suffix in (".csv", ".txt", ".tsv"):
        separator = "\t" if suffix == ".tsv" else None
        frame = pd.read_csv(path, sep=separator, engine="python")
        return _from_dataframe(frame)

    if suffix in (".fits", ".fit"):
        try:
            from astropy.io import fits
        except ImportError as exc:
            raise ParseError(
                "FITS support needs astropy. Install it with "
                "`pip install astropy` (it requires numpy>=2), or upload a CSV."
            ) from exc
        with fits.open(path) as hdus:
            table = next((h for h in hdus if getattr(h, "data", None) is not None
                          and hasattr(h.data, "names")), None)
            if table is None:
                raise ParseError("no table extension found in the FITS file")
            frame = pd.DataFrame({name: table.data[name].byteswap().newbyteorder()
                                  for name in table.data.names})
        return _from_dataframe(frame)

    if suffix == ".npy":
        # allow_pickle stays False: unpickling an uploaded file would run
        # arbitrary code. Object arrays (like the Kaggle test_array.npy) are
        # therefore rejected with an explanation rather than a 500.
        try:
            array = np.load(path, allow_pickle=False)
        except ValueError as exc:
            raise ParseError(
                "this .npy holds Python objects, not plain numbers, so it cannot be "
                "uploaded. If this is the Ariel test_array.npy, its 20 planets are "
                "already loaded as the built-in archive — pick one on the Upload "
                "page's 'Ariel archive' tab instead. Otherwise export a plain "
                "(wavelength, depth) array or a CSV."
            ) from exc
        if array.ndim == 2 and array.shape[1] >= 2:
            frame = pd.DataFrame(array[:, :2], columns=["wavelength", "depth"])
            return _from_dataframe(frame)
        array = np.asarray(array, dtype=float).ravel()
        frame = pd.DataFrame({"depth": array})
        return _from_dataframe(frame)

    raise ParseError(f"unsupported file type '{suffix}' - use CSV, FITS or NPY")
