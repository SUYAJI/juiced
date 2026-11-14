import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useHandheld } from './context'
import { BACK_Z, CART, CART_BULGE, TOP_Y } from './dims'
import { cartLabelTexture, cartNubTexture } from './textures'

const CART_COLOR = '#3a3842'
const BULGE_COLOR = '#25232b'

/**
 * A chunky rumble-style cartridge seated in the slot. Its label shows above
 * the body on the back; the rounded rumble bulge fills the back window.
 */
export function Cartridge() {
  const { parts, isActive, isFlipped, sfx } = useHandheld()
  const g = useRef<THREE.Group>(null)
  const k = useRef(0)
  useFrame((_, dt) => {
    const grp = g.current
    if (!grp) return
    const out = parts.get().cart
    k.current += ((out ? 1 : 0) - k.current) * (1 - Math.exp(-8 * Math.min(dt, 0.1)))
    const e = k.current
    // slides straight up out of the slot, then tips back a little
    grp.position.set(0, 3.1 * e, 0.5 * e)
    grp.rotation.set(0.12 * e, 0, 0.06 * e)
  })
  // Removed from the back only (its bulge sits behind the screen, so a front
  // click on the screen must never pull it). Once out, it can be pushed back
  // in from either side.
  const usable = () => isActive() && (isFlipped() || parts.get().cart)
  const click = (e: ThreeEvent<PointerEvent>) => {
    if (!usable()) return
    e.stopPropagation()
    const nowOut = parts.toggleCart()
    sfx(nowOut ? 'cartOut' : 'cartIn')
    if (nowOut) parts.spawn({ origin: [0, TOP_Y - 0.2, 0], side: 'back', count: 9 })
  }

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
    <group
      ref={g}
      onPointerDown={click}
      onPointerOver={() => usable() && (document.body.style.cursor = 'pointer')}
      onPointerOut={() => isActive() && (document.body.style.cursor = 'auto')}
    >
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
