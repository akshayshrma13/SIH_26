import type { Metadata } from "next"
import { UploadWorkspace } from "@/components/upload/upload-workspace"

export const metadata: Metadata = {
  title: "Upload Observation — Ariel·Spec",
  description:
    "Upload raw transit photometry (CSV/FITS-style time series) or select a precomputed Ariel archive observation for spectrum recovery.",
}

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:max-w-2xl">
        <span className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
          Step 01 · Ingest
        </span>
        <h1 className="text-balance text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Upload a transit observation
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Bring raw telescope photometry in CSV or FITS-style time series format, or
          select a precomputed observation from the Ariel archive to preview before
          running inference.
        </p>
      </div>

      <UploadWorkspace />
    </div>
  )
}
