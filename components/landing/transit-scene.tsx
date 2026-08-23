"use client"

import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Line, OrbitControls, Stars } from "@react-three/drei"
import * as THREE from "three"
import { LightCurvePanel, type TransitPhase } from "@/components/landing/light-curve-panel"

const STAR_RADIUS = 1.35
const PLANET_RADIUS = 0.34
const ORBIT_AMPLITUDE = 2.55
const ORBIT_SPEED = 0.34
const TELESCOPE_X = 4.6

const WAVELENGTH_BANDS = [
  { color: "#7c3aed", offset: -0.16, label: "0.6µm" },
  { color: "#5fd3e6", offset: -0.08, label: "1.4µm" },
  { color: "#7ce6c0", offset: 0, label: "1.9µm" },
  { color: "#e0c34d", offset: 0.08, label: "2.7µm" },
  { color: "#e0824d", offset: 0.16, label: "4.3µm" },
]

function StarCore() {
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.6) * 0.02
      glowRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group position={[-3.1, 0, 0]}>
      <pointLight color="#ffe3ad" intensity={38} distance={18} decay={2} />
      <mesh>
        <sphereGeometry args={[STAR_RADIUS, 48, 48]} />
        <meshStandardMaterial
          color="#ffb347"
          emissive="#ffcf82"
          emissiveIntensity={2.1}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[STAR_RADIUS * 1.28, 32, 32]} />
        <meshBasicMaterial
          color="#ffd79b"
          transparent
          opacity={0.16}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function Telescope() {
  return (
    <group position={[TELESCOPE_X, -0.15, 0]} rotation={[0, 0, Math.PI * 0.02]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 1.1, 16]} />
        <meshStandardMaterial color="#1c2333" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[-0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.26, 0.32, 16]} />
        <meshStandardMaterial color="#2a3347" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.8, 0, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color="#5fd3e6"
          emissive="#5fd3e6"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.35, 0.4, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#0f1420" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

function TransitingPlanet({ phase }: { phase: React.MutableRefObject<TransitPhase> }) {
  const planetRef = useRef<THREE.Group>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)

  const orbitPoints = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2
      // Keep the orbit circular in 3D so the planet maintains a safe,
      // constant distance from the star instead of cutting through it.
      pts.push([Math.cos(t) * ORBIT_AMPLITUDE - 3.1, 0, Math.sin(t) * ORBIT_AMPLITUDE])
    }
    return pts
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * ORBIT_SPEED
    // Match the circular 3D orbit used by the guide line. This keeps the
    // planet's center exactly ORBIT_AMPLITUDE units from the star.
    const x = Math.cos(t) * ORBIT_AMPLITUDE - 3.1
    const y = 0
    const z = Math.sin(t) * ORBIT_AMPLITUDE

    if (planetRef.current) {
      planetRef.current.position.set(x, y, z)
      planetRef.current.rotation.y += 0.006
    }

    // In-transit when the planet's projected position crosses the star's disk
    // (small x offset from the star center, and in front on the z-axis).
    const distFromStarCenterX = Math.abs(x - -3.1)
    const inTransit = distFromStarCenterX < STAR_RADIUS * 0.92 && z < 0.15

    if (atmosphereRef.current) {
      const material = atmosphereRef.current.material as THREE.MeshBasicMaterial
      material.opacity = inTransit ? 0.55 : 0.22
    }

    phase.current.x = x
    phase.current.inTransit = inTransit
    phase.current.depth = inTransit
      ? 1 - distFromStarCenterX / (STAR_RADIUS * 0.92)
      : 0
  })

  return (
    <>
      <Line points={orbitPoints} color="#2a3347" lineWidth={1} transparent opacity={0.5} dashed dashSize={0.08} gapSize={0.06} />
      <group ref={planetRef}>
        <mesh>
          <sphereGeometry args={[PLANET_RADIUS, 32, 32]} />
          <meshStandardMaterial color="#1b2130" roughness={0.85} metalness={0.1} />
        </mesh>
        <mesh ref={atmosphereRef}>
          <sphereGeometry args={[PLANET_RADIUS * 1.35, 32, 32]} />
          <meshBasicMaterial color="#5fd3e6" transparent opacity={0.22} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

function LightRays({ phase }: { phase: React.MutableRefObject<TransitPhase> }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime

    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh
      const material = mesh.material as THREE.MeshBasicMaterial
      const band = WAVELENGTH_BANDS[index]
      if (!band) return

      const flicker = 0.9 + Math.sin(t * 3 + index) * 0.05
      let intensity = flicker

      if (phase.current.inTransit) {
        // Each wavelength band dips by a slightly different amount to
        // suggest molecular absorption features in the atmosphere.
        const dip = phase.current.depth * (0.35 + Math.abs(band.offset) * 1.4)
        intensity *= 1 - dip
      }

      material.opacity = 0.55 * intensity
    })
  })

  return (
    <group ref={groupRef}>
      {WAVELENGTH_BANDS.map((band) => (
        <mesh
          key={band.label}
          position={[0.75, band.offset, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <planeGeometry args={[7.7, 0.028]} />
          <meshBasicMaterial color={band.color} transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function Scene({ phase }: { phase: React.MutableRefObject<TransitPhase> }) {
  return (
    <>
      <ambientLight intensity={0.12} />
      <Stars radius={90} depth={50} count={3500} factor={2.4} fade speed={0.4} />
      <StarCore />
      <TransitingPlanet phase={phase} />
      <LightRays phase={phase} />
      <Telescope />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={5}
        maxDistance={13}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 1.7}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </>
  )
}

export function TransitScene() {
  const phase = useRef<TransitPhase>({ x: 0, inTransit: false, depth: 0 })

  return (
    <div className="relative h-[62vh] min-h-[460px] w-full overflow-hidden rounded-md border border-border/60 bg-black">
      <Canvas
        camera={{ position: [0, 1.6, 8.5], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#05070c"]} />
        <fog attach="fog" args={["#05070c", 9, 20]} />
        <Suspense fallback={null}>
          <Scene phase={phase} />
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 md:p-6">
        <span className="rounded-sm border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase backdrop-blur">
          Transit method · live diagram
        </span>
        <span className="rounded-sm border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase backdrop-blur">
          Drag to orbit · scroll to zoom
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 md:p-6">
        <LightCurvePanel phase={phase} />
      </div>
    </div>
  )
}
