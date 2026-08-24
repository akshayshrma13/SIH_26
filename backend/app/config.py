"""
All the settings, paths and constants for the backend live here.

Keeping them in one small file means you only ever have to look in one place
when something needs to be re-pointed at a different folder or model file.
"""

from pathlib import Path

# ─── Folders ──────────────────────────────────────────────────────────────────
# backend/app/config.py  ->  backend/app  ->  backend  ->  project root
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# Local "database": plain folders + JSON files, no PostgreSQL needed.
DATA_DIR = PROJECT_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
RESULTS_DIR = DATA_DIR / "results"
MODELS_DIR = DATA_DIR / "models"

ALL_DIRS = [DATA_DIR, UPLOAD_DIR, RESULTS_DIR, MODELS_DIR]


def create_folders() -> None:
    """Called once on startup so the app never crashes on a missing folder."""
    for folder in ALL_DIRS:
        folder.mkdir(parents=True, exist_ok=True)


# ─── Model / data files that the user dropped in the project root ─────────────
# NOTE: the file names are the ones that exist on disk. Despite being called
# "stage1_model.pt", this file is the *composition* network (104 inputs -> 14
# outputs) that `train.py` trains, i.e. our Stage 2. See ml/stage2.py.
STAGE2_MODEL_PATH = PROJECT_ROOT / "stage1_model.pt"
STAGE2_SCALERS_PATH = PROJECT_ROOT / "stage1_scalers.pkl"

# NOTE: `stage2_model.pickle` (the 1.4 GB Kaggle spectrum-extraction model) is
# deliberately NOT used. Stage 1 is a statistical estimator instead - see
# ml/stage1.py.

# 20 real Ariel planets used as the built-in observation catalogue.
TEST_ARRAY_PATH = PROJECT_ROOT / "test_array.npy"


# ─── Science constants ────────────────────────────────────────────────────────
SOLAR_MASS_KG = 1.98847e30
SOLAR_RADIUS_M = 6.957e8
JUPITER_MASS_KG = 1.898e27

# The seven values the Stage 2 network predicts, in the exact order the network
# outputs them (same order as PARAM_COLS in train.py).
TARGET_NAMES = [
    "planet_radius",
    "planet_temp",
    "log_H2O",
    "log_CO2",
    "log_CO",
    "log_CH4",
    "log_NH3",
]

# Pretty names for the five molecules, used by /api/chemical-composition.
MOLECULES = [
    {"key": "log_H2O", "molecule": "Water", "formula": "H2O"},
    {"key": "log_CO2", "molecule": "Carbon Dioxide", "formula": "CO2"},
    {"key": "log_CO", "molecule": "Carbon Monoxide", "formula": "CO"},
    {"key": "log_CH4", "molecule": "Methane", "formula": "CH4"},
    {"key": "log_NH3", "molecule": "Ammonia", "formula": "NH3"},
]

# The two stages of the pipeline, shown on the Inference page. These are not
# alternatives to choose between - both always run, in this order.
PIPELINE_STAGES = [
    {
        "id": "spectrum-estimator",
        "stage": 1,
        "name": "Spectrum Estimator",
        "type": "statistical",
        "typeLabel": "Statistical estimator",
        "description": (
            "Recovers the transmission spectrum from a noisy observation using "
            "per-bin means and standard deviations: local variance separates real "
            "signal from noise, and each bin is shrunk toward its local mean in "
            "proportion to how much of its scatter is noise."
        ),
        "output": "283 wavelength bins + 1σ uncertainty",
        "accuracy": "RMSE 339.7 → 69.9 ppm on the 20 catalogue planets",
    },
    {
        "id": "composition-net",
        "stage": 2,
        "name": "CompositionNet",
        "type": "machine-learning",
        "typeLabel": "Machine learning model",
        "description": (
            "PyTorch network (104 → 512 → 256 → 128 → 14) trained on the Ariel "
            "data challenge. Predicts seven quantities as a median plus a "
            "positive half-width, giving a Q1/Q2/Q3 posterior for each."
        ),
        "output": "Radius, temperature, log H2O/CO2/CO/CH4/NH3",
        "accuracy": "stage1_model.pt",
    },
]

# Frontend origins allowed to talk to this backend.
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
]
# Vercel preview/production deployments (regex, applied on top of the list).
CORS_ORIGIN_REGEX = r"https://.*\.vercel\.app"
