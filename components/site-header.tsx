"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Radio, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { BackendStatusBadge } from "@/components/backend-status-badge"

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/upload", label: "Upload" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inference", label: "Inference" },
  { href: "/results", label: "Results" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-border/60 sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-sm border border-primary/40 bg-primary/10">
            <Radio className="size-4 text-primary" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-mono text-[13px] font-medium tracking-[0.14em] text-foreground">
              ARIEL·SPEC
            </span>
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
              RECOVERY SYSTEM
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-sm px-3.5 py-2 font-mono text-xs tracking-[0.08em] uppercase transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <BackendStatusBadge />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu />
              <span className="sr-only">Open navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-mono text-sm tracking-[0.1em]">
                ARIEL·SPEC NAV
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-sm px-3 py-2.5 font-mono text-xs tracking-[0.08em] uppercase transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="mt-2 px-3">
                <BackendStatusBadge />
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
