import { Hero } from "@/components/landing/hero"
import { PipelineSection } from "@/components/landing/pipeline-section"
import { StatsSection } from "@/components/landing/stats-section"

export default function Home() {
  return (
    <>
      <Hero />
      <PipelineSection />
      <StatsSection />
    </>
  )
}
