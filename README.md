# Exoplanet Atmospheric Spectrum Recovery

Recovers clean exoplanet transmission spectra from noisy telescope observations and
predicts the atmosphere's chemical composition and temperature.

Next.js frontend + FastAPI backend, both running locally.

## Setup

**Prerequisites:** Python 3.10+ and Node.js 18+.

### 1. Add the model and data files

These are **not in the repo** — they are too large for GitHub. Get them from the
project owner and put all four in the project root:

| File | What it is | Size |
| --- | --- | --- |
| `stage1_model.pt` | the trained CompositionNet weights | ~900 KB |
| `stage1_scalers.pkl` | the input/output scalers saved with it | ~3 KB |
| `test_array.npy` | 20 Ariel planets, the built-in observation catalogue | ~100 KB |
| `train.py` | *(in the repo)* the script that produced the model | — |

Without the first three the backend starts but returns an error on the first
request. `stage2_model.pickle` is **not** needed — nothing uses it.

### 2. Install the backend

```powershell
python -m venv backend_venv
.\backend_venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

On macOS or Linux, use `python3 -m venv backend_venv` and
`./backend_venv/bin/python -m pip install -r backend/requirements.txt`.

<details>
<summary>Already have torch, numpy, scipy, scikit-learn and pandas installed?</summary>

Reuse them instead of downloading multi-GB copies:

```powershell
python -m venv backend_venv --system-site-packages
.\backend_venv\Scripts\python.exe -m pip install fastapi uvicorn pydantic python-multipart
```
</details>

### 3. Install the frontend

```powershell
npm install
```

## Run it

Two terminals, from the project root:

```powershell
# 1) backend — http://localhost:8000
.\backend_venv\Scripts\python.exe backend\run.py
```

```powershell
# 2) frontend — http://localhost:3000
npm run dev
```

Open <http://localhost:3000>. The badge in the header turns to **Link nominal**
once it reaches the backend. If the backend is not running, every page falls back
to bundled demo data and says so in a banner.

Check <http://localhost:8000/api/health> to confirm both stages loaded, or
<http://localhost:8000/docs> for interactive API docs.

Stop either server with `Ctrl+C`. Auto-reload is off by default — restart the
backend after editing it. See [backend/run.py](backend/run.py) for why.

### If something goes wrong

| Symptom | Cause |
| --- | --- |
| Header says **Link offline** | The backend is not running, or not on port 8000 |
| Errors mentioning `stage1_model.pt` | The model files from step 1 are missing |
| Edits to the backend seem to do nothing | A stale server still holds port 8000 — check with `netstat -ano \| findstr :8000`, expect one PID |
| `.fits` upload rejected | Optional — needs `astropy`, see `backend/requirements.txt`. Use CSV instead |

## What each page does

| Page | What it does |
| --- | --- |
| `/` | 3D transit visualisation and project overview |
| `/upload` | Upload a CSV / FITS / NPY observation, or pick one of the 20 Ariel archive planets |
| `/inference` | Review the two pipeline stages, run them, watch live SSE progress |
| `/dashboard` | Spectrum chart with uncertainty band, molecular abundances, wavelength detail |
| `/results` | Table of every observation with recovery metrics, plus CSV / JSON / PDF export |

The observation you pick carries across pages (stored in `localStorage`, see
[lib/selection.ts](lib/selection.ts)).

## The pipeline

```
noisy observation (283 wavelength bins)
   ├─ STAGE 1  Spectrum Estimator   (statistical)      → spectrum + 1σ band
   ├─ ADAPTER  283 bins → 33 AIRS-CH0 bins
   └─ STAGE 2  CompositionNet       (machine learning) → radius, temperature,
                                                         H2O/CO2/CO/CH4/NH3
```

Stage 1 is a statistical estimator built from means and standard deviations — it
cuts spectrum RMSE from 339.7 to 69.9 ppm on the 20 planets with known spectra.
Stage 2 is the trained PyTorch network from `train.py`. Both always run.

Full details — including which model file is which — are in
**[backend/README.md](backend/README.md)**.

## Project layout

```
app/           Next.js routes
components/    UI, one folder per page + shared shadcn/ui components
lib/api.ts     API client — every backend call lives here
lib/demo-data.ts  Offline fallback data and shared types
backend/       FastAPI service (see backend/README.md)
data/          Auto-created local storage for uploads and results
```

## Configuration

The frontend points at `http://localhost:8000` by default. To change it, set
`NEXT_PUBLIC_API_URL` in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
