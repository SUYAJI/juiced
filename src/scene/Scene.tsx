import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Handheld } from '../handheld/Handheld'
import { HandheldContext, type HandheldContextValue } from '../handheld/context'
import { Lunchbox } from '../lunchbox/Lunchbox'
import type { SceneAnim } from '../experience/anim'
import { DeviceCarrier } from '../experience/DeviceCarrier'
import { Director } from '../experience/Director'
import type { ExperienceStore } from '../experience/store'
import { FOV } from '../experience/views'

interface Props {
  value: HandheldContextValue
  exp: ExperienceStore
  anim: SceneAnim
  flipped: boolean
  onOpen: () => void
  onClose: () => void
  onPick: () => void
  /** Called once, after the lunchbox has loaded and drawn a couple of frames. */
  onReady: () => void
}

/**
 * One continuous scene: the lunchbox on a neutral surface, and the
 * handheld, which is carried out of the tray into the play position.
 */
export function Scene({ value, exp, anim, flipped, onOpen, onClose, onPick, onReady }: Props) {
  const mobile = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600
  return (
    <Canvas
      className="stage"
      dpr={[1, 2]}
      shadows="percentage"
      camera={{ fov: FOV, position: [30, 30, 60], near: 1, far: 600 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <HandheldContext.Provider value={value}>
        <Lights mobile={mobile} />

        {/* Studio reflections built in-scene (no network HDRs) */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[-5, 6, 8]} scale={[10, 4, 1]} color="#fff3e2" />
          <Lightformer form="rect" intensity={0.9} position={[6, 0, 6]} scale={[4, 12, 1]} color="#dfe6ff" />
          <Lightformer form="ring" intensity={0.8} position={[0, -8, 4]} scale={6} color="#ffd9f0" />
          <Lightformer form="rect" intensity={1.0} position={[0, 4, -10]} scale={[12, 6, 1]} color="#ffffff" />
        </Environment>

        <Surface />

        <Suspense fallback={null}>
          <Lunchbox
            anim={anim}
            onBoxClick={(part) => {
              if (exp.state === 'lunchboxClosed') onOpen()
              else if (exp.state === 'lunchboxOpen' && part === 'lid') onClose()
            }}
            onHover={(over) => {
              anim.hoverBoxTarget = over ? 1 : 0
              const s = exp.state
              document.body.style.cursor = over && (s === 'lunchboxClosed' || s === 'lunchboxOpen') ? 'pointer' : 'auto'
            }}
          />
          <ReadySignal onReady={onReady} />
        </Suspense>

        <DeviceCarrier exp={exp} anim={anim} onPick={onPick}>
          <Rig flipped={flipped} exp={exp} anim={anim}>
            <Handheld />
          </Rig>
        </DeviceCarrier>

        <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.5} />
        <Director exp={exp} anim={anim} />
        <ProjectHelper />
      </HandheldContext.Provider>
    </Canvas>
  )
}

/**
 * Mounts only once the lunchbox's Suspense boundary has resolved. Waits two
 * rendered frames (the first one compiles shaders) before reporting ready.
 */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current > 2) return
    frames.current += 1
    if (frames.current === 2) onReady()
  })
  return null
}

function Lights({ mobile }: { mobile: boolean }) {
  const key = useRef<THREE.DirectionalLight>(null)
  const { scene } = useThree()
  useEffect(() => {
    const l = key.current
    if (!l) return
    l.target.position.set(0, 4, 0)
    scene.add(l.target)
    return () => {
      scene.remove(l.target)
    }
  }, [scene])
  const size = mobile ? 1024 : 2048
  return (
    <>
      <hemisphereLight args={['#fff4e6', '#3b3236', 0.55]} />
      <directionalLight
        ref={key}
        position={[-26, 46, 34]}
        intensity={1.9}
        color="#fff1df"
        castShadow
        shadow-mapSize-width={size}
        shadow-mapSize-height={size}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={10}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={5}
      />
      <directionalLight position={[28, 14, 18]} intensity={0.6} color="#d6defc" />
      <directionalLight position={[0, 24, -40]} intensity={0.6} color="#ffffff" />
    </>
  )
}

/** A plain matte surface that fades out into the page background. */
function Surface() {
  const alpha = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.45, '#ffffff')
    g.addColorStop(1, '#000000')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  useEffect(() => () => alpha.dispose(), [alpha])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, -4]} receiveShadow raycast={() => null}>
      <circleGeometry args={[95, 72]} />
      <meshStandardMaterial color="#8a8078" roughness={0.95} alphaMap={alpha} transparent depthWrite={false} />
    </mesh>
  )
}

/**
 * Turns the device to show front or back while in hand, with a gentle idle
 * sway. In the lunchbox it lies still and always shows its front.
 */
function Rig({ flipped, exp, anim, children }: { flipped: boolean; exp: ExperienceStore; anim: SceneAnim; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    const grp = g.current
    if (!grp) return
    const active = exp.state === 'handheldActive'
    const target = flipped && active ? Math.PI : 0
    grp.rotation.y += (target - grp.rotation.y) * (1 - Math.exp(-6 * Math.min(dt, 0.25)))
    const t = clock.elapsedTime
    const sway = active ? anim.idle : 0
    grp.rotation.x = Math.sin(t * 0.5) * 0.012 * sway
    grp.rotation.z = Math.sin(t * 0.37) * 0.008 * sway
  })
  return (
    <group ref={g} name="device-rig">
      {children}
    </group>
  )
}

/**
 * Test/host helper: window.JUICED.project(x, y, z) maps a point on the
 * device (in its own centimetre coordinates) to CSS pixels on the page,
 * including the current carry, orbit and flip. projectWorld does the same
 * for world points (the lunchbox).
 */
function ProjectHelper() {
  const { camera, size, scene } = useThree()
  useFrame(() => {
    const j = window.JUICED
    if (!j) return
    const toScreen = (v: THREE.Vector3) => {
      v.project(camera)
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height }
    }
    j.project = (x: number, y: number, z: number) => {
      const rig = scene.getObjectByName('device-rig')
      const v = new THREE.Vector3(x, y, z)
      if (rig) v.applyMatrix4(rig.matrixWorld)
      return toScreen(v)
    }
    j.projectWorld = (x: number, y: number, z: number) => toScreen(new THREE.Vector3(x, y, z))
  })
  return null
}
