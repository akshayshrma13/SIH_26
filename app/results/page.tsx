import type { Metadata } from "next"
import { ResultsWorkspace } from "@/components/results/results-workspace"

export const metadata: Metadata = {
  title: "Results & Analysis — Ariel·Spec",
  description:
    "Detailed tabular and graphical results per observation with CSV, JSON, and PDF export.",
}

export default function ResultsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:max-w-2xl">
        <span className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
          Step 04 · Export
        </span>
        <h1 className="text-balance text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Results &amp; analysis
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Review recovered spectra per observation in tabular form, then export
          results as CSV, JSON, or a PDF report for downstream analysis.
        </p>
      </div>

      <ResultsWorkspace />
    </div>
  )
}
