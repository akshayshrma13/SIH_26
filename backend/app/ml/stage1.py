"""
STAGE 1 - Spectrum recovery.

Input : a noisy observed transit-depth spectrum (283 wavelength bins)
Output: a recovered spectrum + a 1-sigma uncertainty band per bin

This stage is deliberately NOT a machine learning model. It is a statistical
estimator built from means and standard deviations.

  1. NOISE LEVEL.  A real transmission spectrum varies smoothly with
     wavelength, so any sharp bin-to-bin jump is noise. The second difference
     isolates exactly that, and a median-absolute-deviation of it gives a
     robust standard deviation (robust = a few genuine sharp absorption lines
     cannot inflate it).

  2. SHRINKAGE.  For each bin we take the local mean and the local variance
     over a window. Part of that variance is real structure, part is noise:

         signal variance  s^2 = max(local variance - noise^2, 0)

     The bin is pulled toward its local mean by how much of its scatter is
     noise:

         recovered = local_mean + [ s^2 / (s^2 + noise^2) ] * (obs - local_mean)

     A bin whose scatter is all noise (s^2 = 0) collapses onto the local mean;
     a bin with strong real structure keeps its observed value. This is the
     standard empirical-Bayes / Wiener shrinkage estimator.

  3. SMOOTHING.  A Savitzky-Golay pass removes the remaining high-frequency
     noise while preserving the shape of the absorption features (unlike a
     plain moving average, which flattens their peaks).

THE TWO BANDS ARE HANDLED SEPARATELY. Bin 0 is the FGS1 photometric channel at
0.70 um; bins 1..282 are the AIRS-CH0 band from 1.95 to 3.89 um. Smoothing a
lone point 1.25 um away from its "neighbours" is meaningless, so the FGS bin is
passed through untouched and carries the full noise as its uncertainty, while
the AIRS band is processed on its own. Doing this also stops the FGS value from
contaminating the first ~20 AIRS bins through the smoothing window (their mean
error drops from 102 to 75 ppm).

MEASURED on the 20 catalogue planets with known spectra:
    observed   339.7 ppm RMSE
    recovered   69.9 ppm RMSE      - a 4.9x improvement

The window sizes were tuned on those planets. The optimum is broad and flat
(within ~1 ppm across a wide range), so modest values are used rather than the
exact argmin, which would just be fitting to 20 planets.
"""

from __future__ import annotations

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import savgol_filter

# Window sizes in wavelength bins. See the note about the flat optimum above.
SHRINKAGE_WINDOW = 41
SMOOTHING_WINDOW = 41
SMOOTHING_POLYORDER = 3

# The raw estimator is overconfident: its formal error bars only describe the
# noise it removed, not the real structure the smoothing also flattens. This
# factor is fitted on the 20 catalogue planets so that ~68% of bins genuinely
# fall inside the 1-sigma band (measured: 67.1%). Without it the band claims
# 41 ppm while the true error is 70 ppm, which would be misleading.
# Re-fit this if the window sizes above change.
UNCERTAINTY_CALIBRATION = 2.5

# Bin 0 is the FGS1 photometric channel; bins 1..282 are AIRS-CH0.
FGS_BIN = 0


def estimate_noise(observed: np.ndarray) -> np.ndarray:
    """
    Estimate the 1-sigma noise of each bin from the bin-to-bin scatter.

    Uses the median absolute deviation of the second difference, which is
    robust to real absorption features. The 1.4826 converts a MAD into a
    standard deviation; the sqrt(6) removes the variance inflation that taking
    a second difference introduces.
    """
    second_difference = np.diff(observed, n=2)
    mad = np.median(np.abs(second_difference - np.median(second_difference)))
    sigma = 1.4826 * mad / np.sqrt(6.0)
    sigma = max(float(sigma), 1e-12)
    return np.full_like(observed, sigma, dtype=np.float64)


def _odd(value: int, limit: int) -> int:
    """Savitzky-Golay needs an odd window no longer than the data."""
    value = int(value)
    if value % 2 == 0:
        value += 1
    return max(5, min(value, limit - 1 | 1))


def _recover_band(observed: np.ndarray, noise: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Steps 2 and 3 applied to one contiguous band. Returns (recovered, sigma)."""
    window = min(SHRINKAGE_WINDOW, len(observed))

    # ── Step 2: shrink each bin toward its local mean ──────────────────────────
    local_mean = uniform_filter1d(observed, size=window, mode="nearest")
    local_variance = uniform_filter1d((observed - local_mean) ** 2, size=window, mode="nearest")

    signal_variance = np.maximum(local_variance - noise**2, 0.0)
    keep = signal_variance / (signal_variance + noise**2)  # 0 = all noise, 1 = all signal
    shrunk = local_mean + keep * (observed - local_mean)

    # ── Step 3: smooth, preserving absorption-feature shape ───────────────────
    smoothing = _odd(SMOOTHING_WINDOW, len(observed))
    recovered = savgol_filter(shrunk, window_length=smoothing, polyorder=SMOOTHING_POLYORDER)

    # ── Uncertainty: estimator variance + the structure smoothing removed ─────
    # Averaging n values divides the standard deviation by sqrt(n); a
    # Savitzky-Golay filter of order p is worth about window/(p+1) samples.
    effective_samples = max(smoothing / (SMOOTHING_POLYORDER + 1.0), 1.0)
    variance_term = np.sqrt(keep) * noise / np.sqrt(effective_samples)
    bias_term = np.sqrt(
        uniform_filter1d((shrunk - recovered) ** 2, size=smoothing, mode="nearest")
    )

    sigma = UNCERTAINTY_CALIBRATION * np.sqrt(variance_term**2 + bias_term**2)
    return recovered, sigma


def recover_spectrum(observed: np.ndarray, noise: np.ndarray | None = None) -> dict:
    """
    Recover one spectrum.

    Returns a dict of numpy arrays: recovered, noise, sigma, lower, upper.
    """
    observed = np.asarray(observed, dtype=np.float64)
    if noise is None:
        noise = estimate_noise(observed)
    noise = np.asarray(noise, dtype=np.float64)

    recovered = np.empty_like(observed)
    sigma = np.empty_like(observed)

    if len(observed) > 1:
        # FGS1: one isolated photometric point. Nothing to average it against,
        # so it passes through and keeps the full noise as its uncertainty.
        recovered[FGS_BIN] = observed[FGS_BIN]
        sigma[FGS_BIN] = noise[FGS_BIN]
        recovered[1:], sigma[1:] = _recover_band(observed[1:], noise[1:])
    else:
        recovered[:] = observed
        sigma[:] = noise

    return {
        "recovered": recovered,
        "noise": noise,
        "sigma": sigma,
        "lower": recovered - sigma,
        "upper": recovered + sigma,
    }


def add_instrument_noise(true_spectrum: np.ndarray, seed: int, snr: float = 45.0) -> np.ndarray:
    """
    Build a realistic *observed* spectrum from a known clean one.

    Needed because `test_array.npy` was saved at `loading_step = 0`: every
    planet carries its clean 283-bin spectrum, but all of the raw light-curve
    arrays (`times`, `data`, `noise_est`, ...) are None. There is therefore no
    real noisy observation in the file, so we inject Ariel-like photon noise
    ourselves. The noise is seeded per planet, so a given planet always looks
    the same across restarts.
    """
    true_spectrum = np.asarray(true_spectrum, dtype=np.float64)
    rng = np.random.default_rng(seed)
    depth_scale = float(np.mean(np.abs(true_spectrum)))
    return true_spectrum + rng.normal(0.0, depth_scale / snr, size=true_spectrum.shape)
