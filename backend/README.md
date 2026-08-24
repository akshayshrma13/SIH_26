# Backend — Exoplanet Atmospheric Spectrum Recovery

FastAPI service that runs the two-stage ML pipeline and serves the Next.js frontend.

## Run it

```powershell
# from the project root
.\backend_venv\Scripts\python.exe backend\run.py
```

Then open <http://localhost:8000/docs> for interactive API docs, or
<http://localhost:8000/api/health> for a quick check that both models loaded.

The frontend expects the backend at `http://localhost:8000` (see `lib/api.ts`),
so no extra configuration is needed. Start the frontend with `npm run dev`.

### The environment

```powershell
python -m venv backend_venv
.\backend_venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Everything is pinned in [requirements.txt](requirements.txt), verified on Python
3.12.2 (3.10+ required, for the `X | None` type syntax). Note that `numpy` is
held below 2.3 because `scipy` 1.14.1 needs it — bump both together.

If you already have `torch`, `numpy`, `scipy`, `scikit-learn` and `pandas`
installed system-wide, add `--system-site-packages` to the `venv` command and
install only `fastapi uvicorn pydantic python-multipart`, to avoid
re-downloading multi-GB copies.

### The model files

`stage1_model.pt`, `stage1_scalers.pkl` and `test_array.npy` live in the
**project root** and are committed via Git LFS. If you cloned without LFS
installed you will have text pointer files instead of real models, and the
backend will fail to load them — run `git lfs install && git lfs pull` to fix
it. Check with `git lfs ls-files`.

## The pipeline

```
noisy observation (283 wavelength bins)
   │
   ├─ STAGE 1  Spectrum Estimator (statistical)  app/ml/stage1.py
   │      noise estimate -> shrinkage -> smoothing, + 1σ band
   │
   ├─ ADAPTER  283 bins → 33 AIRS-CH0 bins    app/ml/wavelengths.py
   │      drops the FGS channel, averages 282 AIRS channels into 33
   │
   └─ STAGE 2  CompositionNet (machine learning) app/ml/stage2.py
          stage1_model.pt  (104 inputs → 14 outputs)
          → planet radius, temperature, log H2O/CO2/CO/CH4/NH3
            each with a Q1 / Q2 / Q3 uncertainty triplet
```

The **adapter** is the answer to the "two models, two datasets" mismatch: Stage 1
speaks the 283-point Ariel grid, Stage 2 was trained on the 33 bins of the 52-bin
grid that fall inside 1.95–3.89 µm.

### Which model file is which

| File on disk | Role | Status |
| --- | --- | --- |
| `stage1_model.pt` + `stage1_scalers.pkl` | **Stage 2** — CompositionNet from `train.py` | ✅ loads and runs |
| `test_array.npy` | 20 real Ariel planets, used as the observation catalogue | ✅ loads via `app/kaggle_shim.py` |
| `stage2_model.pickle` (1.4 GB) | the Kaggle spectrum-extraction model | ❌ **not used** |

### Stage 1 — Spectrum Estimator (statistical, not ML)

Deliberately not a machine learning model. Three steps, all built from means and
standard deviations (`app/ml/stage1.py`):

1. **Noise level.** A real spectrum varies smoothly with wavelength, so any sharp
   bin-to-bin jump is noise. The median absolute deviation of the second
   difference gives a robust σ that genuine absorption lines cannot inflate.
2. **Shrinkage.** Local mean and local variance over a window separate real
   structure from noise — `s² = max(local variance − σ², 0)` — and each bin is
   pulled toward its local mean by how much of its scatter is noise:
   `recovered = mean + [s²/(s²+σ²)] · (obs − mean)`. This is the standard
   empirical-Bayes / Wiener shrinkage estimator.
3. **Smoothing.** A Savitzky-Golay pass removes what noise is left while keeping
   the shape of the absorption features, which a moving average would flatten.

**The two bands are handled separately.** Bin 0 is the lone FGS1 photometric
channel at 0.70 µm; bins 1–282 are AIRS-CH0 (1.95–3.89 µm). Smoothing a single
point 1.25 µm from its "neighbours" is meaningless, so FGS passes through
untouched and keeps the full noise as its uncertainty. This also stops it
contaminating the first ~20 AIRS bins through the smoothing window — their mean
error drops from 102 to 75 ppm.

Measured on the 20 catalogue planets with known spectra:

| | RMSE |
| --- | --- |
| observed | 339.7 ppm |
| recovered | **69.9 ppm** — a 4.9× improvement |

Window sizes were tuned on those planets. The optimum is broad and flat (within
~1 ppm over a wide range), so modest values are used rather than the exact
argmin, which would just be fitting to 20 planets.

**The uncertainty band is empirically calibrated.** The raw estimator is
overconfident: its formal error bars describe only the noise it removed, not the
real structure the smoothing also flattens, so they claim 41 ppm when the true
error is 70 ppm. `UNCERTAINTY_CALIBRATION = 2.5` is fitted so that ~68% of bins
genuinely fall inside 1σ (measured: 67.1%). Re-fit it if the window sizes change.

### Stage 2 — CompositionNet (machine learning)

The PyTorch network from `train.py`: 104 → 512 → 256 → 128 → 14, loaded from
`stage1_model.pt` with `stage1_scalers.pkl`. Each of the seven quantities comes
out as a median plus a positive half-width, giving a Q1/Q2/Q3 posterior.

### A note on the observed spectra

`test_array.npy` was saved at `loading_step = 0`: each planet carries a clean
283-bin spectrum but every raw light-curve array (`times`, `data`, `noise_est`)
is `None`. There is no real noisy observation in the file, so
`add_instrument_noise()` injects seeded Ariel-like photon noise to create the
"observed" curve that Stage 1 then recovers. Seeded per planet, so a planet looks
the same across restarts.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/health` | Model + catalogue status |
| `GET` | `/api/models` | The two pipeline stages (both always run) |
| `GET` | `/api/observations` | 20 catalogue planets + everything uploaded |
| `POST` | `/api/upload` | Upload a CSV / FITS / NPY observation → observation id |
| `POST` | `/api/inference` | `{observationId}` → `{jobId}` |
| `GET` | `/api/status/{job_id}` | **SSE** stream of live progress |
| `GET` | `/api/jobs/{job_id}` | Same status, plain JSON (for polling) |
| `GET` | `/api/results/{id}` | Full result: spectrum, bands, composition, metrics |
| `GET` | `/api/results/{id}/export.csv` | Download the recovered spectrum |
| `GET` | `/api/chemical-composition/{id}` | Just the molecular abundances |
| `GET` | `/api/demo-results` | Pre-computed results for the first 3 planets |

Results are computed on first request and cached as JSON in `data/results/`.

### Response shapes

They match the types already in `lib/demo-data.ts`, so wiring the frontend is a
drop-in replacement of the mock generators:

```jsonc
// one entry of result.spectrum  (SpectrumPoint)
{ "wavelength": 2.9787, "observed": 18829.1, "recovered": 18425.82,
  "lower": 18254.08, "upper": 18597.56, "sigma": 171.74, "truth": 18164.95 }

// one entry of result.composition  (ChemicalAbundance)
{ "molecule": "Water", "formula": "H2O", "abundance": -7.34,
  "lower": -8.56, "upper": -6.11, "confidence": 0.45 }
```

`truth` is only present for catalogue planets, where the clean spectrum is known.
Depths are in ppm; abundances are log10 mixing ratios.

### SSE example

```js
const { jobId } = await fetch(API_ROUTES.inference, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ observationId }),
}).then((r) => r.json())

const stream = new EventSource(API_ROUTES.status(jobId))
stream.onmessage = (event) => {
  const job = JSON.parse(event.data) // { status, progress, message }
  setProgress(job.progress)
  if (job.status === "complete" || job.status === "failed") stream.close()
}
```

## Local storage layout

Created automatically on startup:

```
data/
  uploads/   <id>.csv + <id>.json   uploaded files and their metadata
  results/   <id>.json              finished pipeline results
  models/                           spare slot for future model files
```

## File map

| File | Purpose |
| --- | --- |
| `run.py` | Starts uvicorn on port 8000 |
| `app/main.py` | FastAPI app, CORS, startup folder creation |
| `app/config.py` | All paths, constants and model definitions |
| `app/routes.py` | Every endpoint |
| `app/catalogue.py` | Reads the 20 planets out of `test_array.npy` |
| `app/kaggle_shim.py` | Fake modules that let that file unpickle |
| `app/parsing.py` | CSV / FITS / NPY upload parsing |
| `app/storage.py` | JSON file storage |
| `app/jobs.py` | In-memory job registry for SSE |
| `app/ml/stage1.py` | Spectrum Estimator — the statistical Stage 1 |
| `app/ml/stage2.py` | CompositionNet — the PyTorch Stage 2 |
| `app/ml/wavelengths.py` | The 283 → 33 dimension adapter |
| `app/ml/pipeline.py` | Runs both stages and builds the response |
