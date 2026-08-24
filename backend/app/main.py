"""
The FastAPI application.

Start it with:   python backend/run.py
Then open:       http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGIN_REGEX, CORS_ORIGINS, create_folders
from .routes import router

app = FastAPI(
    title="Exoplanet Atmospheric Spectrum Recovery API",
    description=(
        "Two-stage pipeline: Stage 1 recovers a clean transmission spectrum "
        "from a noisy observation, Stage 2 predicts atmospheric composition "
        "and temperature from that spectrum."
    ),
    version="1.0.0",
)

# Let the Next.js frontend (local dev or a Vercel deployment) call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
def on_startup() -> None:
    """Create the local ./data folders before the first request arrives."""
    create_folders()


@app.get("/")
def index():
    return {
        "name": "Exoplanet Atmospheric Spectrum Recovery API",
        "docs": "/docs",
        "health": "/api/health",
    }
