import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FRONT_Z, LCD } from './dims'
import { useHandheld } from './context'

/**
 * The live game canvas as a texture on the LCD. Pixels stay crisp: nearest
 * magnification, no mipmaps, and the plane keeps the 160:144 ratio.
 */
export function Screen() {
  const { gameCanvas, renderer } = useHandheld()

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(gameCanvas)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearFilter
    t.generateMipmaps = false
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [gameCanvas])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame(() => {
    renderer.renderFrame(performance.now())
    texture.needsUpdate = true
  })

  return (
    <group position={[LCD.x, LCD.y, FRONT_Z]}>
      {/* LCD surface, recessed below the bezel face */}
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[LCD.w, LCD.h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* a hair of dark glass edge around the panel so the recess reads */}
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[LCD.w + 0.12, LCD.h + 0.12]} />
        <meshStandardMaterial color="#0c0b10" roughness={0.6} />
      </mesh>
    </group>
  )
}
