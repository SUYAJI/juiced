import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useHandheld } from './context'
import { BACK_Z, BODY, FRONT_Z } from './dims'
import type { SpawnRequest } from './parts'

// Juice-drop critters: little 3D versions of Pip, the drop from the game,
// in the fruit colours. When a battery or the cartridge is lifted out they
// tumble out of the opening, scurry across the device, and evaporate.

const POOL = 40
const COLORS = ['#f28c38', '#ef7aa8', '#9fd65a', '#f2c14e', '#fff1cf']
const SIZE = 0.85 // cm tall

interface Critter {
  alive: boolean
  t: number
  life: number
  delay: number
  side: 1 | -1 // +1 front face, -1 back face
  pos: THREE.Vector2 // on the face plane (device x, y)
  vel: THREE.Vector2
  depth: number // current distance out from the face
  floater: boolean
  phase: number
  hop: number
}

/** A teardrop, round at the bottom and pointed at the top (unit height). */
function dropGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  const N = 18
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const y = t
    const r = 0.42 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - 0.25 * t)
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y))
  }
  return new THREE.LatheGeometry(pts, 20)
}

export function Critters() {
  const { parts } = useHandheld()
  const group = useRef<THREE.Group>(null)

  const res = useMemo(() => {
    const body = dropGeometry()
    const eye = new THREE.SphereGeometry(0.055, 8, 6)
    const shine = new THREE.SphereGeometry(0.03, 6, 4)
    const mats = COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 }))
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#2a1f44' })
    const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    const nodes = Array.from({ length: POOL }, (_, i) => {
      const g = new THREE.Group()
      const mat = mats[i % mats.length]
      const b = new THREE.Mesh(body, mat)
      b.scale.setScalar(SIZE)
      const e1 = new THREE.Mesh(eye, eyeMat)
      const e2 = new THREE.Mesh(eye, eyeMat)
      e1.position.set(-0.11, 0.27, 0.305)
      e2.position.set(0.11, 0.27, 0.305)
      e1.scale.setScalar(1.3)
      e2.scale.setScalar(1.3)
      const s1 = new THREE.Mesh(shine, shineMat)
      s1.position.set(-0.13, 0.48, 0.225)
      g.add(b, e1, e2, s1)
      g.visible = false
      return { g, mat }
    })
    const critters: Critter[] = nodes.map(() => ({
      alive: false,
      t: 0,
      life: 0,
      delay: 0,
      side: 1,
      pos: new THREE.Vector2(),
      vel: new THREE.Vector2(),
      depth: 0,
      floater: false,
      phase: 0,
      hop: 0,
    }))
    return { body, eye, shine, mats, eyeMat, shineMat, nodes, critters }
  }, [])

  useEffect(() => {
    const g = group.current
    if (!g) return
    res.nodes.forEach((n) => g.add(n.g))
    return () => {
      res.nodes.forEach((n) => g.remove(n.g))
    }
  }, [res])

  useEffect(
    () => () => {
      res.body.dispose()
      res.eye.dispose()
      res.shine.dispose()
      res.mats.forEach((m) => m.dispose())
      res.eyeMat.dispose()
      res.shineMat.dispose()
    },
    [res],
  )

  // spawn requests from the parts
  useEffect(
    () =>
      parts.onSpawn((req: SpawnRequest) => {
        let made = 0
        for (const c of res.critters) {
          if (made >= req.count) break
          if (c.alive) continue
          made++
          c.alive = true
          c.t = 0
          c.delay = made * 0.07 + Math.random() * 0.12
          c.life = 1.4 + Math.random() * 1.4
          c.side = req.side === 'front' ? 1 : -1
          c.pos.set(req.origin[0] + (Math.random() - 0.5) * 1.2, req.origin[1] + (Math.random() - 0.5) * 0.6)
          // run away from where they came out, fanning outward
          const ang = Math.atan2(c.pos.y - req.origin[1], c.pos.x - req.origin[0]) + (Math.random() - 0.5) * 1.6
          const away = req.side === 'front' ? -Math.PI / 2 : ang
          const dir = req.side === 'front' ? away + (Math.random() - 0.5) * 2.2 : ang
          const speed = 2.2 + Math.random() * 2.6
          c.vel.set(Math.cos(dir) * speed, Math.sin(dir) * speed)
          c.depth = -0.9 // starts just inside the opening
          c.floater = Math.random() < 0.3
          c.phase = Math.random() * Math.PI * 2
          c.hop = 9 + Math.random() * 6
        }
      }),
    [parts, res],
  )

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05)
    res.critters.forEach((c, i) => {
      const node = res.nodes[i]
      if (!c.alive) {
        node.g.visible = false
        return
      }
      c.t += dt
      const t = c.t - c.delay
      if (t < 0) {
        node.g.visible = false
        return
      }
      node.g.visible = true
      const faceZ = c.side > 0 ? FRONT_Z + 0.32 : BACK_Z - 0.32

      // pop out of the opening (depth < 0 is inside), then scurry or float
      const floating = c.floater && t > 0.35
      if (floating) {
        c.vel.multiplyScalar(0.96)
        c.vel.y += dt * 3.2 // drift up
        c.depth += dt * 1.4 // and away from the device
      } else {
        c.depth = Math.min(0, c.depth + dt * 5)
      }
      c.pos.addScaledVector(c.vel, dt)
      const bounce = floating ? 0.08 * Math.sin(t * 6 + c.phase) : Math.abs(Math.sin(t * c.hop + c.phase)) * 0.22

      // evaporate at the end of their run, or once they run off the edge
      const off = Math.abs(c.pos.x) > BODY.w / 2 + 0.6 || c.pos.y < -BODY.h / 2 - 0.4 || c.pos.y > BODY.h / 2 + 3
      if (off && c.t < c.delay + c.life - 0.35) c.life = c.t - c.delay + 0.35
      const left = c.life - t
      const fade = Math.max(0, Math.min(1, left / 0.35))
      if (left <= 0) {
        c.alive = false
        node.g.visible = false
        return
      }
      const appear = Math.min(1, t / 0.15)
      const k = fade * appear

      // squash and stretch with the hop; stretch upward as they evaporate
      const squash = 1 - bounce * 0.6
      node.g.scale.set(k * (1 + (1 - squash) * 0.5), k * squash + (1 - fade) * 0.6, k)
      node.g.position.set(c.pos.x, c.pos.y + bounce, faceZ + c.side * c.depth)
      // face the viewer of that side, leaning into the run
      node.g.rotation.set(0, c.side > 0 ? 0 : Math.PI, -c.vel.x * 0.04 * c.side)
    })
  })

  return <group ref={group} />
}
