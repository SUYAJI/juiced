import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { SceneAnim } from '../experience/anim'
import { buildLunchbox, ribbon, samplePath, tube, type SurfacePath } from './build'
import { HANDLE } from './dims'
import { deformLid, rotateNormal, type LidPose } from './surface'
import { Contents } from './Contents'
import { fabricNormalTexture, zipperTexture } from './textures'

const base = import.meta.env.BASE_URL
// BoxGeometry material order: +x, -x, +y, -y, +z, -z
export const PANEL_URLS = [
  `${base}lunchbox/panel-end-right.jpg`,
  `${base}lunchbox/panel-end-left.jpg`,
  `${base}lunchbox/panel-top.jpg`,
  `${base}lunchbox/panel-bottom.jpg`,
  `${base}lunchbox/panel-front.jpg`,
  `${base}lunchbox/panel-back.jpg`,
]
// normal map repeats per panel (one tile = 4 cm)
const PANEL_REPEAT: [number, number][] = [
  [4, 4],
  [4, 4],
  [6, 4],
  [6, 4],
  [6, 4],
  [6, 4],
]

const FABRIC = '#cf920f'
const BLACK = '#1a191d'

interface Props {
  anim: SceneAnim
  onBoxClick: (part: 'lid' | 'base') => void
  onHover: (over: boolean) => void
}

/**
 * Keeps rest copies of every geometry attached to the upper section and
 * re-applies the soft-hinge deformation when the pose changes.
 */
class LidDeformer {
  private items: { g: THREE.BufferGeometry; rp: Float32Array; rn: Float32Array | null }[] = []
  private last = { theta: -1, vel: 0, open: -1 }

  add(g: THREE.BufferGeometry) {
    const rp = (g.getAttribute('position').array as Float32Array).slice()
    const na = g.getAttribute('normal')
    const rn = na ? (na.array as Float32Array).slice() : null
    this.items.push({ g, rp, rn })
    return g
  }

  apply(pose: LidPose) {
    if (
      Math.abs(pose.theta - this.last.theta) < 1e-4 &&
      Math.abs(pose.vel - this.last.vel) < 1e-3 &&
      Math.abs(pose.open - this.last.open) < 1e-4
    )
      return
    this.last = { ...pose }
    const o = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (const it of this.items) {
      const pa = it.g.getAttribute('position') as THREE.BufferAttribute
      const na = it.g.getAttribute('normal') as THREE.BufferAttribute | undefined
      const P = pa.array as Float32Array
      const N = na ? (na.array as Float32Array) : null
      for (let i = 0; i < pa.count; i++) {
        const a = deformLid(it.rp[i * 3], it.rp[i * 3 + 1], it.rp[i * 3 + 2], pose, o)
        P[i * 3] = o.x
        P[i * 3 + 1] = o.y
        P[i * 3 + 2] = o.z
        if (N && it.rn) {
          rotateNormal(it.rn[i * 3], it.rn[i * 3 + 1], it.rn[i * 3 + 2], a, n)
          N[i * 3] = n.x
          N[i * 3 + 1] = n.y
          N[i * 3 + 2] = n.z
        }
      }
      pa.needsUpdate = true
      if (na) na.needsUpdate = true
      it.g.computeBoundingSphere()
    }
  }

  dispose() {
    this.items.forEach((it) => it.g.dispose())
    this.items = []
  }
}

/** Transform a geometry into place: up axis -> n, centred at p. */
function placed(g: THREE.BufferGeometry, p: THREE.Vector3, n: THREE.Vector3, yaw = 0): THREE.BufferGeometry {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  const m = new THREE.Matrix4().compose(p, q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)), new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(m)
  return g
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function extrudeAlong(points: THREE.Vector3[], w: number, t: number, r: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const g = new THREE.ExtrudeGeometry(roundedRectShape(t, w, r), {
    steps: Math.max(6, Math.round(curve.getLength() / 0.3)),
    bevelEnabled: false,
    extrudePath: curve,
  })
  g.computeVertexNormals()
  return g
}

export function Lunchbox({ anim, onBoxClick, onHover }: Props) {
  const maps = useTexture(PANEL_URLS)

  const built = useMemo(() => {
    const geo = buildLunchbox()
    const deformer = new LidDeformer()

    // ---- materials
    const fabricNormal = fabricNormalTexture()
    const panels = maps.map((m, i) => {
      m.colorSpace = THREE.SRGBColorSpace
      m.anisotropy = 8
      const nm = fabricNormal.clone()
      nm.repeat.set(...PANEL_REPEAT[i])
      nm.needsUpdate = true
      return new THREE.MeshPhysicalMaterial({
        map: m,
        normalMap: nm,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.88,
        sheen: 0.6,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color('#ffe2a0'),
      })
    })
    const handleNormal = fabricNormal.clone()
    handleNormal.repeat.set(0.3, 0.3)
    handleNormal.needsUpdate = true
    const fabric = new THREE.MeshPhysicalMaterial({
      color: FABRIC,
      normalMap: handleNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.9,
      sheen: 0.6,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color('#ffe2a0'),
    })
    const piping = new THREE.MeshPhysicalMaterial({
      color: '#c99419',
      roughness: 0.85,
      sheen: 0.4,
      sheenColor: new THREE.Color('#ffe2a0'),
    })
    // insulated lining: a soft silvery grey (approximation; not photographed)
    const lining = new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.38, metalness: 0.35 })
    const zipTex = zipperTexture()
    const zipper = new THREE.MeshStandardMaterial({ map: zipTex, bumpMap: zipTex, bumpScale: 0.6, roughness: 0.55, color: '#ffffff', side: THREE.DoubleSide })
    const tape = new THREE.MeshStandardMaterial({ color: '#17161a', roughness: 0.8 })
    const webbingNormal = fabricNormal.clone()
    webbingNormal.repeat.set(0.8, 0.8)
    webbingNormal.needsUpdate = true
    const webbing = new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.85, normalMap: webbingNormal, normalScale: new THREE.Vector2(0.8, 0.8) })
    const plastic = new THREE.MeshStandardMaterial({ color: '#2a292f', roughness: 0.45, metalness: 0.15 })
    const metal = new THREE.MeshStandardMaterial({ color: '#46454c', roughness: 0.35, metalness: 0.7 })
    const gap = new THREE.MeshBasicMaterial({ color: '#060508', side: THREE.DoubleSide })

    // ---- upper section (deformed together)
    const lidOuter = deformer.add(geo.lidOuter)
    const lidInner = deformer.add(geo.lidInner)
    const lidRim = deformer.add(geo.lidRim)
    const lidZip = deformer.add(ribbon(geo.zipper, 0, 0.45, 0.13, 0.32, 0.5, 1))
    const lidPiping = geo.pipingLid.map((pts) => deformer.add(tube(pts, 0.17)))

    // handle: black webbing ends looping through D-rings, padded fabric middle
    const [A, B] = geo.handleAnchors
    const topY = (A.p.y + B.p.y) / 2
    const arc = new THREE.CatmullRomCurve3(
      [
        A.p.clone().addScaledVector(A.n, 0.15),
        new THREE.Vector3(A.p.x + 0.7, topY + 2.2, 0),
        new THREE.Vector3(-4.2, topY + HANDLE.rise - 0.15, 0.25),
        new THREE.Vector3(0.6, topY + HANDLE.rise + 0.1, 0.35),
        new THREE.Vector3(4.6, topY + HANDLE.rise - 0.45, 0.15),
        new THREE.Vector3(B.p.x - 0.7, topY + 2.2, 0),
        B.p.clone().addScaledVector(B.n, 0.15),
      ],
      false,
      'centripetal',
    )
    const arcPts = arc.getSpacedPoints(120)
    const handlePad = deformer.add(extrudeAlong(arcPts.slice(7, 114), HANDLE.width, HANDLE.thick, 0.52))
    const handleWebL = deformer.add(extrudeAlong(arcPts.slice(0, 10), 2.5, 0.22, 0.08))
    const handleWebR = deformer.add(extrudeAlong(arcPts.slice(111), 2.5, 0.22, 0.08))

    // handle ends are sewn down with black webbing tabs
    const tabs = [A, B].map(({ p, n }) => deformer.add(placed(new THREE.BoxGeometry(2.6, 0.14, 2.9), p.clone().addScaledVector(n, 0.06), n)))

    // strap D-rings at the top corners of each end, on short webbing loops;
    // the D lies in the end's plane with its curve pointing outward
    const rings = geo.strapAnchors.map(({ p, n }) => {
      const ring = new THREE.TorusGeometry(1.25, 0.17, 8, 24, Math.PI).rotateZ(-Math.PI / 2) // arc toward +x
      const bar = new THREE.CylinderGeometry(0.17, 0.17, 2.5, 8) // straight side along y
      const merged = mergeGeometries([ring, bar]).translate(0.55, 0, 0)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), n)
      merged.applyQuaternion(q).translate(p.x + n.x * 0.15, p.y + n.y * 0.15, p.z + n.z * 0.15)
      return deformer.add(merged)
    })
    const loops = geo.strapAnchors.map(({ p, n }) => {
      const g = new THREE.BoxGeometry(1.3, 2.3, 0.14).translate(0.4, 0, 0)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), n)
      return deformer.add(g.applyQuaternion(q).translate(p.x + n.x * 0.08, p.y + n.y * 0.08, p.z + n.z * 0.08))
    })

    // ---- base (static)
    const baseZip = ribbon(geo.zipper, -0.45, 0, 0.13, 0.32, 0, 0.5)
    // front pocket zipper and its pull, on the bottom compartment
    const pocketZip = ribbon(geo.pocketZip, -0.3, 0.3, 0.1, 0.32)
    const pz = samplePath(geo.pocketZip, 0.97)
    const pocketPull = new THREE.BoxGeometry(0.5, 1.4, 0.16).translate(0, -0.8, 0).translate(pz.p.x + pz.n.x * 0.2, pz.p.y, pz.p.z + pz.n.z * 0.2)
    const gapStrip = ribbon(geo.zipper, -0.08, 0.08, 0.17, 1)
    const basePiping = geo.pipingBase.map((pts) => tube(pts, 0.17))

    // slider + pull
    const slider = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.36), metal)
    body.position.z = 0.2
    const pullPivot = new THREE.Group()
    pullPivot.position.set(0, -0.25, 0.34)
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 0.18).translate(0, -0.8, 0), webbing)
    pullPivot.add(pull)
    slider.add(body, pullPivot)
    slider.traverse((o) => ((o as THREE.Mesh).castShadow = true))

    return {
      geo,
      deformer,
      panels,
      mats: { fabric, piping, lining, zipper, tape, webbing, plastic, metal, gap },
      lid: { lidOuter, lidInner, lidRim, lidZip, lidPiping, handlePad, handleWebL, handleWebR, rings, tabs, loops },
      base: { baseZip, gapStrip, basePiping, pocketZip, pocketPull },
      slider,
      pullPivot,
      textures: [fabricNormal, handleNormal, webbingNormal, zipTex],
    }
  }, [maps])

  useEffect(
    () => () => {
      built.deformer.dispose()
      const { geo } = built
      ;[geo.baseOuter, geo.baseInner, geo.baseRim, built.base.baseZip, built.base.gapStrip, built.base.pocketZip, built.base.pocketPull, ...built.base.basePiping].forEach((g) => g.dispose())
      Object.values(built.mats).forEach((m) => m.dispose())
      built.panels.forEach((m) => {
        m.normalMap?.dispose()
        m.dispose()
      })
      built.textures.forEach((t) => t.dispose())
    },
    [built],
  )

  const root = useRef<THREE.Group>(null)
  const gapMesh = useRef<THREE.Mesh>(null)
  const gapIndexCount = built.base.gapStrip.getIndex()!.count

  useFrame(({ clock }) => {
    built.deformer.apply({ theta: anim.theta, vel: anim.vel, open: anim.open })

    // zipper slider follows the unzip progress
    const s = samplePath(built.geo.zipper, anim.unzip)
    const m = new THREE.Matrix4().makeBasis(s.tan, new THREE.Vector3().crossVectors(s.n, s.tan).normalize(), s.n)
    built.slider.position.copy(s.p).addScaledVector(s.n, 0.1)
    built.slider.quaternion.setFromRotationMatrix(m)
    // pull swings: a little idle sway, more when hovered or moving
    const t = clock.elapsedTime
    built.pullPivot.rotation.x = 0.12 + Math.sin(t * 2.1) * (0.04 * anim.idle + 0.22 * anim.hoverBox)

    // opened part of the zipper shows the dark gap behind the teeth
    const segs = Math.floor((gapIndexCount / 6) * anim.unzip)
    built.base.gapStrip.setDrawRange(0, segs * 6)
    if (gapMesh.current) gapMesh.current.visible = anim.open < 0.15 && anim.unzip > 0

    // closed-state hover: the bag puffs very slightly
    const g = root.current
    if (g) {
      const k = 1 + 0.012 * anim.hoverBox
      g.scale.set(k, 1 + 0.008 * anim.hoverBox, k)
    }
  })

  const click = (part: 'lid' | 'base') => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return // was a drag to look around
    e.stopPropagation()
    onBoxClick(part)
  }
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(true)
  }
  const out = () => onHover(false)
  const noRay = () => null
  const { lid, base: b, mats } = built

  return (
    <group ref={root}>
      <group onClick={click('base')} onPointerOver={over} onPointerOut={out}>
        <mesh geometry={built.geo.baseOuter} material={built.panels} castShadow receiveShadow />
        <mesh geometry={built.geo.baseInner} material={mats.lining} receiveShadow />
        <mesh geometry={built.geo.baseRim} material={mats.tape} />
        <mesh geometry={b.baseZip} material={mats.zipper} raycast={noRay} />
        <mesh ref={gapMesh} geometry={b.gapStrip} material={mats.gap} raycast={noRay} />
        {b.basePiping.map((g, i) => (
          <mesh key={i} geometry={g} material={mats.piping} castShadow raycast={noRay} />
        ))}
        <mesh geometry={b.pocketZip} material={mats.zipper} raycast={noRay} />
        <mesh geometry={b.pocketPull} material={mats.webbing} castShadow raycast={noRay} />
        <primitive object={built.slider} />
        <Contents />
      </group>

      <group onClick={click('lid')} onPointerOver={over} onPointerOut={out}>
        <mesh geometry={lid.lidOuter} material={built.panels} castShadow receiveShadow />
        <mesh geometry={lid.lidInner} material={mats.lining} receiveShadow />
        <mesh geometry={lid.lidRim} material={mats.tape} />
        <mesh geometry={lid.lidZip} material={mats.zipper} raycast={noRay} />
        {lid.lidPiping.map((g, i) => (
          <mesh key={i} geometry={g} material={mats.piping} castShadow raycast={noRay} />
        ))}
        <mesh geometry={lid.handlePad} material={mats.fabric} castShadow />
        <mesh geometry={lid.handleWebL} material={mats.webbing} castShadow />
        <mesh geometry={lid.handleWebR} material={mats.webbing} castShadow />
        {lid.rings.map((g, i) => (
          <mesh key={`r${i}`} geometry={g} material={mats.plastic} castShadow />
        ))}
        {lid.tabs.map((g, i) => (
          <mesh key={`t${i}`} geometry={g} material={mats.webbing} />
        ))}
        {lid.loops.map((g, i) => (
          <mesh key={`l${i}`} geometry={g} material={mats.webbing} castShadow />
        ))}
      </group>
    </group>
  )
}

/** Minimal merge (position + normal + uv) without pulling in addons. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const P: number[] = []
  const N: number[] = []
  const U: number[] = []
  const I: number[] = []
  let offset = 0
  for (const g0 of list) {
    const g = g0.index ? g0 : g0
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const u = g.getAttribute('uv')
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i))
      N.push(n.getX(i), n.getY(i), n.getZ(i))
      U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0)
    }
    const idx = g.getIndex()
    if (idx) for (let i = 0; i < idx.count; i++) I.push(idx.getX(i) + offset)
    else for (let i = 0; i < p.count; i++) I.push(i + offset)
    offset += p.count
    g0.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  out.setIndex(I)
  return out
}

export type { SurfacePath }

