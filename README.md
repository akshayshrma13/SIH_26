# Exoplanet Atmospheric Spectrum Recovery

Recovers clean exoplanet transmission spectra from noisy telescope observations and
predicts the atmosphere's chemical composition and temperature.

Next.js frontend + FastAPI backend, both running locally.

## Run it

Two terminals, from the project root:

```powershell
# 1) backend — http://localhost:8000
.\backend_venv\Scripts\python.exe backend\run.py
```

```powershell
# 2) frontend — http://localhost:3000
npm install     # first time only
npm run dev
```

Open <http://localhost:3000>. The badge in the header turns to **Link nominal**
once it reaches the backend. If the backend is not running, every page falls back
to bundled demo data and says so in a banner.

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
