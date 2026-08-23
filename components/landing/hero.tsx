import Link from "next/link"
import { ArrowRight, Orbit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransitScene } from "@/components/landing/transit-scene"

export function Hero() {
  return (
    <section className="bg-grid-scan relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.78_0.135_205_/_10%),_transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <div className="mb-10 flex flex-col gap-6 md:mb-14 md:max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
            <Orbit className="size-3.5" strokeWidth={1.75} />
            ESA Ariel Mission · Data Pipeline
          </div>
          <h1 className="text-glow-primary text-balance font-sans text-4xl font-medium tracking-tight text-foreground md:text-6xl">
            Recovering exoplanet atmospheres from noisy transit light.
          </h1>
          <p className="text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            When a planet crosses in front of its star, its atmosphere imprints faint
            absorption features onto the starlight. This console reconstructs clean
            atmospheric spectra from raw, noise-dominated Ariel observations — turning
            a few parts-per-million dip into a molecular fingerprint.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button size="lg" render={<Link href="/upload" />}>
              Upload an observation
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/dashboard" />}>
              Explore demo dashboard
            </Button>
          </div>
        </div>

        <TransitScene />

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border/60 pt-6 font-mono text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <span className="text-foreground">01 · Transit</span>
            <p className="mt-1 leading-relaxed">
              The planet passes in front of the star along our line of sight, dimming
              it by a small, wavelength-dependent amount.
            </p>
          </div>
          <div>
            <span className="text-foreground">02 · Absorption</span>
            <p className="mt-1 leading-relaxed">
              Molecules in the atmosphere absorb specific wavelengths, carving faint
              dips into the transmitted starlight.
            </p>
          </div>
          <div>
            <span className="text-foreground">03 · Recovery</span>
            <p className="mt-1 leading-relaxed">
              A learned denoising model separates instrument noise from genuine
              molecular signal in the recorded spectrum.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
