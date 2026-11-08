import { useSyncExternalStore } from 'react'

/**
 * The opening experience. Steady states wait for the user; transition
 * states run for a fixed duration and then advance on their own.
 *
 *   lunchboxClosed --open--> lunchboxOpening --> lunchboxOpen
 *   lunchboxOpen --close--> lunchboxClosing --> lunchboxClosed
 *   lunchboxOpen --pick up--> pickingUpHandheld --> handheldActive
 *   handheldActive --put back--> returningHandheld --> lunchboxOpen
 *
 * Game power and gameplay live in the GameStore and are untouched by these.
 */
export type ExperienceState =
  | 'lunchboxClosed'
  | 'lunchboxOpening'
  | 'lunchboxOpen'
  | 'lunchboxClosing'
  | 'pickingUpHandheld'
  | 'handheldActive'
  | 'returningHandheld'

export const STEADY: Record<ExperienceState, boolean> = {
  lunchboxClosed: true,
  lunchboxOpening: false,
  lunchboxOpen: true,
  lunchboxClosing: false,
  pickingUpHandheld: false,
  handheldActive: true,
  returningHandheld: false,
}

export interface Durations {
  unzip: number
  lidDelay: number
  lidOpen: number
  lidClose: number
  zipUp: number
  pickUp: number
  putBack: number
}

export const NORMAL: Durations = { unzip: 1.5, lidDelay: 1.3, lidOpen: 1.35, lidClose: 0.95, zipUp: 1.2, pickUp: 1.7, putBack: 1.45 }
export const REDUCED: Durations = { unzip: 0.3, lidDelay: 0.25, lidOpen: 0.3, lidClose: 0.25, zipUp: 0.3, pickUp: 0.45, putBack: 0.4 }

export function transitionLength(state: ExperienceState, d: Durations): number {
  switch (state) {
    case 'lunchboxOpening':
      return d.lidDelay + d.lidOpen
    case 'lunchboxClosing':
      return d.lidClose + d.zipUp - 0.1
    case 'pickingUpHandheld':
      return d.pickUp
    case 'returningHandheld':
      return d.putBack
    default:
      return 0
  }
}

const NEXT: Partial<Record<ExperienceState, ExperienceState>> = {
  lunchboxOpening: 'lunchboxOpen',
  lunchboxClosing: 'lunchboxClosed',
  pickingUpHandheld: 'handheldActive',
  returningHandheld: 'lunchboxOpen',
}

export interface ExperienceSnapshot {
  state: ExperienceState
  /** performance.now() when this state began. */
  since: number
  /** True when the state was entered instantly (skip / deep link). */
  instant: boolean
}

export class ExperienceStore {
  private snap: ExperienceSnapshot
  private listeners = new Set<() => void>()
  readonly durations: Durations
  /** Test/demo only: slows every transition (1 = real time). */
  timeScale = 1

  constructor(initial: ExperienceState, reducedMotion: boolean) {
    this.snap = { state: initial, since: performance.now(), instant: true }
    this.durations = reducedMotion ? REDUCED : NORMAL
  }

  get(): ExperienceSnapshot {
    return this.snap
  }

  get state(): ExperienceState {
    return this.snap.state
  }

  private go(state: ExperienceState, instant = false) {
    this.snap = { state, since: performance.now(), instant }
    this.listeners.forEach((l) => l())
  }

  /** Seconds into the current state (scaled by timeScale). */
  elapsed(now: number): number {
    return ((now - this.snap.since) / 1000) * this.timeScale
  }

  /** Called every frame by the director; advances finished transitions. */
  tick(now: number): void {
    const next = NEXT[this.snap.state]
    if (!next) return
    if (this.elapsed(now) >= transitionLength(this.snap.state, this.durations)) this.go(next)
  }

  open(): boolean {
    if (this.state !== 'lunchboxClosed') return false
    this.go('lunchboxOpening')
    return true
  }

  close(): boolean {
    if (this.state !== 'lunchboxOpen') return false
    this.go('lunchboxClosing')
    return true
  }

  pickUp(): boolean {
    if (this.state !== 'lunchboxOpen') return false
    this.go('pickingUpHandheld')
    return true
  }

  putBack(): boolean {
    if (this.state !== 'handheldActive') return false
    this.go('returningHandheld')
    return true
  }

  /** Jump straight to the handheld (skip intro / #handheld). */
  skipToHandheld(): void {
    this.go('handheldActive', true)
  }

  subscribe(l: () => void): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
}

export function useExperience(store: ExperienceStore): ExperienceSnapshot {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
    () => store.get(),
  )
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
