import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX_POS, BOX_QUAT, PLAY_POS, PLAY_QUAT, clamp01, easeInOut, type SceneAnim } from './anim'
import type { ExperienceStore } from './store'

interface Props {
  exp: ExperienceStore
  anim: SceneAnim
  onPick: () => void
  children: ReactNode
}

const P1 = BOX_POS.clone().add(new THREE.Vector3(0, 13, 4)) // lift straight up out of the tray
const P2 = PLAY_POS.clone().add(new THREE.Vector3(0, -7, -3)) // then swing up toward the viewer

function bezier(k: number, out: THREE.Vector3) {
  const u = 1 - k
  return out
    .copy(BOX_POS)
    .multiplyScalar(u * u * u)
    .addScaledVector(P1, 3 * u * u * k)
    .addScaledVector(P2, 3 * u * k * k)
    .addScaledVector(PLAY_POS, k * k * k)
}

/**
 * Holds the handheld and moves it between the tray and the play position.
 * In the box it is one clickable object (its own buttons stay inert);
 * picking it up lifts it out, turns it to face you, and hands over to the
 * existing play view.
 */
export function DeviceCarrier({ exp, anim, onPick, children }: Props) {
  const g = useRef<THREE.Group>(null)
  const p = useRef(new THREE.Vector3())
  const q = useRef(new THREE.Quaternion())

  // the handheld casts a shadow into the tray
  useEffect(() => {
    g.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true
    })
  })

  useFrame(({ clock }) => {
    const grp = g.current
    if (!grp) return
    const snap = exp.get()
    const t = exp.elapsed(performance.now())
    const d = exp.durations
    let k = 0
    switch (snap.state) {
      case 'pickingUpHandheld':
        k = clamp01(t / d.pickUp)
        break
      case 'handheldActive':
        k = 1
        break
      case 'returningHandheld':
        k = 1 - clamp01(t / d.putBack)
        break
    }
    const e = easeInOut(k)
    bezier(e, p.current)
    // turn toward the viewer a little after the lift starts
    const r = easeInOut(clamp01((e - 0.12) / 0.78))
    q.current.copy(BOX_QUAT).slerp(PLAY_QUAT, r)
    if (k === 0) {
      // resting in the tray; lifts a touch on hover, and breathes very slightly
      p.current.y += 0.7 * anim.hoverDevice + 0.05 * anim.idle * Math.sin(clock.elapsedTime * 1.6)
    }
    grp.position.copy(p.current)
    grp.quaternion.copy(q.current)
    // zipped inside the closed bag: skip drawing it
    grp.visible = snap.state !== 'lunchboxClosed'
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (exp.state !== 'lunchboxOpen') return
    if (e.delta > 6) return
    e.stopPropagation()
    onPick()
  }
  const over = (e: ThreeEvent<PointerEvent>) => {
    if (exp.state !== 'lunchboxOpen') return
    e.stopPropagation()
    anim.hoverDeviceTarget = 1
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    anim.hoverDeviceTarget = 0
    if (exp.state === 'lunchboxOpen') document.body.style.cursor = 'auto'
  }

  return (
    <group ref={g} onClick={click} onPointerOver={over} onPointerOut={out}>
      {children}
    </group>
  )
}
