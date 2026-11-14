import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BACK_Z, BARCODE, BATTERY, BAY, LABEL } from './dims'
import { backLabelTexture, barcodeTexture, batteryTexture } from './textures'

const SILVER = new THREE.MeshStandardMaterial({ color: '#cfd2d8', metalness: 0.9, roughness: 0.3 })

/** Everything on the back: open battery bay with two AAs, labels, screws. */
export function Back() {
  const label = useMemo(() => backLabelTexture(), [])
  const barcode = useMemo(() => barcodeTexture(), [])
  const wrap = useMemo(() => batteryTexture(), [])
  useEffect(
    () => () => {
      label.dispose()
      barcode.dispose()
      wrap.dispose()
    },
    [label, barcode, wrap],
  )

  const faceBack: [number, number, number] = [0, Math.PI, 0]

  return (
    <group>
      {/* Battery bay contacts at each end */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (BAY.w / 2 - 0.12), BAY.y, -0.6]}>
          <boxGeometry args={[0.1, BAY.h - 0.5, 1.0]} />
          <primitive object={SILVER} attach="material" />
        </mesh>
      ))}
      {/* Ridge between the two cells */}
      <mesh position={[0, (BATTERY.y1 + BATTERY.y2) / 2, -0.12]}>
        <boxGeometry args={[BAY.w - 0.3, 0.1, 0.2]} />
        <meshStandardMaterial color="#1f1a30" roughness={0.9} />
      </mesh>

      <Battery y={BATTERY.y1} wrap={wrap} flip={false} />
      <Battery y={BATTERY.y2} wrap={wrap} flip />

      {/* Regulatory-style label */}
      <mesh position={[LABEL.x, LABEL.y, BACK_Z - 0.004]} rotation={faceBack}>
        <planeGeometry args={[LABEL.w, LABEL.h]} />
        <meshStandardMaterial map={label} roughness={0.7} />
      </mesh>

      {/* Barcode sticker, slightly askew like the original */}
      <mesh position={[BARCODE.x, BARCODE.y, BACK_Z - 0.005]} rotation={[0, Math.PI, 0.012]}>
        <planeGeometry args={[BARCODE.w, BARCODE.h]} />
        <meshStandardMaterial map={barcode} roughness={0.75} />
      </mesh>

      {/* Screws */}
      {[
        [-3.45, 5.4],
        [3.45, 5.4],
        [-3.5, 0.75],
        [3.5, 0.75],
        [-2.4, -5.55],
        [2.4, -5.55],
      ].map(([x, y]) => (
        <group key={`${x},${y}`} position={[x, y, BACK_Z - 0.002]} rotation={faceBack}>
          <mesh>
            <circleGeometry args={[0.16, 18]} />
            <meshStandardMaterial color="#17141f" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <planeGeometry args={[0.18, 0.035]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          <mesh position={[0, 0, 0.002]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[0.18, 0.035]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/**
 * One AA, seated in the open bay. Scenery only: the batteries are not a
 * control, so nothing on the device can be switched off by accident.
 */
function Battery({ y, wrap, flip }: { y: number; wrap: THREE.Texture; flip: boolean }) {
  // Cylinder axis is y; rotate so it lies along x. Positive end (nub) at +x
  // for one cell and -x for the other, as they sit in the photo.
  const rz = flip ? Math.PI / 2 : -Math.PI / 2
  const nubX = flip ? -BATTERY.len / 2 - 0.05 : BATTERY.len / 2 + 0.05
  const z = -BATTERY.r - 0.04

  return (
    <group position={[0, y, z]}>
      <mesh rotation={[0, 0, rz]}>
        <cylinderGeometry args={[BATTERY.r, BATTERY.r, BATTERY.len, 40]} />
        <meshStandardMaterial map={wrap} roughness={0.35} metalness={0.15} />
      </mesh>
      {/* end caps */}
      <mesh position={[BATTERY.len / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[BATTERY.r - 0.01, BATTERY.r - 0.01, 0.02, 40]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      <mesh position={[-BATTERY.len / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[BATTERY.r - 0.01, BATTERY.r - 0.01, 0.02, 40]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
      {/* positive nub */}
      <mesh position={[nubX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.1, 20]} />
        <primitive object={SILVER} attach="material" />
      </mesh>
    </group>
  )
}
