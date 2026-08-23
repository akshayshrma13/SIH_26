import type { SpectrumPoint } from "@/lib/demo-data"

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-secondary/20 px-3 py-2.5">
      <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-lg text-foreground">
        {value}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </span>
    </div>
  )
}

export function WavelengthDetail({ point }: { point: SpectrumPoint }) {
  const residual = point.observed - point.recovered
  const bandWidth = point.upper - point.lower

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Wavelength" value={point.wavelength.toFixed(3)} unit="µm" />
        <Metric label="Recovered depth" value={point.recovered.toFixed(0)} unit="ppm" />
        <Metric label="Observed depth" value={point.observed.toFixed(0)} unit="ppm" />
        <Metric label="Residual" value={residual >= 0 ? `+${residual.toFixed(0)}` : residual.toFixed(0)} unit="ppm" />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">1σ uncertainty range</span>
          <span className="font-mono text-foreground">±{(bandWidth / 2).toFixed(0)} ppm</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/40">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${Math.min(100, (bandWidth / 120) * 100)}%` }}
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Recovered depth is the model&apos;s denoised estimate of atmospheric absorption at this
        channel. The residual reflects instrumental and photon noise removed during
        reconstruction.
      </p>
    </div>
  )
}
