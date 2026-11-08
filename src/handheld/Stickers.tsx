import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { FRONT_Z, PLANET, STICKER_1, STICKER_2 } from './dims'

const base = import.meta.env.BASE_URL
export const STICKER_URLS = {
  one: `${base}stickers/sticker-1.png`,
  two: `${base}stickers/sticker-2.png`,
  planet: `${base}stickers/sticker-planet.png`,
}

/**
 * The three holographic stickers, cut from the photograph of the real
 * device. A faint, slowly moving emissive term stands in for the glitter.
 */
export function Stickers() {
  const [one, two, planet] = useTexture([STICKER_URLS.one, STICKER_URLS.two, STICKER_URLS.planet])
  useMemo(() => {
    for (const t of [one, two, planet]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
    }
  }, [one, two, planet])

  return (
    <group>
      <Sticker map={one} x={STICKER_1.x} y={STICKER_1.y} w={STICKER_1.size} h={STICKER_1.size} phase={0} />
      <Sticker map={two} x={STICKER_2.x} y={STICKER_2.y} w={STICKER_2.size} h={STICKER_2.size} phase={2.1} />
      <Sticker map={planet} x={PLANET.x} y={PLANET.y} w={PLANET.w} h={PLANET.h} rot={PLANET.rot} phase={4.2} />
    </group>
  )
}

function Sticker({ map, x, y, w, h, rot = 0, phase }: { map: THREE.Texture; x: number; y: number; w: number; h: number; rot?: number; phase: number }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const m = mat.current
    if (!m) return
    const t = clock.elapsedTime
    m.emissiveIntensity = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.7 + phase))
  })
  useEffect(() => () => mat.current?.dispose(), [])
  return (
    <mesh position={[x, y, FRONT_Z + 0.007]} rotation={[0, 0, rot]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial
        ref={mat}
        map={map}
        transparent
        alphaTest={0.03}
        roughness={0.32}
        metalness={0.45}
        emissive="#ffffff"
        emissiveMap={map}
        emissiveIntensity={0.15}
        envMapIntensity={1.4}
      />
    </mesh>
  )
}
