// The lunchbox, in centimetres. A small soft-sided 1990s lunch bag,
// about 24 x 16 x 16.5 cm, measured against the hand in the photos.
// Origin is the centre of the bottom face; +y up, +z is the front
// (SKYLER), +x the MY MOM 97' end, -x the THIS IS ME! end, -z the back
// (SKY'S LUNCH BOX), where the fabric acts as the hinge.
//
// Construction (from the front photo): a deep bottom compartment, the
// main zipper about halfway up, and a shallower domed cap on top with
// the handle. The flat front pocket is on the bottom compartment.

export const LB = {
  W: 24,
  H: 16.5,
  D: 16,
  /** Rounding at the top of the domed cap, and at the base. */
  RT: 5.2,
  RB: 2.0,
  /** Height of the main zipper above the table. */
  ZIP_Y: 8.5,
  /** Wall thickness (fabric + foam). */
  T: 0.45,
  SEG: { x: 48, y: 33, z: 32 },
} as const

/** The back panel bends about this line when the cap folds open. */
export const HINGE = { y: LB.ZIP_Y, z: -LB.D / 2 + 0.9 }

/** Fully open angle of the cap (radians): folded back past upright. */
export const OPEN_ANGLE = 2.45

/** Band of fabric (cm from the hinge) over which the back panel curls. */
export const BEND = 4.2

/** Flat zippered pocket on the front of the bottom compartment. */
export const POCKET = { zipY: LB.ZIP_Y - 1.7, x0: -9.2, x1: 8.4, bottom: 1.6, puff: 0.35 }

/** Handle anchors on the top of the cap, along x. */
export const HANDLE = { x: 6.2, rise: 3.8, width: 3.1, thick: 0.95 }

/** Strap D-rings at the top corners of each end. */
export const STRAP_RING_Y = LB.H - 2.4

/** Where the handheld rests: on top of the wrapped lunch. */
export const DEVICE_IN_BOX = { x: 0.2, y: 5.65, z: -0.3, yaw: 0.1 }
