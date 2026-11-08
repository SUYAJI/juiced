import * as THREE from 'three'
import { DEVICE_IN_BOX } from '../lunchbox/dims'

/**
 * Per-frame animation values shared between the director (which writes
 * them from the experience state) and the scene objects (which read them).
 * A plain mutable object: nothing here should trigger React renders.
 */
export interface SceneAnim {
  /** 0..1 main zipper progress. */
  unzip: number
  /** Upper-section opening angle (rad), its velocity, and 0..1 openness. */
  theta: number
  vel: number
  open: number
  /** Hover feedback, eased (0..1), and their targets. */
  hoverBox: number
  hoverDevice: number
  hoverBoxTarget: number
  hoverDeviceTarget: number
  /** 1 normally, 0 with reduced motion: scales idle movement. */
  idle: number
}

export function createAnim(): SceneAnim {
  return {
    unzip: 0,
    theta: 0,
    vel: 0,
    open: 0,
    hoverBox: 0,
    hoverDevice: 0,
    hoverBoxTarget: 0,
    hoverDeviceTarget: 0,
    idle: 1,
  }
}

// ---- device poses --------------------------------------------------------

/** Where the handheld is held up for play (world cm). Well above the box. */
export const PLAY_POS = new THREE.Vector3(0, 42, 10)
export const PLAY_QUAT = new THREE.Quaternion()

/** Lying face-up in the base tray, top end toward -x, slightly askew. */
export const BOX_POS = new THREE.Vector3(DEVICE_IN_BOX.x, DEVICE_IN_BOX.y, DEVICE_IN_BOX.z)
export const BOX_QUAT = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + DEVICE_IN_BOX.yaw)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2))

// ---- easing ----------------------------------------------------------------

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
export const easeOut = (x: number) => 1 - (1 - x) ** 3
/** Ease out with a soft overshoot, for fabric settling. */
export const settle = (x: number) => {
  const c = 1.15
  const k = x - 1
  return 1 + (c + 1) * k * k * k + c * k * k
}
