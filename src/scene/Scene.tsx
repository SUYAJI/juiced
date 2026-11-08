import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Handheld } from '../handheld/Handheld'
import { HandheldContext, type HandheldContextValue } from '../handheld/context'

interface Props {
  value: HandheldContextValue
  flipped: boolean
}

/**
 * Fixed, front-facing composition. OrbitControls is kept on a short leash
 * (a little turn and tilt, a little zoom, no pan). "Flip" turns the device
 * itself around to show the back.
 */
export function Scene({ value, flipped }: Props) {
  return (
    <Canvas
      className="stage"
      dpr={[1, 2]}
      camera={{ fov: 28, position: [0, 4.6, 33.7], near: 1, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <HandheldContext.Provider value={value}>
        <FitCamera />
        <ProjectHelper />
        <ambientLight intensity={0.25} />
        <directionalLight position={[-6, 10, 14]} intensity={1.6} color="#fff4e6" />
        <directionalLight position={[8, -4, 6]} intensity={0.35} color="#c9d4ff" />
        <directionalLight position={[0, 6, -12]} intensity={0.6} color="#ffffff" />

        {/* Studio reflections built in-scene (no network HDRs) */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[-5, 6, 8]} scale={[10, 4, 1]} color="#fff3e2" />
          <Lightformer form="rect" intensity={0.9} position={[6, 0, 6]} scale={[4, 12, 1]} color="#dfe6ff" />
          <Lightformer form="ring" intensity={0.8} position={[0, -8, 4]} scale={6} color="#ffd9f0" />
          <Lightformer form="rect" intensity={1.0} position={[0, 4, -10]} scale={[12, 6, 1]} color="#ffffff" />
        </Environment>

        <Rig flipped={flipped}>
          <Handheld />
        </Rig>

        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.5}
          minAzimuthAngle={-0.45}
          maxAzimuthAngle={0.45}
          minPolarAngle={Math.PI / 2 - 0.42}
          maxPolarAngle={Math.PI / 2 + 0.18}
          minDistance={18}
          maxDistance={44}
          target={[0, 0.4, 0]}
        />
      </HandheldContext.Provider>
    </Canvas>
  )
}

/** Turns the device to show front or back, with a gentle idle sway. */
function Rig({ flipped, children }: { flipped: boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    const grp = g.current
    if (!grp) return
    const target = flipped ? Math.PI : 0
    // time-based easing so the turn takes the same time at any frame rate
    grp.rotation.y += (target - grp.rotation.y) * (1 - Math.exp(-6 * Math.min(dt, 0.25)))
    // very small breathing tilt so it reads as an object, not a picture
    const t = clock.elapsedTime
    grp.rotation.x = Math.sin(t * 0.5) * 0.012
    grp.rotation.z = Math.sin(t * 0.37) * 0.008
  })
  return (
    <group ref={g} name="device-rig">
      {children}
    </group>
  )
}

/**
 * Pull the camera back far enough that the whole device fits, whatever the
 * viewport shape. Runs on resize only; orbit zoom works within limits.
 */
function FitCamera() {
  const { camera, size } = useThree()
  const last = useRef('')
  useFrame(() => {
    const key = `${size.width}x${size.height}`
    if (key === last.current) return
    last.current = key
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const halfH = 8.6 // body plus the cart above it, with margin
    const halfW = 4.9
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const dist = Math.max(halfH / t, halfW / (t * aspect))
    const dir = cam.position.clone().sub(new THREE.Vector3(0, 0.4, 0)).normalize()
    cam.position.copy(dir.multiplyScalar(dist).add(new THREE.Vector3(0, 0.4, 0)))
    cam.updateProjectionMatrix()
  })
  return null
}

/**
 * Test/host helper: window.JUICED.project(x, y, z) maps a point on the
 * device (in its own centimetre coordinates) to CSS pixels on the page,
 * including the current orbit and flip.
 */
function ProjectHelper() {
  const { camera, size, scene } = useThree()
  useFrame(() => {
    const j = window.JUICED
    if (!j || j.project) return
    j.project = (x: number, y: number, z: number) => {
      const rig = scene.getObjectByName('device-rig')
      const v = new THREE.Vector3(x, y, z)
      if (rig) v.applyMatrix4(rig.matrixWorld)
      v.project(camera)
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height }
    }
  })
  return null
}
