// A 3x5 pixel font. Each glyph is five rows of three bits.

const GLYPHS: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['011', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '!': ['010', '010', '010', '000', '010'],
  ':': ['000', '010', '000', '010', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '.': ['000', '000', '000', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  '>': ['100', '010', '001', '010', '100'],
  '<': ['001', '010', '100', '010', '001'],
  "'": ['010', '010', '000', '000', '000'],
  ' ': ['000', '000', '000', '000', '000'],
}

export const GLYPH_W = 3
export const GLYPH_H = 5
export const ADVANCE = 4

export function textWidth(text: string): number {
  return text.length * ADVANCE - 1
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color
  let cx = x
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS['.']
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (g[row][col] === '1') ctx.fillRect(cx + col, y + row, 1, 1)
      }
    }
    cx += ADVANCE
  }
}

/** Draw text with each font pixel enlarged to `scale` x `scale`. */
export function drawTextScaled(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  colorFor: (index: number) => string,
): void {
  let cx = x
  let i = 0
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS['.']
    ctx.fillStyle = colorFor(i)
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (g[row][col] === '1') ctx.fillRect(cx + col * scale, y + row * scale, scale, scale)
      }
    }
    cx += ADVANCE * scale
    i++
  }
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  color: string,
): void {
  drawText(ctx, text, Math.round(cx - textWidth(text) / 2), y, color)
}
