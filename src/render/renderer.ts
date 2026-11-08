import { BOOT_MS, BPM, LANES, PITCH_LABELS, SCREEN_H, SCREEN_W, STEPS } from '../game/constants'
import type { GameStore } from '../game/store'
import type { GameState, Level } from '../game/types'
import { ADVANCE, drawText, drawTextCentered, drawTextScaled } from './font'
import { PAL } from './palette'
import { DROP, DROP_HAPPY, DROP_SQUASH, FRUIT, FRUIT_COLOR, drawSprite } from './sprites'

// ---- Layout (all in logical pixels) ---------------------------------------

const CELL_W = 17
const CELL_H = 17
const WORLD_X = 16
const WORLD_Y = 12
const WORLD_W = CELL_W * STEPS // 136
const WORLD_H = CELL_H * LANES // 68
const PAD_H = 4
const PAD_INSET = 2
const STRIP_Y = WORLD_Y + WORLD_H + 4 // 84
const TEXT_Y1 = 96
const TEXT_Y2 = 106
const GLASS_X = 136
const GLASS_Y = 94
const GLASS_W = 18
const GLASS_H = 30
const GROUND_Y = 130

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

function cellX(step: number): number {
  return WORLD_X + step * CELL_W
}
function cellY(lane: number): number {
  return WORLD_Y + lane * CELL_H
}
/** Where the character's feet rest in a cell (top of the pad). */
function feetY(lane: number): number {
  return cellY(lane) + CELL_H - PAD_INSET - PAD_H
}
/** Left edge of a 7px sprite centred in a column; -1 is the start pad. */
function spriteX(step: number): number {
  if (step < 0) return 5
  return cellX(step) + 5
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private raf = 0
  private particles: Particle[] = []
  private lastPickupAt = 0
  private lastWonAt = 0
  private lastFrame = 0
  private hopDurationMs: number

  constructor(
    canvas: HTMLCanvasElement,
    private store: GameStore,
    private level: Level,
  ) {
    canvas.width = SCREEN_W
    canvas.height = SCREEN_H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas not available')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    const stepMs = (60_000 / BPM) / 2 // one eighth note
    this.hopDurationMs = stepMs * 0.55
  }

  /** Self-driven loop, for the flat page. */
  start(): void {
    const loop = (now: number) => {
      this.frame(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Externally driven: the 3D host calls this once per frame. */
  renderFrame(now: number): void {
    this.frame(now)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  // -------------------------------------------------------------------------

  private frame(now: number): void {
    const dt = this.lastFrame ? Math.min(50, now - this.lastFrame) : 16
    this.lastFrame = now
    const s = this.store.get()
    const ctx = this.ctx

    if (s.power === 'off') {
      this.drawOff()
      return
    }
    if (s.power === 'booting') {
      this.drawBoot(now - s.bootStartedAt, now)
      return
    }

    this.spawnEffects(s, now)
    this.updateParticles(dt)

    ctx.fillStyle = PAL.bg
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

    this.drawHeader(s)
    this.drawWorld(s, now)
    this.drawFruit(s, now)
    this.drawCharacter(s, now)
    this.drawStrip(s, now)
    this.drawStatus(s, now)
    this.drawGlass(s, now)
    this.drawGround(s, now)
    this.drawParticles()
  }

  // ---- Power states ------------------------------------------------------

  /** Unpowered LCD: that flat grey-green with a slightly darker rim. */
  private drawOff(): void {
    const ctx = this.ctx
    ctx.fillStyle = '#5c6354'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    ctx.fillStyle = '#6b7262'
    ctx.fillRect(2, 2, SCREEN_W - 4, SCREEN_H - 4)
    this.particles = []
  }

  /**
   * Boot: a drop falls, lands, and the JUICED wordmark pops in letter by
   * letter. Total length BOOT_MS; any button skips it.
   */
  private drawBoot(elapsed: number, now: number): void {
    const ctx = this.ctx
    const t = elapsed / 1000
    ctx.fillStyle = PAL.bg
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)

    const word = 'JUICED'
    const scale = 3
    const wordW = word.length * ADVANCE * scale - scale
    const wx = Math.round((SCREEN_W - wordW) / 2)
    const wy = 56
    const landY = wy + 5 * scale + 13 // where the drop lands, under the word

    // Drop falls from above (0 to 0.45 s), ease-in
    const fall = Math.min(1, t / 0.45)
    const dropY = Math.round(-12 + (landY - 9 + 12) * fall * fall)
    const dropX = Math.round(SCREEN_W / 2 - 3)

    if (t < 0.45) {
      drawSprite(ctx, DROP, dropX, dropY)
    } else {
      // Landed: squash briefly, then sit
      const since = t - 0.45
      if (since < 0.12) drawSprite(ctx, DROP_SQUASH, dropX - 1, landY - 6)
      else drawSprite(ctx, DROP, dropX, landY - 9)
      // Ripple rings spreading out along the floor
      const r = Math.min(70, since * 160)
      ctx.fillStyle = PAL.inkFaint
      ctx.fillRect(Math.round(SCREEN_W / 2 - r), landY + 1, 1, 1)
      ctx.fillRect(Math.round(SCREEN_W / 2 + r), landY + 1, 1, 1)
      ctx.fillStyle = PAL.grid
      ctx.fillRect(Math.round(SCREEN_W / 2 - r * 0.6), landY + 1, 1, 1)
      ctx.fillRect(Math.round(SCREEN_W / 2 + r * 0.6), landY + 1, 1, 1)
    }

    // Floor line
    ctx.fillStyle = PAL.gridBright
    ctx.fillRect(16, landY + 1, SCREEN_W - 32, 1)

    // Letters pop in from 0.5 s, one every 90 ms
    const shown = Math.max(0, Math.min(word.length, Math.floor((t - 0.5) / 0.09) + 1))
    if (shown > 0) {
      drawTextScaled(ctx, word.slice(0, shown), wx, wy, scale, (i) => PAL.lane[i % 4])
    }
    if (t > 1.25) {
      drawTextCentered(ctx, "FROM SKY'S LUNCH BOX", SCREEN_W / 2, landY + 14, PAL.inkDim)
    }
    // Fade to black at the very end so the game appears cleanly
    const fadeStart = (BOOT_MS - 250) / 1000
    if (t > fadeStart) {
      ctx.fillStyle = PAL.bg
      ctx.globalAlpha = Math.min(1, (t - fadeStart) / 0.25)
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
      ctx.globalAlpha = 1
    }
    void now
  }

  private drawHeader(s: GameState): void {
    const ctx = this.ctx
    drawText(ctx, 'JUICED', WORLD_X, 3, PAL.ink)
    const right = s.runs > 0 ? `RUN ${s.runs}` : `${BPM} BPM`
    drawText(ctx, right, SCREEN_W - 4 - (right.length * 4 - 1), 3, PAL.inkDim)
  }

  private drawWorld(s: GameState, now: number): void {
    const ctx = this.ctx

    // World ground
    ctx.fillStyle = PAL.bgDeep
    ctx.fillRect(WORLD_X, WORLD_Y, WORLD_W, WORLD_H)

    // Column highlights
    if (s.phase !== 'won') {
      ctx.fillStyle = PAL.cursorCol
      ctx.fillRect(cellX(s.cursorStep), WORLD_Y, CELL_W, WORLD_H)
    }
    if (s.playhead !== null) {
      ctx.fillStyle = PAL.playCol
      ctx.fillRect(cellX(s.playhead), WORLD_Y, CELL_W, WORLD_H)
    }

    // Lane separators (dotted) and column ticks
    ctx.fillStyle = PAL.grid
    for (let lane = 1; lane < LANES; lane++) {
      const y = cellY(lane)
      for (let x = WORLD_X; x < WORLD_X + WORLD_W; x += 2) ctx.fillRect(x, y, 1, 1)
    }
    for (let step = 0; step <= STEPS; step++) {
      const x = cellX(step)
      ctx.fillRect(x, WORLD_Y, 1, WORLD_H)
    }
    ctx.fillStyle = PAL.gridBright
    ctx.fillRect(WORLD_X, WORLD_Y + WORLD_H, WORLD_W + 1, 1)

    // Lane labels and the start pad
    for (let lane = 0; lane < LANES; lane++) {
      const label = PITCH_LABELS[lane]
      const color = lane === s.cursorLane && s.phase !== 'won' ? PAL.lane[lane] : PAL.laneDark[lane]
      drawText(ctx, label, 5, cellY(lane) + 3, color)
    }
    ctx.fillStyle = PAL.startPad
    ctx.fillRect(2, feetY(this.level.startLane), 13, PAD_H)
    ctx.fillStyle = PAL.inkFaint
    ctx.fillRect(2, feetY(this.level.startLane) + PAD_H, 13, 1)

    // Note pads
    for (let step = 0; step < STEPS; step++) {
      const lane = s.sequence[step]
      if (lane === null || lane === undefined) continue
      const x = cellX(step) + PAD_INSET
      const y = feetY(lane)
      const sounding = s.playhead === step
      ctx.fillStyle = sounding ? PAL.white : PAL.lane[lane]
      ctx.fillRect(x, y, CELL_W - PAD_INSET * 2 + 1, PAD_H)
      ctx.fillStyle = PAL.laneDark[lane]
      ctx.fillRect(x, y + PAD_H, CELL_W - PAD_INSET * 2 + 1, 1)
      if (sounding) {
        // Ripple above a sounding pad
        ctx.fillStyle = PAL.lane[lane]
        ctx.fillRect(x + 3, y - 2, CELL_W - PAD_INSET * 2 - 5, 1)
      }
    }

    // Cursor: a ghost pad with a blinking frame around the selected cell
    if (s.phase !== 'won') {
      const blink = Math.floor(now / 260) % 2 === 0
      const x = cellX(s.cursorStep)
      const y = cellY(s.cursorLane)
      const hasNote = s.sequence[s.cursorStep] === s.cursorLane
      if (!hasNote) {
        ctx.fillStyle = PAL.laneDark[s.cursorLane]
        const py = feetY(s.cursorLane)
        for (let px = x + PAD_INSET; px <= x + CELL_W - PAD_INSET; px += 2) {
          ctx.fillRect(px, py + 1, 1, 1)
        }
      }
      ctx.fillStyle = blink ? PAL.ink : PAL.inkDim
      // corner brackets
      const w = CELL_W + 1
      const h = CELL_H + 1
      const c = 3
      ctx.fillRect(x, y, c, 1)
      ctx.fillRect(x, y, 1, c)
      ctx.fillRect(x + w - c, y, c, 1)
      ctx.fillRect(x + w - 1, y, 1, c)
      ctx.fillRect(x, y + h - 1, c, 1)
      ctx.fillRect(x, y + h - c, 1, c)
      ctx.fillRect(x + w - c, y + h - 1, c, 1)
      ctx.fillRect(x + w - 1, y + h - c, 1, c)
    }
  }

  private drawFruit(s: GameState, now: number): void {
    this.level.collectibles.forEach((c, i) => {
      if (s.collected[i]) return
      const bob = Math.round(Math.sin(now / 320 + c.step * 1.3)) // -1, 0, 1
      const x = cellX(c.step) + 5
      const y = feetY(c.lane) - 8 + bob
      drawSprite(this.ctx, FRUIT[c.kind], x, y)
    })
  }

  private drawCharacter(s: GameState, now: number): void {
    const ctx = this.ctx
    const elapsed = now - s.hopStartedAt
    const moving = s.prevStep !== s.charStep || s.prevLane !== s.charLane
    const t = moving ? Math.min(1, elapsed / this.hopDurationMs) : 1

    const x0 = spriteX(s.prevStep)
    const x1 = spriteX(s.charStep)
    const y0 = feetY(s.prevLane)
    const y1 = feetY(s.charLane)

    let x = Math.round(lerp(x0, x1, easeOut(t)))
    let feet = Math.round(lerp(y0, y1, t)) - Math.round(Math.sin(Math.PI * t) * 7)

    // Idle bob in edit mode
    if (s.phase === 'edit' && !moving) {
      feet += Math.floor(now / 500) % 2 === 0 ? 0 : -1
    }

    // Floating in a lane with no pad: show a faint perch under the feet
    if (s.phase === 'playing' && s.charStep >= 0 && s.sequence[s.charStep] === null && t >= 1) {
      ctx.fillStyle = PAL.inkFaint
      for (let px = x - 2; px < x + 9; px += 2) ctx.fillRect(px, feet + 1, 1, 1)
    }

    // Tint the drop with the most recently collected fruit
    const tint = s.lastPickup && s.collected.some(Boolean) ? FRUIT_COLOR[s.lastPickup.kind] : undefined
    const override = tint ? { b: tint } : undefined

    if (s.phase === 'won') {
      const hop = Math.abs(Math.sin(now / 160)) * 3
      drawSprite(ctx, DROP_HAPPY, x, feet - 9 - Math.round(hop), override)
      return
    }

    const landing = moving && elapsed >= this.hopDurationMs && elapsed < this.hopDurationMs + 90
    if (landing) {
      drawSprite(ctx, DROP_SQUASH, x - 1, feet - 6, override)
    } else {
      const blink = Math.floor(now / 2900) % 7 === 0 && now % 2900 < 120
      drawSprite(ctx, DROP, x, feet - 9, blink ? { ...override, e: tint ?? PAL.drop } : override)
    }
  }

  private drawStrip(s: GameState, now: number): void {
    const ctx = this.ctx
    for (let step = 0; step < STEPS; step++) {
      const lane = s.sequence[step]
      const cx = cellX(step) + CELL_W / 2
      const isCursor = step === s.cursorStep && s.phase !== 'won'
      const isPlay = step === s.playhead
      if (lane === null || lane === undefined) {
        ctx.fillStyle = isCursor ? PAL.inkDim : PAL.inkFaint
        ctx.fillRect(Math.round(cx) - 1, STRIP_Y + 2, 1, 1)
      } else {
        const color = isPlay ? PAL.white : PAL.lane[lane]
        drawTextCentered(ctx, PITCH_LABELS[lane], cx, STRIP_Y, color)
      }
      if (isCursor) {
        const blink = Math.floor(now / 260) % 2 === 0
        ctx.fillStyle = blink ? PAL.ink : PAL.inkDim
        ctx.fillRect(Math.round(cx) - 2, STRIP_Y + 6, 3, 1)
      }
    }
  }

  private drawStatus(s: GameState, now: number): void {
    const ctx = this.ctx
    if (!s.audioReady) {
      drawText(ctx, 'PRESS ANY KEY', WORLD_X, TEXT_Y1, PAL.ink)
      drawText(ctx, 'TO WAKE THE SOUND', WORLD_X, TEXT_Y2, PAL.inkDim)
      return
    }
    switch (s.phase) {
      case 'edit': {
        const note = s.sequence[s.cursorStep]
        const noteText = note === null ? `PITCH ${PITCH_LABELS[s.cursorLane]}` : `NOTE ${PITCH_LABELS[note]}`
        drawText(ctx, `STEP ${s.cursorStep + 1}  ${noteText}`, WORLD_X, TEXT_Y1, PAL.ink)
        drawText(ctx, 'A NOTE B CLEAR START PLAY', WORLD_X, TEXT_Y2, PAL.inkDim)
        break
      }
      case 'playing': {
        const got = s.collected.filter(Boolean).length
        drawText(ctx, `PLAYING  FRUIT ${got}/${this.level.collectibles.length}`, WORLD_X, TEXT_Y1, PAL.ink)
        drawText(ctx, 'EDIT LIVE  START STOP', WORLD_X, TEXT_Y2, PAL.inkDim)
        break
      }
      case 'won': {
        const word = 'JUICED!'
        const phase = Math.floor(now / 120)
        let x = WORLD_X
        for (let i = 0; i < word.length; i++) {
          const color = PAL.lane[(i + phase) % 4]
          drawText(ctx, word[i], x, TEXT_Y1, color)
          x += 4
        }
        drawText(ctx, 'START AGAIN OR REMIX', WORLD_X, TEXT_Y2, PAL.inkDim)
        break
      }
    }
  }

  private drawGlass(s: GameState, now: number): void {
    const ctx = this.ctx
    const x = GLASS_X
    const y = GLASS_Y
    // Glass body
    ctx.fillStyle = PAL.bgDeep
    ctx.fillRect(x + 1, y, GLASS_W - 2, GLASS_H)
    ctx.fillStyle = PAL.inkDim
    ctx.fillRect(x, y, 1, GLASS_H)
    ctx.fillRect(x + GLASS_W - 1, y, 1, GLASS_H)
    ctx.fillRect(x, y + GLASS_H - 1, GLASS_W, 1)
    ctx.fillStyle = PAL.inkFaint
    ctx.fillRect(x + 2, y + GLASS_H - 2, GLASS_W - 4, 1)

    // Juice layers, oldest at the bottom, in the order they were collected
    const layers = this.level.collectibles.filter((_, i) => s.collected[i])
    const layerH = Math.floor((GLASS_H - 4) / this.level.collectibles.length)
    let top = y + GLASS_H - 2
    layers.forEach((c, i) => {
      top -= layerH
      const wobble = s.phase === 'won' ? Math.round(Math.sin(now / 150 + i)) : 0
      ctx.fillStyle = FRUIT_COLOR[c.kind]
      ctx.fillRect(x + 2, top + wobble, GLASS_W - 4, layerH - wobble)
    })
    if (layers.length > 0) {
      ctx.fillStyle = PAL.white
      ctx.fillRect(x + 3, top, 2, 1)
    }

    if (s.phase === 'won') {
      // Straw and bubbles
      ctx.fillStyle = PAL.ink
      ctx.fillRect(x + GLASS_W - 6, y - 6, 2, GLASS_H)
      const b = Math.floor(now / 200) % 5
      ctx.fillStyle = PAL.white
      ctx.fillRect(x + 5, y + GLASS_H - 8 - b * 3, 1, 1)
      ctx.fillRect(x + 9, y + GLASS_H - 14 - ((b + 2) % 5) * 3, 1, 1)
    }
  }

  private drawGround(s: GameState, now: number): void {
    const ctx = this.ctx
    ctx.fillStyle = PAL.bgDeep
    ctx.fillRect(0, GROUND_Y, SCREEN_W, SCREEN_H - GROUND_Y)
    ctx.fillStyle = PAL.grid
    ctx.fillRect(0, GROUND_Y, SCREEN_W, 1)
    // Slow drifting speckle
    const shift = Math.floor(now / 400) % 4
    ctx.fillStyle = PAL.gridBright
    for (let x = shift; x < SCREEN_W; x += 8) ctx.fillRect(x, GROUND_Y + 6, 1, 1)
    for (let x = (shift + 4) % 8; x < SCREEN_W; x += 8) ctx.fillRect(x, GROUND_Y + 11, 1, 1)
    if (s.phase === 'won') {
      // Juice wave along the ground
      for (let x = 0; x < SCREEN_W; x++) {
        const h = 3 + Math.round(Math.sin(x / 6 + now / 180) * 2)
        ctx.fillStyle = PAL.lane[Math.floor((x + now / 60) / 20) % 4]
        ctx.fillRect(x, SCREEN_H - h, 1, h)
      }
    }
  }

  // ---- Particles -------------------------------------------------------

  private spawnEffects(s: GameState, now: number): void {
    if (s.lastPickup && s.lastPickup.at !== this.lastPickupAt) {
      this.lastPickupAt = s.lastPickup.at
      const cx = cellX(s.lastPickup.step) + CELL_W / 2
      const cy = feetY(s.lastPickup.lane) - 5
      const color = FRUIT_COLOR[s.lastPickup.kind]
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * 0.05,
          vy: Math.sin(a) * 0.05 - 0.03,
          life: 320,
          color: i % 3 === 0 ? PAL.white : color,
        })
      }
    }
    if (s.wonAt !== null && s.wonAt !== this.lastWonAt) {
      this.lastWonAt = s.wonAt
      for (let i = 0; i < 40; i++) {
        this.particles.push({
          x: Math.random() * SCREEN_W,
          y: -Math.random() * 40,
          vx: (Math.random() - 0.5) * 0.02,
          vy: 0.03 + Math.random() * 0.04,
          life: 1800 + Math.random() * 600,
          color: PAL.lane[i % 4],
        })
      }
    }
    if (s.wonAt === null) this.lastWonAt = 0
    void now
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 0.00012 * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < SCREEN_H)
  }

  private drawParticles(): void {
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color
      this.ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
    }
  }
}
