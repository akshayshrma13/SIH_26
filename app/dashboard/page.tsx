import type { Metadata } from "next"
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace"

export const metadata: Metadata = {
  title: "Dashboard — Ariel·Spec",
  description:
    "Compare observed vs recovered atmospheric spectra with uncertainty bands, molecular abundance breakdown, and wavelength-level detail.",
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:max-w-2xl">
        <span className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
          Step 02 · Analyze
        </span>
        <h1 className="text-balance text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Spectrum recovery dashboard
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Inspect the recovered transmission spectrum against the raw observation,
          review molecular abundance confidence, and drill into individual
          wavelength channels.
        </p>
      </div>

      <DashboardWorkspace />
    </div>
  )
}
