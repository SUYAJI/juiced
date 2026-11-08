import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameState } from '../game/store'
import { useHandheld } from './context'
import { BAY, BEZEL, BODY, BRAND_OVAL, FRONT_Z, GRILLE, LCD, POWER_LED, TOP_Y, WORDMARK_Y } from './dims'
import { backShellGeometry, bezelGeometry, frontShellGeometry } from './geometry'
import { brandOvalTexture, canvasTexture, powerLabelTexture, wearTexture, wordmarkTexture } from './textures'

export const SHELL_COLOR = '#4b3aa6'

export function useShellMaterial(): THREE.MeshPhysicalMaterial {
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: SHELL_COLOR,
        roughness: 0.6,
        roughnessMap: wearTexture(),
        metalness: 0.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.5,
        envMapIntensity: 0.85,
      }),
    [],
  )
  useEffect(
    () => () => {
      mat.roughnessMap?.dispose()
      mat.dispose()
    },
    [mat],
  )
  return mat
}

export function Shell() {
  const shellMat = useShellMaterial()
  const front = useMemo(() => frontShellGeometry(), [])
  const back = useMemo(() => backShellGeometry(), [])
  const bezel = useMemo(
    () => bezelGeometry(BEZEL.w, BEZEL.h, BEZEL.r, LCD.w + 0.14, LCD.h + 0.14, LCD.y - BEZEL.y, BEZEL.depth),
    [],
  )
  const wordmark = useMemo(() => wordmarkTexture(), [])
  const oval = useMemo(() => brandOvalTexture(), [])
  const powerLabel = useMemo(() => powerLabelTexture(), [])

  useEffect(
    () => () => {
      front.dispose()
      back.dispose()
      bezel.dispose()
      wordmark.dispose()
      oval.dispose()
      powerLabel.dispose()
    },
    [front, back, bezel, wordmark, oval, powerLabel],
  )

  const onBezel = FRONT_Z + BEZEL.depth + 0.035

  return (
    <group>
      <mesh geometry={front} material={shellMat} />
      <mesh geometry={back} material={shellMat} />

      {/* Floor of the battery bay (the inside face of the front half) */}
      <mesh position={[BAY.x, BAY.y, -0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[BAY.w + 0.1, BAY.h + 0.1]} />
        <meshStandardMaterial color="#2a2147" roughness={0.9} />
      </mesh>

      {/* Screen bezel: dark glossy plate with the LCD window cut out */}
      <mesh geometry={bezel} position={[BEZEL.x, BEZEL.y, FRONT_Z + 0.002]}>
        <meshPhysicalMaterial color="#141319" roughness={0.3} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>

      {/* Wordmark printed on the bezel under the screen */}
      <mesh position={[0, WORDMARK_Y, onBezel]}>
        <planeGeometry args={[3.0, 0.56]} />
        <meshBasicMaterial map={wordmark} transparent toneMapped={false} />
      </mesh>

      <PowerLed z={onBezel} />
      <mesh position={[POWER_LED.x + 0.14, POWER_LED.y - 0.06, onBezel - 0.002]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshBasicMaterial map={powerLabel} transparent toneMapped={false} opacity={0.85} />
      </mesh>

      {/* Embossed brand oval above the buttons (replaces the original maker's mark) */}
      <mesh position={[BRAND_OVAL.x, BRAND_OVAL.y, FRONT_Z + 0.004]}>
        <planeGeometry args={[BRAND_OVAL.w, BRAND_OVAL.h]} />
        <meshBasicMaterial map={oval} transparent toneMapped={false} />
      </mesh>

      <Grille />
      <EdgeDetails />
    </group>
  )
}

function PowerLed({ z }: { z: number }) {
  const { store } = useHandheld()
  const state = useGameState(store)
  const on = state.power !== 'off'
  // LED sits at the centre of the printed arcs (see powerLabelTexture)
  return (
    <mesh position={[POWER_LED.x, POWER_LED.y, z + 0.002]}>
      <circleGeometry args={[0.055, 16]} />
      <meshStandardMaterial
        color={on ? '#ff3b2f' : '#3a1414'}
        emissive={on ? '#ff2a1a' : '#000000'}
        emissiveIntensity={on ? 2 : 0}
        roughness={0.3}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Speaker grille: staggered rows of small dark holes, bottom right. */
function Grille() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = GRILLE.cols * GRILLE.rows
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    let i = 0
    for (let row = 0; row < GRILLE.rows; row++) {
      for (let col = 0; col < GRILLE.cols; col++) {
        const x = GRILLE.x + col * GRILLE.dx + (row % 2) * (GRILLE.dx / 2)
        const y = GRILLE.y - row * GRILLE.dy
        o.position.set(x, y, FRONT_Z + 0.003)
        o.updateMatrix()
        m.setMatrixAt(i++, o.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  }, [count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <circleGeometry args={[0.058, 10]} />
      <meshStandardMaterial color="#0e0d14" roughness={0.95} />
    </instancedMesh>
  )
}

/**
 * Power switch (top edge, left), IR window (top edge, right), link port
 * and slot (right side), volume wheel (left side), headphone jack (bottom).
 */
function EdgeDetails() {
  const leftX = -BODY.w / 2
  const rightX = BODY.w / 2
  const swZ = FRONT_Z / 2 + 0.05

  return (
    <group>
      <PowerSwitch z={swZ} />

      {/* Infrared window on the top edge */}
      <mesh position={[2.35, TOP_Y + 0.003, swZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 0.4]} />
        <meshPhysicalMaterial color="#2a0d14" roughness={0.15} clearcoat={0.9} />
      </mesh>

      {/* Link port and the small slot below it, on the right side */}
      <mesh position={[rightX + 0.003, 4.75, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.6, 0.85]} />
        <meshStandardMaterial color="#14111d" roughness={0.85} />
      </mesh>
      <mesh position={[rightX + 0.005, 4.75, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.32, 0.55]} />
        <meshStandardMaterial color="#6d6a78" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[rightX + 0.003, 3.85, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.18, 0.55]} />
        <meshStandardMaterial color="#14111d" roughness={0.85} />
      </mesh>

      {/* Volume wheel, knurled, protruding from the left side */}
      <mesh position={[leftX + 0.22, 3.3, 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 0.18, 40]} />
        <meshStandardMaterial color="#25232b" roughness={0.7} />
      </mesh>
      <mesh position={[leftX - 0.002, 3.3, 0.15]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.5, 1.05]} />
        <meshStandardMaterial color="#14111d" roughness={0.9} />
      </mesh>

      {/* Headphone jack on the bottom edge */}
      <mesh position={[-1.6, -BODY.h / 2 - 0.002, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 20]} />
        <meshStandardMaterial color="#0e0d12" roughness={0.9} />
      </mesh>
    </group>
  )
}

/**
 * Power switch on the top edge. The nub sits proud of the shell in a lighter
 * purple so it reads from the front camera; while the device is off it
 * breathes softly to say "start here". A generous invisible hit volume
 * wraps the top-left corner so it is easy to click or tap from any of the
 * allowed viewing angles.
 */
function PowerSwitch({ z }: { z: number }) {
  const { store, togglePower } = useHandheld()
  const state = useGameState(store)
  const on = state.power !== 'off'
  const slider = useRef<THREE.Group>(null)
  const nubMat = useRef<THREE.MeshStandardMaterial>(null)
  const [hover, setHover] = useState(false)

  useFrame(({ clock }, dt) => {
    const g = slider.current
    if (g) {
      const target = on ? 0.5 : 0
      g.position.x += (target - g.position.x) * (1 - Math.exp(-14 * Math.min(dt, 0.1)))
    }
    const m = nubMat.current
    if (m) {
      const breathe = on ? 0 : 0.25 + 0.25 * Math.sin(clock.elapsedTime * 3)
      m.emissiveIntensity = hover ? 0.7 : breathe
    }
  })

  const handlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      togglePower()
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHover(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      setHover(false)
      document.body.style.cursor = 'auto'
    },
  }

  return (
    <group>
      {/* slot in the top edge */}
      <mesh position={[-2.7, TOP_Y + 0.002, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.25, 0.4]} />
        <meshStandardMaterial color="#120f1c" roughness={0.9} />
      </mesh>
      {/* sliding nub with grip ridges */}
      <group ref={slider}>
        <RoundedBoxNub matRef={nubMat} position={[-3.05, TOP_Y + 0.17, z]} />
      </group>

      {/* ON / OFF printed on the front just below the top edge */}
      <PowerPrint on={on} />

      {/* Generous hit volume around the corner (raycast ignores visibility) */}
      <mesh position={[-2.6, TOP_Y + 0.1, z + 0.35]} visible={false} {...handlers}>
        <boxGeometry args={[2.4, 1.0, 2.2]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

function RoundedBoxNub({ matRef, position }: { matRef: React.RefObject<THREE.MeshStandardMaterial | null>; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.5, 0.34, 0.36]} />
        <meshStandardMaterial ref={matRef} color="#8f7cf0" emissive="#b9a8ff" emissiveIntensity={0.3} roughness={0.45} />
      </mesh>
      {[-0.14, 0, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.172, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 0.3]} />
          <meshStandardMaterial color="#5a48b8" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** Tiny printed OFF / ON with an arrow, like the marking on the real shell. */
function PowerPrint({ on }: { on: boolean }) {
  const tex = useMemo(
    () =>
      canvasTexture(256, 64, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        ctx.font = '700 30px "Helvetica Neue", Arial, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#d9d2ee'
        ctx.fillText('OFF', 8, h / 2 + 2)
        ctx.fillText('ON', w - 52, h / 2 + 2)
        ctx.fillRect(78, h / 2 - 1, 96, 3)
        ctx.beginPath()
        ctx.moveTo(186, h / 2)
        ctx.lineTo(170, h / 2 - 9)
        ctx.lineTo(170, h / 2 + 9)
        ctx.fill()
      }),
    [],
  )
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={[-2.7, TOP_Y - 0.17, FRONT_Z + 0.004]}>
      <planeGeometry args={[1.2, 0.3]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} opacity={on ? 0.55 : 0.85} />
    </mesh>
  )
}
