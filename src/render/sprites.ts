import { PAL } from './palette'
import type { FruitKind } from '../game/types'

/** A sprite is rows of characters; `.` is transparent, others index a map. */
export interface Sprite {
  rows: string[]
  colors: Record<string, string>
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  override?: Record<string, string>,
): void {
  const colors = override ? { ...sprite.colors, ...override } : sprite.colors
  for (let r = 0; r < sprite.rows.length; r++) {
    const row = sprite.rows[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      const color = colors[ch]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x + c, y + r, 1, 1)
    }
  }
}

// ---- Pip, the juice drop (7 x 9) -----------------------------------------

export const DROP: Sprite = {
  rows: [
    '...b...',
    '..bbb..',
    '..bbb..',
    '.bbbbb.',
    '.bhbbb.',
    'bbbbbbb',
    'beebebb',
    'bbbbbbb',
    '.ddddd.',
  ],
  colors: { b: PAL.drop, d: PAL.dropDark, e: PAL.eye, h: PAL.white },
}

/** Squashed on landing (9 x 6). */
export const DROP_SQUASH: Sprite = {
  rows: [
    '..bbbbb..',
    '.bhbbbbb.',
    'bbbbbbbbb',
    'bbeebebbb',
    'bbbbbbbbb',
    '.ddddddd.',
  ],
  colors: { b: PAL.drop, d: PAL.dropDark, e: PAL.eye, h: PAL.white },
}

/** Happy face variant for the win (7 x 9). */
export const DROP_HAPPY: Sprite = {
  rows: [
    '...b...',
    '..bbb..',
    '..bbb..',
    '.bbbbb.',
    '.bhbbb.',
    'bbbbbbb',
    'bebbbeb',
    'bbebebb',
    '.ddddd.',
  ],
  colors: { b: PAL.drop, d: PAL.dropDark, e: PAL.eye, h: PAL.white },
}

// ---- Fruit (7 x 7) ---------------------------------------------------------

const ORANGE: Sprite = {
  rows: [
    '...l...',
    '..ll...',
    '.ooooo.',
    'ohooooo',
    'ooooooo',
    'ooooooo',
    '.ddddd.',
  ],
  colors: { o: PAL.orange, d: PAL.orangeDark, l: PAL.leaf, h: PAL.white },
}

const BERRY: Sprite = {
  rows: [
    '...l...',
    '..b.b..',
    '.bbbbb.',
    'bhbbbbb',
    '.bbbbb.',
    '..bdb..',
    '...d...',
  ],
  colors: { b: PAL.berry, d: PAL.berryDark, l: PAL.leaf, h: PAL.white },
}

const LIME: Sprite = {
  rows: [
    '..ggg..',
    '.ggggg.',
    'ghggggg',
    'ggggggg',
    'ggggggg',
    '.gdddg.',
    '..ddd..',
  ],
  colors: { g: PAL.lime, d: PAL.limeDark, h: PAL.white },
}

export const FRUIT: Record<FruitKind, Sprite> = { orange: ORANGE, berry: BERRY, lime: LIME }

export const FRUIT_COLOR: Record<FruitKind, string> = {
  orange: PAL.orange,
  berry: PAL.berry,
  lime: PAL.lime,
}
