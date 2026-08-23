import type { Metadata } from "next"
import { InferenceWorkspace } from "@/components/inference/inference-workspace"

export const metadata: Metadata = {
  title: "Model Inference — Ariel·Spec",
  description:
    "Select a model architecture and run live spectrum-recovery inference, or load precomputed demo results.",
}

export default function InferencePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:max-w-2xl">
        <span className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
          Step 03 · Infer
        </span>
        <h1 className="text-balance text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Run spectrum recovery
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Choose a model architecture and run live inference against your
          observation, or load precomputed demo results to explore the results
          workspace immediately.
        </p>
      </div>

      <InferenceWorkspace />
    </div>
  )
}
