"""
The "dimension mismatch" adapter between Stage 1 and Stage 2.

The two models were trained on different datasets and therefore speak two
different wavelength grids:

  Stage 1 (spectrum recovery)   -> 283 values per planet
                                   index 0      = FGS1 photometric point (~0.70 um)
                                   index 1..282 = AIRS-CH0, ~1.95 um to ~3.90 um

  Stage 2 (composition network) -> expects 33 values per quantity, which is the
                                   part of the 52-bin Ariel grid that falls
                                   inside 1.95-3.89 um (see train.py, the
                                   AIRS_CH0_LO / AIRS_CH0_HI constants).

So the adapter is: throw away the FGS point, then average the 282 AIRS
channels down into 33 wider bins. Averaging is the right operation because
these are transit depths (a ratio), not fluxes that need summing, and it also
shrinks the noise by roughly sqrt(number of channels averaged).
"""

import numpy as np

# Number of values Stage 1 produces.
N_STAGE1_BINS = 283

# Wavelength of the single FGS1 photometric channel (index 0 of the 283 grid).
FGS_WAVELENGTH_UM = 0.70

# The AIRS-CH0 band covered by channels 1..282.
AIRS_LO_UM = 1.95
AIRS_HI_UM = 3.89

# Number of bins Stage 2 wants.
N_STAGE2_BINS = 33


def stage1_wavelength_grid() -> np.ndarray:
    """The 283 wavelengths (in microns) that Stage 1 outputs values for."""
    airs = np.linspace(AIRS_LO_UM, AIRS_HI_UM, N_STAGE1_BINS - 1)
    return np.concatenate([[FGS_WAVELENGTH_UM], airs])


def stage2_wavelength_grid() -> np.ndarray:
    """The 33 bin-centre wavelengths (in microns) that Stage 2 consumes."""
    edges = np.linspace(AIRS_LO_UM, AIRS_HI_UM, N_STAGE2_BINS + 1)
    return (edges[:-1] + edges[1:]) / 2.0


def rebin_283_to_33(values: np.ndarray, is_noise: bool = False) -> np.ndarray:
    """
    Convert one 283-long Stage 1 array into the 33-long array Stage 2 needs.

    `is_noise=True` combines the values as uncertainties (they shrink when you
    average) instead of as plain measurements.
    """
    values = np.asarray(values, dtype=np.float64)
    if values.shape[0] != N_STAGE1_BINS:
        raise ValueError(f"expected {N_STAGE1_BINS} values, got {values.shape[0]}")

    airs = values[1:]  # drop the FGS channel - Stage 2 never saw it in training
    groups = np.array_split(airs, N_STAGE2_BINS)

    if is_noise:
        # sigma of a mean of n independent values = sqrt(sum(sigma^2)) / n
        return np.array([np.sqrt(np.sum(g**2)) / len(g) for g in groups])
    return np.array([g.mean() for g in groups])


def resample_to_stage1_grid(wavelengths: np.ndarray, values: np.ndarray) -> np.ndarray:
    """
    Put an arbitrary uploaded spectrum onto the 283-point Stage 1 grid.

    Uploaded CSV/FITS files can have any number of rows at any wavelengths, so
    we linearly interpolate them onto the grid the rest of the pipeline uses.
    """
    wavelengths = np.asarray(wavelengths, dtype=np.float64)
    values = np.asarray(values, dtype=np.float64)

    order = np.argsort(wavelengths)
    wavelengths, values = wavelengths[order], values[order]

    return np.interp(stage1_wavelength_grid(), wavelengths, values)
