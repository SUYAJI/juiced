import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LB } from './dims'
import { vnoise } from './surface'

// What's packed in the bottom compartment besides the handheld: lunch
// wrapped in wax paper (an approximation from description).

const FLOOR = LB.T + 0.02

export const SANDWICH = { x: 0.6, z: 0.9, w: 11.6, h: 3.5, d: 9.6, yaw: -0.05 }

/** Wax-paper bundle: a soft block with crinkles, a top fold and tucked ends. */
function sandwichGeometry(): THREE.BufferGeometry {
  const { w, h, d } = SANDWICH
  const g = new THREE.BoxGeometry(w, h, d, 36, 10, 28)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const ux = v.x / (w / 2)
    const uy = v.y / (h / 2)
    const uz = v.z / (d / 2)
    const r = 0.9
    const inner = new THREE.Vector3(
      Math.max(-w / 2 + r, Math.min(w / 2 - r, v.x)),
      Math.max(-h / 2 + r, Math.min(h / 2 - r, v.y)),
      Math.max(-d / 2 + r, Math.min(d / 2 - r, v.z)),
    )
    const n = v.clone().sub(inner)
    if (n.lengthSq() > 1e-6) v.copy(inner).addScaledVector(n.normalize(), r)
    // the filling domes the top a little; paper crinkles everywhere
    if (uy > 0) v.y += 0.35 * (1 - ux * ux) * (1 - uz * uz)
    const crinkle = 0.09 * vnoise(v.x * 1.7, v.y * 1.7, v.z * 1.7) + 0.05 * vnoise(v.x * 4.1 + 3, v.y * 4.1, v.z * 4.1)
    v.addScaledVector(n.lengthSq() > 1e-6 ? n : new THREE.Vector3(0, Math.sign(uy) || 1, 0), crinkle)
    // fold ridge along the top where the paper is brought together
    if (uy > 0.6) v.y += 0.22 * Math.exp(-((v.z / 0.5) ** 2))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/** Folded paper flaps tucked over each short end. */
function flapGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-SANDWICH.d / 2 + 0.6, 0)
  s.lineTo(SANDWICH.d / 2 - 0.6, 0)
  s.lineTo(0.4, SANDWICH.h * 0.62)
  s.lineTo(-0.5, SANDWICH.h * 0.66)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

export function Contents() {
  const parts = useMemo(() => {
    const paper = new THREE.MeshPhysicalMaterial({
      color: '#efe9d9',
      roughness: 0.42,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
    })
    const tape = new THREE.MeshStandardMaterial({ color: '#f4efe2', roughness: 0.35, transparent: true, opacity: 0.85 })
    return { paper, tape, sandwich: sandwichGeometry(), flap: flapGeometry() }
  }, [])

  useEffect(
    () => () => {
      parts.paper.dispose()
      parts.tape.dispose()
      parts.sandwich.dispose()
      parts.flap.dispose()
    },
    [parts],
  )

  const S = SANDWICH
  return (
    <group position={[S.x, FLOOR + S.h / 2, S.z]} rotation={[0, S.yaw, 0]}>
      <mesh geometry={parts.sandwich} material={parts.paper} castShadow receiveShadow />
      <mesh geometry={parts.flap} material={parts.paper} position={[S.w / 2 + 0.05, -S.h / 2 + 0.1, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={parts.flap} material={parts.paper} position={[-S.w / 2 - 0.05, -S.h / 2 + 0.1, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh position={[S.w / 2 - 1.2, S.h / 2 + 0.36, 0]} rotation={[0, 0, -0.05]} material={parts.tape}>
        <boxGeometry args={[1.0, 0.03, 3.4]} />
      </mesh>
    </group>
  )
}
