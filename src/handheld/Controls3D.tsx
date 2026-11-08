import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { Action } from '../game/controller'
import { useHandheld } from './context'
import { BTN_A, BTN_B, DPAD, FRONT_Z, PILL, SELECT, START } from './dims'
import { Pressable } from './Pressable'
import { buttonLetterTexture } from './textures'

const BUTTON_COLOR = '#1c1b22'

type Dir = 'up' | 'down' | 'left' | 'right'
const TILT = 0.13

/**
 * D-pad: one rocker that tilts toward whichever arm is pressed.
 * Each arm is its own hit target; the whole cross animates.
 */
export function DPad() {
  const { controller, press, isActive } = useHandheld()
  const rocker = useRef<THREE.Group>(null)
  const [held, setHeld] = useState<Dir | null>(null)
  const flash = useRef<{ dir: Dir; until: number } | null>(null)
  const controls = useThree((s) => s.controls as { enabled: boolean } | null)

  useEffect(
    () =>
      controller.onPress((a) => {
        if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
          flash.current = { dir: a, until: performance.now() + 130 }
        }
      }),
    [controller],
  )

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-30 * Math.min(dt, 0.1))
    const g = rocker.current
    if (!g) return
    const active = held ?? (flash.current && performance.now() < flash.current.until ? flash.current.dir : null)
    let rx = 0
    let ry = 0
    if (active === 'up') rx = -TILT
    if (active === 'down') rx = TILT
    if (active === 'right') ry = TILT
    if (active === 'left') ry = -TILT
    g.rotation.x += (rx - g.rotation.x) * k
    g.rotation.y += (ry - g.rotation.y) * k
    g.position.z += ((active ? -0.03 : 0) - g.position.z) * k
  })

  const down = (dir: Dir) => (e: ThreeEvent<PointerEvent>) => {
    if (!isActive()) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    setHeld(dir)
    press(dir as Action)
  }
  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!isActive() && !held) return
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    setHeld(null)
  }

  const half = DPAD.span / 2
  const arm = DPAD.arm
  const reach = half - arm / 2 // arm centre offset from the middle
  const armProps = {
    radius: 0.07,
    smoothness: 3,
    onPointerUp: up,
    onPointerCancel: up,
    onPointerOver: () => isActive() && (document.body.style.cursor = 'pointer'),
    onPointerOut: () => isActive() && (document.body.style.cursor = 'auto'),
  }

  return (
    <group position={[DPAD.x, DPAD.y, FRONT_Z]}>
      {/* recess the pad sits in */}
      <mesh position={[0, 0, 0.002]}>
        <ringGeometry args={[half + 0.02, half + 0.12, 48]} />
        <meshStandardMaterial color="#3c2f92" roughness={0.9} transparent opacity={0.55} />
      </mesh>
      <group ref={rocker} position={[0, 0, 0.02]}>
        <RoundedBox args={[arm, arm, DPAD.h]} position={[0, 0, DPAD.h / 2]} {...armProps}>
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[arm, half - arm / 2 + 0.01, DPAD.h]} position={[0, reach / 2 + arm / 4, DPAD.h / 2]} onPointerDown={down('up')} {...armProps}>
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[arm, half - arm / 2 + 0.01, DPAD.h]} position={[0, -(reach / 2 + arm / 4), DPAD.h / 2]} onPointerDown={down('down')} {...armProps}>
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[half - arm / 2 + 0.01, arm, DPAD.h]} position={[-(reach / 2 + arm / 4), 0, DPAD.h / 2]} onPointerDown={down('left')} {...armProps}>
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[half - arm / 2 + 0.01, arm, DPAD.h]} position={[reach / 2 + arm / 4, 0, DPAD.h / 2]} onPointerDown={down('right')} {...armProps}>
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.6} />
        </RoundedBox>
        {/* shallow dish in the centre */}
        <mesh position={[0, 0, DPAD.h + 0.001]}>
          <circleGeometry args={[0.22, 20]} />
          <meshStandardMaterial color="#111016" roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

function RoundButton({ action, x, y, r, h, letter }: { action: Action; x: number; y: number; r: number; h: number; letter: string }) {
  const tex = useMemo(() => buttonLetterTexture(letter), [letter])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group>
      <mesh position={[x, y, FRONT_Z + 0.002]}>
        <ringGeometry args={[r + 0.01, r + 0.08, 40]} />
        <meshStandardMaterial color="#2c2270" roughness={0.9} />
      </mesh>
      <Pressable action={action} position={[x, y, FRONT_Z]} depth={0.1}>
        <mesh position={[0, 0, h / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r + 0.02, h, 40]} />
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, h + 0.001]} rotation={[0, 0, -0.42]}>
          <circleGeometry args={[r * 0.75, 24]} />
          <meshBasicMaterial map={tex} transparent toneMapped={false} />
        </mesh>
      </Pressable>
    </group>
  )
}

export function ActionButtons() {
  return (
    <group>
      <RoundButton action="b" x={BTN_B.x} y={BTN_B.y} r={BTN_B.r} h={BTN_B.h} letter="B" />
      <RoundButton action="a" x={BTN_A.x} y={BTN_A.y} r={BTN_A.r} h={BTN_A.h} letter="A" />
    </group>
  )
}

function Pill({ action, x, y }: { action: Action; x: number; y: number }) {
  return (
    <group>
      <Pressable action={action} position={[x, y, FRONT_Z]} rotation={[0, 0, PILL.tilt]} depth={0.07}>
        <RoundedBox args={[PILL.w, PILL.h, PILL.d]} radius={0.09} smoothness={3} position={[0, 0, PILL.d / 2]}>
          <meshStandardMaterial color={BUTTON_COLOR} roughness={0.6} />
        </RoundedBox>
      </Pressable>
    </group>
  )
}

export function MenuButtons() {
  return (
    <group>
      <Pill action="select" x={SELECT.x} y={SELECT.y} />
      <Pill action="start" x={START.x} y={START.y} />
    </group>
  )
}
