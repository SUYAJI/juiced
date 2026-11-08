import * as THREE from 'three'
import { BEND, HINGE, LB, POCKET } from './dims'

/** Which cuboid face a rest vertex came from (BoxGeometry group order). */
export type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
export const FACE_ORDER: Face[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']

// ---- small deterministic value noise ------------------------------------

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** Smooth value noise in [-1, 1]. */
export function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = fade(x - xi)
  const yf = fade(y - yi)
  const zf = fade(z - zi)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz)
  const v = l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  )
  return v * 2 - 1
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Rounding radius as a function of height: soft dome on top, tighter base. */
function radiusAt(y: number): number {
  // the bottom compartment stays fairly boxy; the cap rounds into a dome
  return LB.RB + (LB.RT - LB.RB) * smoothstep(LB.ZIP_Y - 0.5, LB.H - 0.3, y)
}

/** Signed distance to the flat front pocket (front-face coords). */
function pocketSd(x: number, y: number): number {
  const cx = (POCKET.x0 + POCKET.x1) / 2
  const cy = (POCKET.zipY + POCKET.bottom) / 2
  const hw = (POCKET.x1 - POCKET.x0) / 2
  const hh = (POCKET.zipY - POCKET.bottom) / 2
  const r = 1.2
  const qx = Math.abs(x - cx) - hw + r
  const qy = Math.abs(y - cy) - hh + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

const tmpCl = new THREE.Vector3()
const tmpN = new THREE.Vector3()

/**
 * Map a point on the plain cuboid (x in ±W/2, y in 0..H, z in ±D/2) to the
 * soft lunchbox surface. Writes the position into `out` and returns it.
 * Deterministic, so coincident cuboid points on two faces land together.
 */
export function softSurface(cx: number, cy: number, cz: number, face: Face, out: THREE.Vector3): THREE.Vector3 {
  const { W, H, D, RB, RT, ZIP_Y } = LB
  const r = radiusAt(cy)

  // 1. round the cuboid: clamp into an inner box, push out by the radius
  const ix = W / 2 - r
  const iz = D / 2 - r
  tmpCl.set(
    Math.min(ix, Math.max(-ix, cx)),
    Math.min(H - RT, Math.max(RB, cy)),
    Math.min(iz, Math.max(-iz, cz)),
  )
  tmpN.set(cx - tmpCl.x, cy - tmpCl.y, cz - tmpCl.z)
  if (tmpN.lengthSq() < 1e-9) tmpN.set(0, 1, 0)
  tmpN.normalize()
  out.copy(tmpCl).addScaledVector(tmpN, r)

  // 2. soft panels bulge outward a little (zero at the panel edges)
  let bulge = 0
  const u = (a: number, half: number) => Math.min(1, Math.abs(a) / half)
  // the cap is puffier than the bottom compartment
  const capPuff = 1 + 0.9 * smoothstep(ZIP_Y, H, cy)
  if (face === 'pz' || face === 'nz') bulge = 0.5 * capPuff * (1 - u(cx, W / 2) ** 2) * (1 - u(cy - H / 2, H / 2) ** 2)
  else if (face === 'px' || face === 'nx') bulge = 0.42 * capPuff * (1 - u(cz, D / 2) ** 2) * (1 - u(cy - H / 2, H / 2) ** 2)
  else if (face === 'py') bulge = 1.45 * (1 - u(cx, W / 2) ** 2) * (1 - u(cz, D / 2) ** 1.6)

  // 3. the flat front pocket swells a little with whatever is in it
  if (face === 'pz') {
    const sd = pocketSd(cx, cy)
    bulge += POCKET.puff * smoothstep(0.4, -1.6, sd)
  }

  // 4. lumps, wrinkles, and puckering just above the zipper
  const nearZip = smoothstep(0.35, 1.0, Math.abs(cy - ZIP_Y))
  const floor = smoothstep(0.0, 1.6, cy)
  let lump = 0.3 * vnoise(cx * 0.2 + 3.1, cy * 0.2, cz * 0.2) + 0.07 * vnoise(cx * 0.9, cy * 0.9 + 7.7, cz * 0.9)
  lump *= nearZip * floor
  let pucker = 0
  if (face !== 'py' && face !== 'ny') {
    const along = face === 'pz' || face === 'nz' ? cx : cz
    const band = Math.exp(-(((cy - (ZIP_Y + 1.25)) / 0.75) ** 2))
    pucker = 0.17 * band * Math.sin(along * 2.2 + 2.6 * vnoise(along * 0.4, cy * 0.3, 1.3))
  }
  out.addScaledVector(tmpN, bulge + lump + pucker)

  // 5. a slight slouch: the top settles lower toward the +x end
  const k = (cy / H) ** 3
  out.y -= 0.45 * k * (0.5 + 0.5 * (cx / (W / 2)))
  out.x += 0.25 * Math.sin(cy * 0.21 + 0.4) * smoothstep(1, 6, cy)

  if (out.y < 0) out.y = 0
  return out
}

// ---- lid deformation ----------------------------------------------------

export interface LidPose {
  /** Opening angle in radians (0 closed). */
  theta: number
  /** Angular velocity, used to make the far edge trail behind. */
  vel: number
  /** 0..1, how far open (for droop and pinch). */
  open: number
}

const tmpRest = new THREE.Vector3()

/**
 * Soft hinge: each point of the upper section rotates about the back hinge
 * line by an angle that ramps up over the BEND band (the back panel curls
 * rather than pivots), the far edge lags while moving and sags once open,
 * and the side walls pinch in slightly. Returns the per-point angle so
 * normals can be rotated to match.
 */
export function deformLid(rx: number, ry: number, rz: number, pose: LidPose, out: THREE.Vector3): number {
  const dy = ry - HINGE.y
  const dz = rz - HINGE.z
  const d = Math.max(0, dy) + Math.max(0, dz) * 0.85
  const w = smoothstep(0, BEND, d)
  const far = Math.min(1, d / 30)
  const a = pose.theta * w - 0.12 * pose.vel * far * far
  const c = Math.cos(a)
  const s = Math.sin(a)
  let y = HINGE.y + dy * c + dz * s
  const z = HINGE.z - dy * s + dz * c
  // gravity sag on the free end, soft walls pinching in, and the fabric
  // creasing as the walls lose the shape the zipper was holding
  const o = pose.open
  y -= 3.4 * o * far * far * Math.max(0, Math.sin(a))
  const crumple = o * w * (0.85 * vnoise(rx * 0.2 + 9.1, ry * 0.2, rz * 0.2) + 0.25 * vnoise(rx * 0.7, ry * 0.7 + 4.4, rz * 0.7))
  y += crumple * 0.6
  let zz = z + crumple * (0.4 + far)
  // end walls sag outward a little at the free edge
  const endWall = Math.min(1, Math.abs(rx) / (LB.W / 2)) ** 6
  const x = rx * (1 - 0.07 * o * w) + Math.sign(rx) * endWall * o * far * 0.9
  if (y < 0.15) y = 0.15
  out.set(x, y, zz)
  tmpRest.set(rx, ry, rz)
  return a
}

/** Rotate a normal about +x by -a (matches deformLid's rotation). */
export function rotateNormal(nx: number, ny: number, nz: number, a: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return out.set(nx, ny * c + nz * s, -ny * s + nz * c)
}
