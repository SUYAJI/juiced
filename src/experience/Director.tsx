import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OPEN_ANGLE } from '../lunchbox/dims'
import { clamp01, easeInOut, easeOut, settle, type SceneAnim } from './anim'
import { STEADY, transitionLength, type ExperienceStore } from './store'
import { limits, placeCamera, view, viewNameFor, type View, type ViewName } from './views'

type Controls = {
  enabled: boolean
  target: THREE.Vector3
  minPolarAngle: number
  maxPolarAngle: number
  minAzimuthAngle: number
  maxAzimuthAngle: number
  minDistance: number
  maxDistance: number
  update: () => void
}

interface Tween {
  fromTarget: THREE.Vector3
  from: THREE.Spherical
  to: View
  /** transition length in (scaled) seconds; progress comes from exp.elapsed */
  dur: number
}

/**
 * Drives everything time-based from the experience state:
 *  - advances finished transitions,
 *  - writes the zipper / upper-section values into `anim`,
 *  - moves the camera between the closed, open and play views (in
 *    spherical coordinates around a moving target, so it arcs instead of
 *    cutting through the bag), and sets orbit limits in steady states.
 */
export function Director({ exp, anim }: { exp: ExperienceStore; anim: SceneAnim }) {
  const { camera, size, gl } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Controls | null
  const last = useRef<{ state: string; since: number } | null>(null)
  const tween = useRef<Tween | null>(null)
  const prevTheta = useRef(0)
  const steadyView = useRef<ViewName | null>(null)
  const lastSize = useRef('')

  // Shadows only need updating while the lunchbox is on screen.
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl])

  useFrame((_, dt) => {
    const now = performance.now()
    exp.tick(now)
    const snap = exp.get()
    const d = exp.durations
    const t = exp.elapsed(now)
    const aspect = size.width / size.height

    // ---- zipper and upper section
    let unzip = 1
    let theta = OPEN_ANGLE
    switch (snap.state) {
      case 'lunchboxClosed':
        unzip = 0
        theta = 0
        break
      case 'lunchboxOpening': {
        unzip = easeInOut(clamp01(t / d.unzip))
        const k = clamp01((t - d.lidDelay) / d.lidOpen)
        const shape = anim.idle ? settle(k) : easeOut(k)
        theta = t < d.lidDelay ? 0.06 * unzip : 0.06 + (OPEN_ANGLE - 0.06) * shape
        break
      }
      case 'lunchboxClosing': {
        const k = clamp01(t / d.lidClose)
        theta = OPEN_ANGLE * (1 - easeInOut(k))
        unzip = 1 - easeInOut(clamp01((t - d.lidClose + 0.1) / d.zipUp))
        break
      }
    }
    if (snap.instant && snap.state === 'handheldActive') {
      unzip = 1
      theta = OPEN_ANGLE
    }
    const vel = dt > 0 ? (theta - prevTheta.current) / Math.min(dt, 0.1) : 0
    prevTheta.current = theta
    anim.unzip = unzip
    anim.theta = theta
    anim.vel = anim.vel + (vel - anim.vel) * 0.35
    anim.open = theta / OPEN_ANGLE
    const ease = 1 - Math.exp(-10 * Math.min(dt, 0.1))
    anim.hoverBox += (anim.hoverBoxTarget * (snap.state === 'lunchboxClosed' ? 1 : 0) - anim.hoverBox) * ease
    anim.hoverDevice += (anim.hoverDeviceTarget * (snap.state === 'lunchboxOpen' ? 1 : 0) - anim.hoverDevice) * ease

    if (snap.state !== 'handheldActive') gl.shadowMap.needsUpdate = true

    // ---- camera
    if (!controls) return
    const changed = !last.current || last.current.state !== snap.state || last.current.since !== snap.since
    const sizeKey = `${size.width}x${size.height}`
    const resized = sizeKey !== lastSize.current
    lastSize.current = sizeKey
    const name = viewNameFor(snap.state)

    if (changed) {
      last.current = { state: snap.state, since: snap.since }
      if (snap.instant) {
        tween.current = null
        const v = view(name, aspect)
        placeCamera(camera, v)
        controls.target.copy(v.target)
        settleControls(controls, name, v)
        steadyView.current = name
      } else if (!STEADY[snap.state]) {
        // start a camera move toward this transition's destination
        controls.enabled = false
        const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
        tween.current = {
          fromTarget: controls.target.clone(),
          from,
          to: view(name, aspect),
          dur: transitionLength(snap.state, d),
        }
        steadyView.current = null
      } else if (!tween.current) {
        const v = view(name, aspect)
        settleControls(controls, name, v)
        steadyView.current = name
      }
    }

    const tw = tween.current
    if (tw) {
      // progress follows the transition clock; once the state has moved on
      // (steady), finish the move
      const k = STEADY[snap.state] ? 1 : easeInOut(clamp01(t / tw.dur))
      const target = tw.fromTarget.clone().lerp(tw.to.target, k)
      let dAz = tw.to.azimuth - tw.from.theta
      dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz)) // shortest way round
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(tw.from.radius, tw.to.radius, k),
        THREE.MathUtils.lerp(tw.from.phi, tw.to.polar, k),
        tw.from.theta + dAz * k,
      )
      camera.position.setFromSpherical(s).add(target)
      camera.lookAt(target)
      controls.target.copy(target)
      if (k >= 1 && STEADY[snap.state]) {
        tween.current = null
        const v = view(name, aspect)
        settleControls(controls, name, v)
        steadyView.current = name
      }
    } else if (resized && steadyView.current) {
      // keep the framing sensible when the window changes shape
      const v = view(steadyView.current, aspect)
      if (steadyView.current === 'play') {
        const dir = camera.position.clone().sub(controls.target).normalize()
        camera.position.copy(controls.target).addScaledVector(dir, v.radius)
      }
      settleControls(controls, steadyView.current, v)
    }
  }, -1)

  return null
}

function settleControls(c: Controls, name: ViewName, v: View) {
  const l = limits(name, v)
  c.minPolarAngle = l.minPolar
  c.maxPolarAngle = l.maxPolar
  c.minAzimuthAngle = l.minAzimuth
  c.maxAzimuthAngle = l.maxAzimuth
  c.minDistance = l.minDistance
  c.maxDistance = l.maxDistance
  c.enabled = true
  c.update()
}
