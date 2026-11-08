import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LB } from './dims'
import { vnoise } from './surface'

// What's packed in the bottom compartment, besides the handheld: lunch
// wrapped in wax paper, a pair of thin-band headphones with black/grey
// foam, and the small portable FM radio they went with (kept unbranded).
// Shapes and colours are approximations from description, not photographs.

const FLOOR = LB.T + 0.02

export const SANDWICH = { x: -3.6, z: 1.3, w: 11.6, h: 3.5, d: 9.6, yaw: -0.05 }
/** The radio: about 6 x 9 x 2 cm, flat on the floor, back right. */
export const RADIO = { x: 6.5, y: FLOOR + 1.0, z: -2.5, w: 5.6, h: 2.0, d: 8.4 }

/** Wax-paper bundle: a soft block with crinkles, a top fold and tucked ends. */
function sandwichGeometry(): THREE.BufferGeometry {
  const { w, h, d } = SANDWICH
  const g = new THREE.BoxGeometry(w, h, d, 36, 10, 28)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    // round it off like a filled wrap
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
    // the filling makes the top dome a little; paper crinkles everywhere
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
    const band = new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.28, metalness: 0.85 })
    const housing = new THREE.MeshStandardMaterial({ color: '#2c2c31', roughness: 0.5, metalness: 0.1 })
    const foam = new THREE.MeshStandardMaterial({ color: '#3d3c42', roughness: 1 })
    const cord = new THREE.MeshStandardMaterial({ color: '#141417', roughness: 0.6 })
    const plug = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.3, metalness: 0.9 })

    const sandwich = sandwichGeometry()
    const flap = flapGeometry()
    const tapeStrip = new THREE.BoxGeometry(0.02, 0.03, 1)

    // radio flat on the floor at the back of the +x end; headphones with
    // one cup on the floor at the front and one resting on the radio
    const cupA = new THREE.Vector3(6.1, FLOOR, 3.5)
    const cupB = new THREE.Vector3(6.3, RADIO.y + RADIO.h / 2 + 0.02, RADIO.z - 0.4)
    const bandCurve = new THREE.CatmullRomCurve3([
      cupA.clone().add(new THREE.Vector3(2.1, 1.0, -0.3)),
      new THREE.Vector3(10.1, FLOOR + 2.2, 1.9),
      new THREE.Vector3(10.6, FLOOR + 3.5, -0.4),
      new THREE.Vector3(9.9, FLOOR + 3.9, -2.4),
      cupB.clone().add(new THREE.Vector3(2.15, 1.0, 0.2)),
    ])
    const bandGeo = new THREE.TubeGeometry(bandCurve, 60, 0.13, 8, false)
    const bandGeo2 = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(bandCurve.getPoints(40).map((p) => p.clone().add(new THREE.Vector3(-0.32, -0.05, 0)))),
      60,
      0.09,
      6,
      false,
    )
    // cord from the front cup, a loose loop on the floor, into the radio's
    // headphone socket on its front end
    const jack = new THREE.Vector3(RADIO.x - 1.4, RADIO.y + 0.35, RADIO.z + RADIO.d / 2 + 0.05)
    const cordCurve = new THREE.CatmullRomCurve3(
      [
        cupA.clone().add(new THREE.Vector3(-1.9, 0.4, -0.6)),
        new THREE.Vector3(3.2, FLOOR + 0.2, 2.2),
        new THREE.Vector3(2.9, FLOOR + 0.2, 4.9),
        new THREE.Vector3(5.0, FLOOR + 0.25, 5.8),
        new THREE.Vector3(4.3, FLOOR + 0.3, 3.6),
        new THREE.Vector3(3.6, FLOOR + 0.3, 2.0),
        jack.clone().add(new THREE.Vector3(-0.2, -0.2, 1.4)),
        jack.clone().add(new THREE.Vector3(0, 0, 0.6)),
      ],
      false,
      'centripetal',
    )
    const cordGeo = new THREE.TubeGeometry(cordCurve, 140, 0.07, 6, false)
    const plugGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 10).rotateX(Math.PI / 2).translate(jack.x, jack.y, jack.z + 0.35)

    // radio front panel: tuning window, FM scale, small speaker holes
    const face = (() => {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 384
      const x = c.getContext('2d')!
      x.fillStyle = '#1c1c20'
      x.fillRect(0, 0, 256, 384)
      x.fillStyle = '#c9c5b4'
      x.fillRect(28, 40, 200, 70)
      x.fillStyle = '#2a2a2e'
      x.font = '700 22px "Helvetica Neue", Arial, sans-serif'
      x.fillText('88  92  96  100  104  108', 34, 84)
      x.fillStyle = '#c0392b'
      x.fillRect(118, 46, 3, 58)
      x.fillStyle = '#d8d8dc'
      x.font = '800 30px "Helvetica Neue", Arial, sans-serif'
      x.fillText('FM', 28, 160)
      x.font = '600 18px "Helvetica Neue", Arial, sans-serif'
      x.fillText('STEREO RADIO', 90, 156)
      x.fillStyle = '#0d0d10'
      for (let r = 0; r < 7; r++) for (let k = 0; k < 7; k++) {
        x.beginPath()
        x.arc(70 + k * 19, 205 + r * 19, 5, 0, Math.PI * 2)
        x.fill()
      }
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    })()
    const radioBody = new THREE.MeshStandardMaterial({ color: '#a7a9ad', roughness: 0.4, metalness: 0.35 })
    const radioFace = new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 })

    return {
      face,
      mats: { paper, tape, band, housing, foam, cord, plug, radioBody, radioFace },
      geos: { sandwich, flap, tapeStrip, bandGeo, bandGeo2, cordGeo, plugGeo },
      cups: [cupA, cupB],
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(parts.mats).forEach((m) => m.dispose())
      Object.values(parts.geos).forEach((g) => g.dispose())
      parts.face.dispose()
    },
    [parts],
  )

  const { mats, geos, cups } = parts
  const S = SANDWICH
  return (
    <group>
      {/* lunch, wrapped in wax paper, flat on the bottom */}
      <group position={[S.x, FLOOR + S.h / 2, S.z]} rotation={[0, S.yaw, 0]}>
        <mesh geometry={geos.sandwich} material={mats.paper} castShadow receiveShadow />
        <mesh geometry={geos.flap} material={mats.paper} position={[S.w / 2 + 0.05, -S.h / 2 + 0.1, 0]} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={geos.flap} material={mats.paper} position={[-S.w / 2 - 0.05, -S.h / 2 + 0.1, 0]} rotation={[0, -Math.PI / 2, 0]} />
        <mesh position={[S.w / 2 - 1.2, S.h / 2 + 0.36, 0]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[1.0, 0.03, 3.4]} />
          <primitive object={mats.tape} attach="material" />
        </mesh>
      </group>

      {/* headphones: thin metal band, small cups, foam pads facing up */}
      <mesh geometry={geos.bandGeo} material={mats.band} castShadow />
      <mesh geometry={geos.bandGeo2} material={mats.band} castShadow />
      {cups.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} rotation={[0, i ? 0.3 : -0.2, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[2.0, 2.05, 0.6, 32]} />
            <primitive object={mats.housing} attach="material" />
          </mesh>
          <mesh position={[0, 0.75, 0]} scale={[2.3, 0.55, 2.3]} castShadow receiveShadow>
            <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <primitive object={mats.foam} attach="material" />
          </mesh>
        </group>
      ))}
      {/* portable FM radio, lying face up */}
      <group position={[RADIO.x, RADIO.y, RADIO.z]} rotation={[0, 0.06, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[RADIO.w, RADIO.h, RADIO.d]} />
          <primitive object={mats.radioBody} attach="material" />
        </mesh>
        <mesh position={[0, RADIO.h / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[RADIO.w - 0.5, RADIO.d - 0.6]} />
          <primitive object={mats.radioFace} attach="material" />
        </mesh>
        {/* tuning and volume wheels on the side, belt clip underneath */}
        <mesh position={[RADIO.w / 2 + 0.05, 0.1, -1.4]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.8, 0.8, 0.3, 20]} />
          <primitive object={mats.housing} attach="material" />
        </mesh>
        <mesh position={[RADIO.w / 2 + 0.05, 0.1, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.65, 0.65, 0.3, 20]} />
          <primitive object={mats.housing} attach="material" />
        </mesh>
        <mesh position={[0, -RADIO.h / 2 - 0.08, -0.8]}>
          <boxGeometry args={[2.4, 0.12, 5.2]} />
          <primitive object={mats.housing} attach="material" />
        </mesh>
      </group>

      <mesh geometry={geos.cordGeo} material={mats.cord} castShadow />
      <mesh geometry={geos.plugGeo} material={mats.plug} />
    </group>
  )
}
