import * as THREE from 'three'
import { PLAY_POS } from './anim'
import type { ExperienceState } from './store'

export const FOV = 28

/** A camera placement: look-at target plus spherical offset from it. */
export interface View {
  target: THREE.Vector3
  radius: number
  polar: number // from +y
  azimuth: number // around +y, 0 = looking from +z
}

export interface Limits {
  minPolar: number
  maxPolar: number
  minAzimuth: number
  maxAzimuth: number
  minDistance: number
  maxDistance: number
}

const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
/** Distance at which a half-height / half-width box fills the frame. */
export const fit = (halfH: number, halfW: number, aspect: number) => Math.max(halfH / t, halfW / (t * aspect))

export type ViewName = 'closed' | 'open' | 'play'

export function viewNameFor(state: ExperienceState): ViewName {
  switch (state) {
    case 'lunchboxClosed':
    case 'lunchboxClosing':
      return 'closed'
    case 'lunchboxOpening':
    case 'lunchboxOpen':
    case 'returningHandheld':
      return 'open'
    case 'pickingUpHandheld':
    case 'handheldActive':
      return 'play'
  }
}

// Same framing as Implementation 02: slightly above, looking a touch down
const PLAY_POLAR = Math.acos(4.2 / Math.hypot(4.2, 33.7))

export function view(name: ViewName, aspect: number): View {
  switch (name) {
    case 'closed':
      // three-quarter from the front right: the front and the MY MOM end
      return { target: new THREE.Vector3(0, 8, 0), radius: fit(17.5, 17.5, aspect), polar: 1.12, azimuth: 0.45 }
    case 'open':
      // higher, to look into the tray with the upper section folded back
      return { target: new THREE.Vector3(0, 6.5, -4.5), radius: fit(19, 18, aspect), polar: 0.72, azimuth: 0.2 }
    case 'play':
      return { target: PLAY_POS.clone().add(new THREE.Vector3(0, 0.75, 0)), radius: fit(9.9, 5.3, aspect), polar: PLAY_POLAR, azimuth: 0 }
  }
}

export function limits(name: ViewName, v: View): Limits {
  if (name === 'play') {
    return {
      minPolar: Math.PI / 2 - 0.42,
      maxPolar: Math.PI / 2 + 0.18,
      minAzimuth: -0.45,
      maxAzimuth: 0.45,
      minDistance: v.radius * 0.55,
      maxDistance: v.radius * 1.3,
    }
  }
  // the lunchbox can be walked all the way round, but not from below
  return {
    minPolar: 0.42,
    maxPolar: 1.38,
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: v.radius * 0.5,
    maxDistance: v.radius * 1.45,
  }
}

export function placeCamera(cam: THREE.Camera, v: View): void {
  const s = new THREE.Spherical(v.radius, v.polar, v.azimuth)
  cam.position.setFromSpherical(s).add(v.target)
  cam.lookAt(v.target)
}
