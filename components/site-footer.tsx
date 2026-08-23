export function SiteFooter() {
  return (
    <footer className="border-border/60 border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
          ARIEL·SPEC RECOVERY SYSTEM — atmospheric spectrum reconstruction research console
        </p>
        <p className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
          Built for the ESA Ariel Mission data pipeline · Demo dataset
        </p>
      </div>
    </footer>
  )
}
