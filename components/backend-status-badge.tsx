"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { pingBackend, API_BASE_URL } from "@/lib/api"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function BackendStatusBadge() {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let mounted = true

    async function check() {
      const result = await pingBackend(controller.signal)
      if (mounted) setOnline(result)
    }

    check()
    const interval = setInterval(check, 15000)

    return () => {
      mounted = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  const state = online === null ? "connecting" : online ? "online" : "offline"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-secondary/40 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.1em] uppercase">
            <span
              className={cn(
                "size-1.5 rounded-full",
                state === "online" && "bg-primary shadow-[0_0_8px_2px_var(--color-primary)]",
                state === "offline" && "bg-destructive",
                state === "connecting" && "animate-pulse bg-muted-foreground",
              )}
            />
            <span className="text-muted-foreground">
              {state === "online" && "Link nominal"}
              {state === "offline" && "Link offline"}
              {state === "connecting" && "Linking"}
            </span>
          </div>
        }
      />
      <TooltipContent className="font-mono text-xs">
        API target: {API_BASE_URL}
        <br />
        {state === "offline"
          ? "Backend unreachable — showing bundled demo data."
          : "Connected to local inference backend."}
      </TooltipContent>
    </Tooltip>
  )
}
