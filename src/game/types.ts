export type Lane = 0 | 1 | 2 | 3

/** Eight steps; each is a lane index (a note) or null (silent, hold lane). */
export type Sequence = (Lane | null)[]

export type FruitKind = 'orange' | 'berry' | 'lime'

export interface Collectible {
  step: number
  lane: Lane
  kind: FruitKind
}

export interface Level {
  startLane: Lane
  collectibles: Collectible[]
}

export type Phase = 'edit' | 'playing' | 'won'

/** Handheld power. The flat test page starts 'on'; the 3D device starts 'off'. */
export type Power = 'off' | 'booting' | 'on'

export interface PickupEvent {
  step: number
  lane: Lane
  kind: FruitKind
  /** performance.now() when it happened; renderer uses it to spawn particles. */
  at: number
}

export interface GameState {
  sequence: Sequence
  cursorStep: number
  cursorLane: Lane
  phase: Phase

  /** Step currently sounding, or null when not playing. */
  playhead: number | null
  /** Character position. charStep -1 means the start pad left of column 0. */
  charStep: number
  charLane: Lane
  /** Previous position, for interpolating the hop. */
  prevStep: number
  prevLane: Lane
  /** performance.now() when the current hop began. */
  hopStartedAt: number

  collected: boolean[]
  lastPickup: PickupEvent | null
  wonAt: number | null
  /** Number of complete runs played since the last reset (for display). */
  runs: number
  audioReady: boolean
  power: Power
  /** performance.now() when the boot sequence began. */
  bootStartedAt: number
}
