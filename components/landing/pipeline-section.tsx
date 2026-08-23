import { UploadCloud, Cpu, LineChart, FlaskConical } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STAGES = [
  {
    icon: UploadCloud,
    title: "Ingest",
    detail:
      "Upload raw transit photometry (CSV/FITS-style time series) or select a precomputed Ariel observation from the archive.",
  },
  {
    icon: Cpu,
    title: "Infer",
    detail:
      "Choose a denoising architecture and run inference — the model separates instrument noise from the underlying transmission spectrum.",
  },
  {
    icon: LineChart,
    title: "Visualize",
    detail:
      "Compare the noisy input against the recovered spectrum with uncertainty bands across the full wavelength range.",
  },
  {
    icon: FlaskConical,
    title: "Interpret",
    detail:
      "Cross-reference absorption features against known molecular signatures to estimate atmospheric composition.",
  },
]

export function PipelineSection() {
  return (
    <section className="border-b border-border/60 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-10 flex flex-col gap-3 md:max-w-2xl">
          <span className="font-mono text-[11px] tracking-[0.16em] text-primary uppercase">
            Pipeline
          </span>
          <h2 className="text-balance text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            From raw light curve to molecular fingerprint
          </h2>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Four stages take a noisy transit observation and turn it into a
            scientifically interpretable atmospheric spectrum.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage, index) => (
            <Card key={stage.title} className="border-border/60 bg-card/60">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-sm border border-primary/30 bg-primary/10 text-primary">
                    <stage.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <CardTitle className="text-base font-medium">{stage.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{stage.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
