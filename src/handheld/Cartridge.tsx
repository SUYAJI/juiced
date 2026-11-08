import { useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { BACK_Z, CART, CART_BULGE, TOP_Y } from './dims'
import { cartLabelTexture, cartNubTexture } from './textures'

const CART_COLOR = '#3a3842'
const BULGE_COLOR = '#25232b'

/**
 * A chunky rumble-style cartridge seated in the slot. Its label shows above
 * the body on the back; the rounded rumble bulge fills the back window.
 */
export function Cartridge() {
  const label = useMemo(() => cartLabelTexture(), [])
  const nub = useMemo(() => cartNubTexture(), [])
  useEffect(
    () => () => {
      label.dispose()
      nub.dispose()
    },
    [label, nub],
  )

  const h = CART.top - CART.bottom
  const cy = (CART.top + CART.bottom) / 2
  const backFace = BACK_Z + 0.1
  const cz = backFace + CART.d / 2

  const bh = CART_BULGE.top - CART_BULGE.bottom
  const by = (CART_BULGE.top + CART_BULGE.bottom) / 2
  const bz = backFace - CART_BULGE.d / 2 + 0.05

  // Label covers the part of the cart above the body
  const labelBottom = TOP_Y + 0.12
  const labelTop = CART.top - 0.2
  const labelH = labelTop - labelBottom
  const labelY = (labelTop + labelBottom) / 2

  return (
    <group>
      <RoundedBox args={[CART.w, h, CART.d]} radius={0.12} smoothness={3} position={[0, cy, cz]}>
        <meshStandardMaterial color={CART_COLOR} roughness={0.72} />
      </RoundedBox>

      {/* Rumble bulge on the back, filling the window */}
      <RoundedBox args={[CART_BULGE.w, bh, CART_BULGE.d + 0.1]} radius={0.22} smoothness={4} position={[0, by, bz]}>
        <meshStandardMaterial color={BULGE_COLOR} roughness={0.55} />
      </RoundedBox>
      {/* latch notch on the bulge */}
      <mesh position={[0, CART_BULGE.top - 0.35, bz - CART_BULGE.d / 2 - 0.051]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.0, 0.32]} />
        <meshStandardMaterial color="#141218" roughness={0.9} />
      </mesh>

      {/* Label on the back face, above the body */}
      <mesh position={[0, labelY, backFace - 0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CART.w - 0.4, labelH]} />
        <meshStandardMaterial map={label} roughness={0.55} />
      </mesh>

      {/* Embossed name on the front face of the cart, seen above the screen */}
      <mesh position={[0, TOP_Y + 0.55, cz + CART.d / 2 + 0.003]}>
        <planeGeometry args={[2.4, 0.46]} />
        <meshBasicMaterial map={nub} transparent toneMapped={false} />
      </mesh>
      {/* Grip ridges along the top edge, front side */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, CART.top - 0.25 - i * 0.16, cz + CART.d / 2 + 0.003]}>
          <planeGeometry args={[CART.w - 0.8, 0.05]} />
          <meshStandardMaterial color="#26242c" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
