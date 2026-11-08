import * as THREE from 'three'
import { HANDLE, LB, POCKET, STRAP_RING_Y } from './dims'
import { FACE_ORDER, softSurface, type Face } from './surface'

/** A path along the surface: positions, outward normals, cumulative length. */
export interface SurfacePath {
  points: THREE.Vector3[]
  normals: THREE.Vector3[]
  lengths: number[]
  total: number
}

export interface LunchboxGeometry {
  lidOuter: THREE.BufferGeometry
  lidInner: THREE.BufferGeometry
  baseOuter: THREE.BufferGeometry
  baseInner: THREE.BufferGeometry
  lidRim: THREE.BufferGeometry
  baseRim: THREE.BufferGeometry
  /** Main zipper: from the back corner of the +x end, round the front, to the -x back corner. */
  zipper: SurfacePath
  /** Seam piping around each end panel, split at the zipper line. */
  pipingLid: THREE.Vector3[][]
  pipingBase: THREE.Vector3[][]
  /** The front pocket's zipper line (on the bottom compartment). */
  pocketZip: SurfacePath
  /** Surface point + normal for the strap D-rings at the top of each end. */
  strapAnchors: { p: THREE.Vector3; n: THREE.Vector3 }[]
  /** Surface point + normal at the two handle anchors (on the top). */
  handleAnchors: { p: THREE.Vector3; n: THREE.Vector3 }[]
}

const v = new THREE.Vector3()

/** Surface point and its (approximate) normal at a cuboid coordinate. */
export function surfacePointNormal(cx: number, cy: number, cz: number, face: Face) {
  const p = softSurface(cx, cy, cz, face, new THREE.Vector3())
  const e = 0.05
  // tangent directions in the face plane
  const [ax, bx] =
    face === 'px' || face === 'nx'
      ? [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)]
      : face === 'py' || face === 'ny'
        ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]
        : [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)]
  const pa = softSurface(cx + ax.x * e, cy + ax.y * e, cz + ax.z * e, face, new THREE.Vector3())
  const pb = softSurface(cx + bx.x * e, cy + bx.y * e, cz + bx.z * e, face, new THREE.Vector3())
  const n = new THREE.Vector3().crossVectors(pa.sub(p), pb.sub(p)).normalize()
  // orient outward
  const outward = new THREE.Vector3(cx, cy - LB.H / 2, cz)
  if (n.dot(outward) < 0) n.negate()
  return { p, n }
}

function toPath(points: THREE.Vector3[], normals: THREE.Vector3[]): SurfacePath {
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]))
  return { points, normals, lengths, total: lengths[lengths.length - 1] }
}

/** Sample a path at fraction t (0..1): position, normal, tangent. */
export function samplePath(path: SurfacePath, t: number) {
  const target = Math.min(1, Math.max(0, t)) * path.total
  let i = 1
  while (i < path.lengths.length - 1 && path.lengths[i] < target) i++
  const l0 = path.lengths[i - 1]
  const l1 = path.lengths[i]
  const k = l1 > l0 ? (target - l0) / (l1 - l0) : 0
  const p = path.points[i - 1].clone().lerp(path.points[i], k)
  const n = path.normals[i - 1].clone().lerp(path.normals[i], k).normalize()
  const tan = path.points[i].clone().sub(path.points[i - 1]).normalize()
  return { p, n, tan }
}

export function buildLunchbox(): LunchboxGeometry {
  const { W, H, D, ZIP_Y, T, SEG } = LB
  const box = new THREE.BoxGeometry(W, H, D, SEG.x, SEG.y, SEG.z)
  box.translate(0, H / 2, 0)
  const rest = box.getAttribute('position') as THREE.BufferAttribute
  const uv = box.getAttribute('uv') as THREE.BufferAttribute
  const index = box.getIndex()!
  const count = rest.count

  // face of each vertex
  const faceOf: Face[] = new Array(count)
  box.groups.forEach((g) => {
    for (let i = g.start; i < g.start + g.count; i++) faceOf[index.getX(i)] = FACE_ORDER[g.materialIndex!]
  })

  // displaced positions
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    softSurface(rest.getX(i), rest.getY(i), rest.getZ(i), faceOf[i], v)
    pos[i * 3] = v.x
    pos[i * 3 + 1] = v.y
    pos[i * 3 + 2] = v.z
  }

  // smooth normals across face seams: accumulate by cuboid position
  const key = (i: number) => `${rest.getX(i).toFixed(3)},${rest.getY(i).toFixed(3)},${rest.getZ(i).toFixed(3)}`
  const buckets = new Map<string, THREE.Vector3>()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let t = 0; t < index.count; t += 3) {
    const i0 = index.getX(t)
    const i1 = index.getX(t + 1)
    const i2 = index.getX(t + 2)
    a.fromArray(pos, i0 * 3)
    b.fromArray(pos, i1 * 3)
    c.fromArray(pos, i2 * 3)
    const fn = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a))
    for (const i of [i0, i1, i2]) {
      const k = key(i)
      const acc = buckets.get(k)
      if (acc) acc.add(fn)
      else buckets.set(k, fn.clone())
    }
  }
  const nrm = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const n = buckets.get(key(i))!.clone().normalize()
    nrm[i * 3] = n.x
    nrm[i * 3 + 1] = n.y
    nrm[i * 3 + 2] = n.z
  }

  // split triangles into lid (above the zipper) and base
  type Part = { tris: number[][]; groups: Map<number, number[]> }
  const lid: Part = { tris: [], groups: new Map() }
  const base: Part = { tris: [], groups: new Map() }
  box.groups.forEach((g) => {
    for (let t = g.start; t < g.start + g.count; t += 3) {
      const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      const cy = (rest.getY(tri[0]) + rest.getY(tri[1]) + rest.getY(tri[2])) / 3
      const part = cy > ZIP_Y ? lid : base
      const list = part.groups.get(g.materialIndex!) ?? []
      list.push(...tri)
      part.groups.set(g.materialIndex!, list)
    }
  })

  function makePart(part: Part, inner: boolean): THREE.BufferGeometry {
    const remap = new Map<number, number>()
    const P: number[] = []
    const N: number[] = []
    const U: number[] = []
    const I: number[] = []
    const g = new THREE.BufferGeometry()
    let start = 0
    for (let m = 0; m < 6; m++) {
      const list = part.groups.get(m)
      if (!list) continue
      for (let k = 0; k < list.length; k += 3) {
        const tri = inner ? [list[k], list[k + 2], list[k + 1]] : [list[k], list[k + 1], list[k + 2]]
        for (const old of tri) {
          let ni = remap.get(old)
          if (ni === undefined) {
            ni = P.length / 3
            remap.set(old, ni)
            const nx = nrm[old * 3]
            const ny = nrm[old * 3 + 1]
            const nz = nrm[old * 3 + 2]
            const s = inner ? -T : 0
            P.push(pos[old * 3] + nx * s, pos[old * 3 + 1] + ny * s, pos[old * 3 + 2] + nz * s)
            N.push(inner ? -nx : nx, inner ? -ny : ny, inner ? -nz : nz)
            U.push(uv.getX(old), uv.getY(old))
          }
          I.push(ni)
        }
      }
      if (!inner) g.addGroup(start, list.length, m)
      start += list.length
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
    g.setIndex(I)
    g.computeBoundingSphere()
    return g
  }

  // rim loop at the zipper line (outer surface), ordered around the body
  const rimMap = new Map<string, { p: THREE.Vector3; n: THREE.Vector3; ang: number; x: number; z: number; face: Face }>()
  for (let i = 0; i < count; i++) {
    if (Math.abs(rest.getY(i) - ZIP_Y) > 1e-4) continue
    const f = faceOf[i]
    if (f === 'py' || f === 'ny') continue
    const k = key(i)
    if (rimMap.has(k)) continue
    const p = new THREE.Vector3().fromArray(pos, i * 3)
    const n = new THREE.Vector3().fromArray(nrm, i * 3)
    let ang = Math.atan2(p.z, p.x)
    if (ang < -1.65) ang += Math.PI * 2 // start just behind the +x end
    rimMap.set(k, { p, n, ang, x: rest.getX(i), z: rest.getZ(i), face: f })
  }
  const rim = [...rimMap.values()].sort((p, q) => p.ang - q.ang)

  function rimBand(facingUp: boolean): THREE.BufferGeometry {
    const P: number[] = []
    const N: number[] = []
    const I: number[] = []
    rim.forEach(({ p, n }) => {
      P.push(p.x, p.y, p.z, p.x - n.x * T, p.y - n.y * T, p.z - n.z * T)
      const ny = facingUp ? 1 : -1
      N.push(0, ny, 0, 0, ny, 0)
    })
    const m = rim.length
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m
      const o0 = i * 2
      const i0 = i * 2 + 1
      const o1 = j * 2
      const i1 = j * 2 + 1
      if (facingUp) I.push(o0, i0, o1, o1, i0, i1)
      else I.push(o0, o1, i0, o1, i1, i0)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
    g.setIndex(I)
    return g
  }

  // zipper: the rim without the back panel (the back is the fabric hinge),
  // wrapping just round the back corners
  const zipPts = rim.filter((r) => r.face !== 'nz' || Math.abs(r.x) > W / 2 - 2.6)
  // the filter keeps two back stubs; drop wrap-around so it is one run
  const zipper = resample(
    zipPts.map((r) => r.p),
    zipPts.map((r) => r.n),
    0.12,
  )

  // end panel piping: around the ±x face boundary of the cuboid
  const pipingLid: THREE.Vector3[][] = []
  const pipingBase: THREE.Vector3[][] = []
  for (const sx of [1, -1]) {
    const face: Face = sx > 0 ? 'px' : 'nx'
    const x = (sx * W) / 2
    const up: THREE.Vector3[] = []
    // lid part: front zip line -> up front edge -> across top -> down back edge
    for (let y = ZIP_Y; y <= H; y += 0.25) up.push(softSurface(x, y, D / 2, face, new THREE.Vector3()))
    for (let z = D / 2; z >= -D / 2; z -= 0.25) up.push(softSurface(x, H, z, face, new THREE.Vector3()))
    for (let y = H; y >= ZIP_Y; y -= 0.25) up.push(softSurface(x, y, -D / 2, face, new THREE.Vector3()))
    const low: THREE.Vector3[] = []
    for (let y = ZIP_Y; y >= 0; y -= 0.25) low.push(softSurface(x, y, D / 2, face, new THREE.Vector3()))
    for (let z = D / 2; z >= -D / 2; z -= 0.25) low.push(softSurface(x, 0, z, face, new THREE.Vector3()))
    for (let y = 0; y <= ZIP_Y; y += 0.25) low.push(softSurface(x, y, -D / 2, face, new THREE.Vector3()))
    pipingLid.push(up)
    pipingBase.push(low)
  }

  // front pocket zipper, straight across the bottom compartment
  const pzP: THREE.Vector3[] = []
  const pzN: THREE.Vector3[] = []
  for (let x = POCKET.x0; x <= POCKET.x1; x += 0.15) {
    const sp = surfacePointNormal(x, POCKET.zipY, D / 2, 'pz')
    pzP.push(sp.p)
    pzN.push(sp.n)
  }
  const pocketZip = toPath(pzP, pzN)

  const strapAnchors = [-1, 1].map((sx) => surfacePointNormal((sx * W) / 2, STRAP_RING_Y, 0, sx > 0 ? 'px' : 'nx'))

  const handleAnchors = [-HANDLE.x, HANDLE.x].map((x) => surfacePointNormal(x, H, 0, 'py'))

  box.dispose()
  return {
    lidOuter: makePart(lid, false),
    lidInner: makePart(lid, true),
    baseOuter: makePart(base, false),
    baseInner: makePart(base, true),
    lidRim: rimBand(false),
    baseRim: rimBand(true),
    zipper,
    pipingLid,
    pipingBase,
    pocketZip,
    strapAnchors,
    handleAnchors,
  }
}

/** Smooth a polyline with a Catmull-Rom curve and resample it evenly. */
function resample(points: THREE.Vector3[], normals: THREE.Vector3[], step: number): SurfacePath {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const n = Math.max(2, Math.round(curve.getLength() / step))
  const P = curve.getSpacedPoints(n)
  // carry normals across by nearest source point
  const N = P.map((p) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = points[i].distanceToSquared(p)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return normals[best].clone()
  })
  return toPath(P, N)
}

// ---- ribbons and tubes ---------------------------------------------------

/**
 * A strip that follows a surface path. `from`/`to` are vertical offsets
 * (cm, along world up) and `out` lifts it off the surface. u runs along the
 * path in units of `uScale` cm; v spans vFrom..vTo.
 */
export function ribbon(
  path: SurfacePath,
  from: number,
  to: number,
  out: number,
  uScale: number,
  vFrom = 0,
  vTo = 1,
): THREE.BufferGeometry {
  const P: number[] = []
  const N: number[] = []
  const U: number[] = []
  const I: number[] = []
  path.points.forEach((p, i) => {
    const n = path.normals[i]
    for (const [off, vv] of [
      [from, vFrom],
      [to, vTo],
    ]) {
      P.push(p.x + n.x * out, p.y + n.y * out + off, p.z + n.z * out)
      N.push(n.x, n.y, n.z)
      U.push(path.lengths[i] / uScale, vv)
    }
  })
  for (let i = 0; i < path.points.length - 1; i++) {
    const a0 = i * 2
    const a1 = a0 + 1
    const b0 = a0 + 2
    const b1 = a0 + 3
    I.push(a0, b0, a1, a1, b0, b1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  g.setIndex(I)
  return g
}

export function tube(points: THREE.Vector3[], radius: number, closed = false): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal')
  const segs = Math.max(8, Math.round(curve.getLength() / 0.25))
  return new THREE.TubeGeometry(curve, segs, radius, 8, closed)
}
