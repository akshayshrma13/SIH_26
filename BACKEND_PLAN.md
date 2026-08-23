# Backend Plan for Exoplanet Spectrum Recovery System

This document provides instructions for Claude to build the backend services that support the frontend application.

## Tech Stack
- Framework: FastAPI (Python, async, modern)
- ML Serving: PyTorch / direct loading of models
- Database/Storage: Local file-based storage (auto-created directory structure)
- Real-time updates: Server-Sent Events (SSE)

## Architecture Overview
The backend will serve as a REST API consumed by the Next.js frontend. It will handle file uploads, trigger ML inference, serve pre-computed results for demo purposes, and provide real-time status updates via SSE.

## Core Requirements

### 1. Local Storage System
- On startup, the backend should automatically create a local folder structure (e.g., `./data/uploads`, `./data/results`, `./data/models`) to store data without needing a separate database service like PostgreSQL.
- Metadata for observations and results should be stored in simple JSON files within these directories.

### 2. API Endpoints

- `POST /api/upload`: 
  - Accepts observation files (FITS/CSV).
  - Saves them to the local storage.
  - Returns a unique observation ID.

- `POST /api/inference`:
  - Accepts an observation ID and selected model architecture.
  - Triggers the ML pipeline to process the data.
  - Returns a job ID to track progress.

- `GET /api/observations`:
  - Lists all available observations (uploaded and pre-computed).

- `GET /api/results/{id}`:
  - Fetches the detailed results, spectra data (observed vs recovered), uncertainty estimates, and chemical composition for a specific observation.

- `GET /api/demo-results`:
  - Returns pre-computed demo data specifically formatted for the frontend showcase, allowing users to explore the dashboard without running live inference.

- `GET /api/status/{job_id}`:
  - An SSE (Server-Sent Events) endpoint that streams the real-time processing progress of a running inference job to the frontend.

- `GET /api/chemical-composition/{id}`:
  - Returns the extracted molecular abundances for a specific result.

### 3. ML Integration Hooks
- The backend needs clear, documented placeholder functions or hooks where the actual PyTorch models will be integrated. 
- Example: `def run_spectral_denoising(data_path, model_type): ...` which currently returns mock data but is ready for the real model files to be dropped in.

## Instructions for Claude
When asking Claude to generate this:
1. Request it to structure the FastAPI app cleanly (e.g., separate files for routers, models, services).
2. Ensure it includes CORS middleware configured to allow requests from the deployed Vercel frontend.
3. Ask it to generate the code that creates the local database folder structure automatically on startup.
4. Ensure the SSE endpoint is properly implemented for asynchronous progress streaming.
