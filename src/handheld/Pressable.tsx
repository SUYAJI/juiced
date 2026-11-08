import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { Group } from 'three'
import type { Action } from '../game/controller'
import { useHandheld } from './context'

interface Props {
  action: Action
  /** How far the button travels when pressed, in cm. */
  depth?: number
  position: [number, number, number]
  rotation?: [number, number, number]
  children: ReactNode
}

/**
 * A button that physically depresses. Pointer presses on the mesh send the
 * action to the game; keyboard presses (observed through the controller)
 * flash the same travel so the device always matches what the player did.
 */
export function Pressable({ action, depth = 0.08, position, rotation, children }: Props) {
  const { controller, press } = useHandheld()
  const inner = useRef<Group>(null)
  const [held, setHeld] = useState(false)
  const flashUntil = useRef(0)
  const controls = useThree((s) => s.controls as { enabled: boolean } | null)

  useEffect(
    () =>
      controller.onPress((a) => {
        if (a === action) flashUntil.current = performance.now() + 130
      }),
    [controller, action],
  )

  useFrame((_, dt) => {
    const g = inner.current
    if (!g) return
    const target = held || performance.now() < flashUntil.current ? -depth : 0
    g.position.z += (target - g.position.z) * (1 - Math.exp(-30 * Math.min(dt, 0.1)))
  })

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (controls) controls.enabled = false
    setHeld(true)
    press(action)
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    if (controls) controls.enabled = true
    setHeld(false)
  }

  return (
    <group position={position} rotation={rotation}>
      <group
        ref={inner}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        {children}
      </group>
    </group>
  )
}
