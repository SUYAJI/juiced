import * as THREE from 'three'
import { BAY, BODY, CART_WINDOW, CORNER_BOTTOM, CORNER_TOP } from './dims'

/** Rounded rectangle path with separate top and bottom corner radii. */
export function roundedRectShape(
  w: number,
  h: number,
  rTop: number,
  rBottom: number,
  cx = 0,
  cy = 0,
): THREE.Shape {
  const s = new THREE.Shape()
  const l = cx - w / 2
  const r = cx + w / 2
  const b = cy - h / 2
  const t = cy + h / 2
  s.moveTo(l + rBottom, b)
  s.lineTo(r - rBottom, b)
  s.quadraticCurveTo(r, b, r, b + rBottom)
  s.lineTo(r, t - rTop)
  s.quadraticCurveTo(r, t, r - rTop, t)
  s.lineTo(l + rTop, t)
  s.quadraticCurveTo(l, t, l, t - rTop)
  s.lineTo(l, b + rBottom)
  s.quadraticCurveTo(l, b, l + rBottom, b)
  return s
}

export function roundedRectPath(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Path {
  const p = new THREE.Path()
  const l = cx - w / 2
  const rt = cx + w / 2
  const b = cy - h / 2
  const t = cy + h / 2
  p.moveTo(l + r, b)
  p.lineTo(rt - r, b)
  p.quadraticCurveTo(rt, b, rt, b + r)
  p.lineTo(rt, t - r)
  p.quadraticCurveTo(rt, t, rt - r, t)
  p.lineTo(l + r, t)
  p.quadraticCurveTo(l, t, l, t - r)
  p.lineTo(l, b + r)
  p.quadraticCurveTo(l, b, l + r, b)
  return p
}

const BEVEL = { bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16, bevelSegments: 5, curveSegments: 24 }

/** Front half of the shell: solid, z from 0 to BODY.d/2. */
export function frontShellGeometry(): THREE.ExtrudeGeometry {
  const shape = roundedRectShape(BODY.w - 0.32, BODY.h - 0.32, CORNER_TOP, CORNER_BOTTOM)
  const g = new THREE.ExtrudeGeometry(shape, { depth: BODY.d / 2 - 0.32, ...BEVEL })
  g.translate(0, 0, 0.16)
  return g
}

/**
 * Back half of the shell: same outline with a notch at the top for the
 * cartridge window and a through-hole for the battery bay. z from -BODY.d/2 to 0.
 */
export function backShellGeometry(): THREE.ExtrudeGeometry {
  const w = BODY.w - 0.32
  const h = BODY.h - 0.32
  const l = -w / 2
  const r = w / 2
  const b = -h / 2
  const t = h / 2
  const rt = CORNER_TOP
  const rb = CORNER_BOTTOM
  const nw = CART_WINDOW.w / 2
  const nb = CART_WINDOW.bottom

  const s = new THREE.Shape()
  s.moveTo(l + rb, b)
  s.lineTo(r - rb, b)
  s.quadraticCurveTo(r, b, r, b + rb)
  s.lineTo(r, t - rt)
  s.quadraticCurveTo(r, t, r - rt, t)
  // top edge, right of the notch
  s.lineTo(nw + 0.12, t)
  s.quadraticCurveTo(nw, t, nw, t - 0.12)
  s.lineTo(nw, nb + 0.15)
  s.quadraticCurveTo(nw, nb, nw - 0.15, nb)
  s.lineTo(-nw + 0.15, nb)
  s.quadraticCurveTo(-nw, nb, -nw, nb + 0.15)
  s.lineTo(-nw, t - 0.12)
  s.quadraticCurveTo(-nw, t, -nw - 0.12, t)
  s.lineTo(l + rt, t)
  s.quadraticCurveTo(l, t, l, t - rt)
  s.lineTo(l, b + rb)
  s.quadraticCurveTo(l, b, l + rb, b)

  s.holes.push(roundedRectPath(BAY.w, BAY.h, BAY.r, BAY.x, BAY.y))

  const g = new THREE.ExtrudeGeometry(s, { depth: BODY.d / 2 - 0.32, ...BEVEL })
  // Extrude runs from z=0 to depth (+bevels); flip so the bevelled far end faces the back.
  g.translate(0, 0, 0.16)
  // Rotate rather than mirror so face winding (and normals) stay correct;
  // the outline is symmetric in x so the flip is invisible.
  g.rotateY(Math.PI)
  return g
}

/** Flat plate with a rectangular hole, for the screen bezel. */
export function bezelGeometry(w: number, h: number, r: number, holeW: number, holeH: number, holeY: number, depth: number) {
  const shape = roundedRectShape(w, h, r, r)
  shape.holes.push(roundedRectPath(holeW, holeH, 0.06, 0, holeY))
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 16,
  })
  return g
}
