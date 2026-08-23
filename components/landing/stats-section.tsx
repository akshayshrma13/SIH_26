import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const STATS = [
  { value: "0.6–7.8µm", label: "Wavelength coverage modeled" },
  { value: "3", label: "Denoising architectures available" },
  { value: "±30ppm", label: "Typical recovered uncertainty" },
  { value: "<15s", label: "Inference time per observation" },
]

export function StatsSection() {
  return (
    <section className="border-b border-border/60 bg-secondary/20 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-2 gap-6 border-b border-border/60 pb-12 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <span className="font-mono text-2xl font-medium text-primary md:text-3xl">
                {stat.value}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground md:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-6 pt-10 md:flex-row md:items-center">
          <div className="flex flex-col gap-2 md:max-w-xl">
            <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground md:text-3xl">
              Ready to recover a spectrum?
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Bring your own transit observation, or start from a precomputed Ariel
              archive entry — the full pipeline runs in your browser session.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/upload">
              Start an observation
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
