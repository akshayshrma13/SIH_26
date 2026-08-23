# Frontend Plan for Exoplanet Spectrum Recovery System

This document outlines the instructions for v0 by Vercel to generate the frontend for our Exoplanet Atmospheric Spectrum Recovery system.

## Tech Stack
- Framework: Next.js (React)
- Deployment: Vercel
- 3D Visualization: React Three Fiber (Three.js)
- Charts: Plotly.js (or Recharts for rapid prototyping, but Plotly preferred for scientific data)
- Styling: Tailwind CSS (standard for v0)
- Theme: Dark cosmic/space aesthetics (deep blues, purples, glowing accents)

## Application Structure

The application will have the following main pages/sections:

### 1. Landing Page (Hero)
- **3D Interactive Transit Visualization**: This is the centerpiece. Use React Three Fiber to create a scene showing a star emitting light, a planet transiting in front of it, the planet's atmosphere absorbing specific wavelengths, and the filtered light traveling to a telescope. It should visually explain the transit method.
- **Project Overview**: Brief context about the ESA Ariel Mission and the goal of recovering accurate exoplanet atmospheric spectra from noisy telescope observations.

### 2. Data Upload Page
- Interface to upload telescope observation files (FITS/CSV formats).
- Preview area to see raw uploaded data before processing.
- Processing status tracker (progress bar or steps).

### 3. Dashboard & Visualization
- **Spectra Chart**: Interactive chart (using Plotly.js) showing 'Observed Spectrum' vs 'Recovered Spectrum' across different wavelengths.
- **Uncertainty Bands**: Include confidence intervals around the recovered spectrum line.
- **Chemical Composition**: Bar or pie charts breaking down the extracted molecular abundances (e.g., H2O, CO2, CH4).
- **Wavelength-wise detail view**.

### 4. Model Inference Page
- Controls to select different ML model architectures.
- Options to "Run Live Inference" or "Load Pre-computed Demo Results".
- Real-time progress indicators for live inference.

### 5. Results & Analysis Page
- Detailed tabular and graphical results per observation.
- Export functionality (e.g., download as CSV/JSON/PDF).

## v0 Prompting Instructions
When feeding this to v0:
1. Provide the entire structure above.
2. Emphasize a modern, scientific, premium space-themed aesthetic (dark mode by default, glassmorphism, glowing accents).
3. Specify that the 3D element must be interactive and smooth.
4. Mention that the backend will be running locally, so API calls should be configurable (e.g., pointing to `http://localhost:8000`).
