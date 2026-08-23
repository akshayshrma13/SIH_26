import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Ariel·Spec — Exoplanet Atmospheric Spectrum Recovery",
  description:
    "A research console for recovering exoplanet atmospheric spectra from noisy ESA Ariel Mission transit observations using deep learning.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#0b0e17",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("dark bg-background antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-svh">
        <ThemeProvider>
          <TooltipProvider>
            <div className="flex min-h-svh flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
