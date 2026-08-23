// Bundled demo/fallback data so the dashboard, inference, and results pages
// remain fully explorable even when the local FastAPI backend
// (see BACKEND_PLAN.md) is not running. Shapes mirror the documented
// /api/demo-results and /api/chemical-composition responses.

export type SpectrumPoint = {
  wavelength: number // microns
  observed: number // transit depth, ppm
  recovered: number
  lower: number
  upper: number
}

export type ChemicalAbundance = {
  molecule: string
  formula: string
  abundance: number // log10 mixing ratio, arbitrary demo scale
  confidence: number // 0-1
}

export type Observation = {
  id: string
  name: string
  target: string
  instrument: string
  source: "uploaded" | "precomputed"
  status: "queued" | "processing" | "complete" | "failed"
  createdAt: string
}

export type ModelArchitecture = {
  id: string
  name: string
  description: string
  latency: string
  accuracy: string
}

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

export function generateSpectrum(seed = 7): SpectrumPoint[] {
  const rand = seededRandom(seed)
  const points: SpectrumPoint[] = []
  const featureCenters = [1.4, 1.9, 2.7, 3.3, 4.3]
  for (let i = 0; i < 120; i++) {
    const wavelength = 0.6 + (i / 119) * 4.4
    let depth = 2400

    for (const center of featureCenters) {
      const distance = Math.abs(wavelength - center)
      depth += 340 * Math.exp(-(distance * distance) / 0.02)
    }

    const noise = (rand() - 0.5) * 160
    const observed = depth + noise
    const recovered = depth + (rand() - 0.5) * 30
    const band = 45 + (rand() - 0.5) * 10

    points.push({
      wavelength: Number(wavelength.toFixed(3)),
      observed: Number(observed.toFixed(1)),
      recovered: Number(recovered.toFixed(1)),
      lower: Number((recovered - band).toFixed(1)),
      upper: Number((recovered + band).toFixed(1)),
    })
  }
  return points
}

export const demoChemicalComposition: ChemicalAbundance[] = [
  { molecule: "Water", formula: "H2O", abundance: -3.2, confidence: 0.94 },
  { molecule: "Carbon Dioxide", formula: "CO2", abundance: -4.1, confidence: 0.87 },
  { molecule: "Methane", formula: "CH4", abundance: -5.6, confidence: 0.61 },
  { molecule: "Carbon Monoxide", formula: "CO", abundance: -3.8, confidence: 0.72 },
  { molecule: "Ammonia", formula: "NH3", abundance: -6.4, confidence: 0.38 },
]

export const demoObservations: Observation[] = [
  {
    id: "obs-ariel-0231",
    name: "WASP-96 b — Transit 14",
    target: "WASP-96 b",
    instrument: "Ariel AIRS-CH1",
    source: "precomputed",
    status: "complete",
    createdAt: "2026-08-12T09:14:00Z",
  },
  {
    id: "obs-ariel-0198",
    name: "HD 209458 b — Transit 07",
    target: "HD 209458 b",
    instrument: "Ariel AIRS-CH0",
    source: "precomputed",
    status: "complete",
    createdAt: "2026-08-09T22:41:00Z",
  },
  {
    id: "obs-ariel-0304",
    name: "K2-18 b — Transit 03",
    target: "K2-18 b",
    instrument: "Ariel FGS",
    source: "precomputed",
    status: "complete",
    createdAt: "2026-08-15T04:02:00Z",
  },
]

export const modelArchitectures: ModelArchitecture[] = [
  {
    id: "spectra-net-v3",
    name: "SpectraNet v3",
    description: "Residual CNN denoiser tuned for Ariel AIRS channel noise profiles.",
    latency: "~4.2s / observation",
    accuracy: "RMSE 0.031",
  },
  {
    id: "deep-transit-transformer",
    name: "Deep Transit Transformer",
    description: "Attention-based sequence model capturing long-range wavelength correlations.",
    latency: "~9.8s / observation",
    accuracy: "RMSE 0.024",
  },
  {
    id: "bayes-atmos-vae",
    name: "Bayes-Atmos VAE",
    description: "Variational encoder producing full posterior uncertainty bands.",
    latency: "~14.1s / observation",
    accuracy: "RMSE 0.027",
  },
]
