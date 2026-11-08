// Physical dimensions of the handheld, in centimetres. Overall size from a
// real Game Boy Color (133.5 x 78 x 27 mm); positions of the screen,
// controls, stickers, labels and battery bay measured from the reference
// photos (front photo ~84 px/cm, back photo ~74 px/cm).
// Origin is the body centre; +x right, +y up, +z toward the viewer.

export const BODY = { w: 7.8, h: 13.35, d: 2.6 }
export const FRONT_Z = BODY.d / 2
export const BACK_Z = -BODY.d / 2
export const TOP_Y = BODY.h / 2
export const CORNER_TOP = 0.45
export const CORNER_BOTTOM = 1.35

// Screen bezel and LCD (160 x 144 logical pixels)
export const BEZEL = { x: 0, y: 3.8, w: 5.75, h: 5.25, r: 0.3, depth: 0.1 }
export const LCD = { x: 0, y: 4.05, w: 4.4, h: 3.96 }
export const WORDMARK_Y = 1.6

// Controls (front face)
export const DPAD = { x: -2.2, y: -0.95, span: 2.25, arm: 0.74, h: 0.3 }
export const BTN_A = { x: 3.0, y: -1.2, r: 0.5, h: 0.32 }
export const BTN_B = { x: 1.6, y: -1.5, r: 0.5, h: 0.32 }
export const SELECT = { x: -0.7, y: -2.55 }
export const START = { x: 0.7, y: -2.62 }
export const PILL = { w: 0.78, h: 0.3, d: 0.18, tilt: 0.06 }
export const POWER_LED = { x: -2.62, y: 4.55 }
export const BRAND_OVAL = { x: -0.3, y: 0.45, w: 2.0, h: 0.5 }

// Stickers
export const STICKER_1 = { x: 1.85, y: -0.1, size: 1.6 }
export const STICKER_2 = { x: -2.68, y: -3.7, size: 1.66 }
export const PLANET = { x: -0.08, y: -4.7, w: 2.6, h: 1.82, rot: 0 }

// Speaker grille (bottom right)
export const GRILLE = { x: 2.62, y: -3.8, cols: 6, rows: 7, dx: 0.2, dy: 0.27 }

// Back
export const BAY = { x: 0, y: -2.5, w: 6.0, h: 3.5, r: 0.3 }
export const BATTERY = { r: 0.64, len: 5.05, y1: -1.68, y2: -3.32 }
export const LABEL = { x: 0, y: 1.0, w: 6.0, h: 2.5 }
export const BARCODE = { x: 0.05, y: 3.35, w: 5.2, h: 1.5 }

// Cartridge: visible above the body (label) and through the back window
export const CART = { w: 5.9, bottom: 4.6, top: 8.9, d: 0.8 }
export const CART_BULGE = { w: 5.5, bottom: 4.6, top: 6.55, d: 0.5 }
export const CART_WINDOW = { w: 6.3, bottom: 4.55 }
