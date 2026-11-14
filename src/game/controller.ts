import { BOOT_MS, LANES, STEPS } from './constants'
import { collectibleAt, emptySequence } from './logic'
import type { GameStore } from './store'
import { initialState } from './store'
import type { Lane, Level } from './types'
import type { AudioEngine } from '../audio/engine'

export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'a'
  | 'b'
  | 'start'
  | 'select'

/**
 * Game rules. Owns the step-by-step run state while playing and translates
 * button presses into state changes. Visual state is only ever written
 * inside `engine.whenDrawn(...)` so it lands on the frame matching the sound.
 */
export type PressListener = (action: Action) => void

export class GameController {
  private runLane: Lane
  private runCollected: boolean[]
  private winning = false
  private bootTimer: ReturnType<typeof setTimeout> | null = null
  private pressListeners = new Set<PressListener>()
  /** True while the cartridge is out: no power. */
  private powerBlocked = false

  constructor(
    private store: GameStore,
    private engine: AudioEngine,
    private level: Level,
  ) {
    this.runLane = level.startLane
    this.runCollected = level.collectibles.map(() => false)
  }

  /** Called from any gesture before handling it; unlocks audio once. */
  async ensureAudio(): Promise<void> {
    if (this.engine.isStarted) return
    await this.engine.start()
    this.store.set({ audioReady: true })
  }

  /**
   * Observe button presses (from keyboard or UI) regardless of whether the
   * game acts on them. The 3D handheld uses this to depress its buttons.
   */
  onPress(listener: PressListener): () => void {
    this.pressListeners.add(listener)
    return () => this.pressListeners.delete(listener)
  }

  dispatch(action: Action): void {
    this.pressListeners.forEach((l) => l(action))
    // The button itself clicks, on or off, like the real thing.
    this.engine.press(action)
    const power = this.store.get().power
    if (power === 'off') return
    if (power === 'booting') {
      this.finishBoot()
      return
    }
    switch (action) {
      case 'left':
        return this.moveCursor(-1, 0)
      case 'right':
        return this.moveCursor(1, 0)
      case 'up':
        return this.moveCursor(0, -1)
      case 'down':
        return this.moveCursor(0, 1)
      case 'a':
        return this.toggleNote()
      case 'b':
        return this.clearStep()
      case 'start':
        return this.togglePlay()
      case 'select':
        return this.reset()
    }
  }

  // ---- Power -----------------------------------------------------------

  togglePower(): void {
    this.engine.powerSwitch()
    if (this.store.get().power === 'off') this.powerOn()
    else this.powerOff()
  }

  /** The cartridge came out (true) or is back in (false). */
  setPowerBlocked(blocked: boolean): void {
    this.powerBlocked = blocked
    if (blocked) this.powerOff()
  }

  get isPowerBlocked(): boolean {
    return this.powerBlocked
  }

  powerOn(): void {
    if (this.powerBlocked) return
    if (this.store.get().power !== 'off') return
    this.store.set({ power: 'booting', bootStartedAt: performance.now() })
    if (this.engine.isStarted) this.engine.bootChime(this.engine.now() + 0.45)
    this.bootTimer = setTimeout(() => this.finishBoot(), BOOT_MS)
  }

  powerOff(): void {
    if (this.store.get().power === 'off') return
    this.clearBootTimer()
    this.engine.stop()
    this.engine.powerDown()
    this.winning = false
    // Keep the composition; stop any run and go dark.
    this.store.set({
      power: 'off',
      phase: 'edit',
      playhead: null,
      charStep: -1,
      charLane: this.level.startLane,
      prevStep: -1,
      prevLane: this.level.startLane,
      collected: this.level.collectibles.map(() => false),
      wonAt: null,
    })
  }

  private finishBoot(): void {
    this.clearBootTimer()
    if (this.store.get().power !== 'booting') return
    this.store.set({ power: 'on', hopStartedAt: performance.now() })
  }

  private clearBootTimer(): void {
    if (this.bootTimer !== null) {
      clearTimeout(this.bootTimer)
      this.bootTimer = null
    }
  }

  /** Release timers and audio; call when the host unmounts. */
  dispose(): void {
    this.clearBootTimer()
    this.engine.stop()
    this.pressListeners.clear()
  }

  // ---- Editing ---------------------------------------------------------

  private moveCursor(dStep: number, dLane: number): void {
    const s = this.store.get()
    const cursorStep = (s.cursorStep + dStep + STEPS) % STEPS
    const cursorLane = Math.min(LANES - 1, Math.max(0, s.cursorLane + dLane)) as Lane
    if (cursorStep === s.cursorStep && cursorLane === s.cursorLane) return
    // Moving onto a step that has a note snaps the pitch cursor to it,
    // so left/right browses the melody and up/down changes it.
    const existing = s.sequence[cursorStep]
    const lane = dStep !== 0 && existing !== null ? existing : cursorLane
    this.store.set({ cursorStep, cursorLane: lane })
    this.engine.uiMove()
  }

  private toggleNote(): void {
    const s = this.store.get()
    const sequence = [...s.sequence]
    const removing = sequence[s.cursorStep] === s.cursorLane
    sequence[s.cursorStep] = removing ? null : s.cursorLane
    // State first, sound second: audio must never be able to block an edit.
    this.store.set({ sequence })
    this.leaveWonState()
    if (removing) this.engine.uiRemove()
    else this.engine.uiPlace(s.cursorLane)
  }

  private clearStep(): void {
    const s = this.store.get()
    if (s.sequence[s.cursorStep] === null) return
    const sequence = [...s.sequence]
    sequence[s.cursorStep] = null
    this.store.set({ sequence })
    this.leaveWonState()
    this.engine.uiRemove()
  }

  /** Editing after a win returns to the idle edit state. */
  private leaveWonState(): void {
    if (this.store.get().phase === 'won') this.stopRun()
  }

  // ---- Transport -------------------------------------------------------

  private togglePlay(): void {
    const s = this.store.get()
    if (s.phase === 'playing') {
      this.stopRun()
    } else {
      this.startRun()
    }
  }

  private startRun(): void {
    if (!this.engine.isStarted) return
    this.winning = false
    this.resetRunState()
    this.store.set({
      phase: 'playing',
      playhead: null,
      charStep: -1,
      charLane: this.level.startLane,
      prevStep: -1,
      prevLane: this.level.startLane,
      collected: this.level.collectibles.map(() => false),
      wonAt: null,
    })
    this.engine.play((step, time) => this.onStep(step, time))
  }

  private stopRun(): void {
    this.engine.stop()
    this.winning = false
    this.store.set({
      phase: 'edit',
      playhead: null,
      charStep: -1,
      charLane: this.level.startLane,
      prevStep: -1,
      prevLane: this.level.startLane,
      hopStartedAt: performance.now(),
      collected: this.level.collectibles.map(() => false),
      wonAt: null,
    })
  }

  private reset(): void {
    this.engine.stop()
    this.winning = false
    const { audioReady, power } = this.store.get()
    this.store.set({ ...initialState(this.level), sequence: emptySequence(), audioReady, power })
    this.engine.uiReset()
  }

  private resetRunState(): void {
    this.runLane = this.level.startLane
    this.runCollected = this.level.collectibles.map(() => false)
  }

  /**
   * One sequencer step, called on the audio thread's schedule with the
   * exact audio time. Decides sound now, defers visuals to `whenDrawn`.
   */
  private onStep(step: number, time: number): void {
    if (this.winning) return
    if (step === 0) this.resetRunState()

    const note = this.store.get().sequence[step]
    if (note !== null && note !== undefined) {
      this.runLane = note
      this.engine.note(note, time)
    }
    const lane = this.runLane

    const hit = collectibleAt(this.level, step, lane)
    const pickedUp = hit >= 0 && !this.runCollected[hit]
    if (pickedUp) {
      this.runCollected[hit] = true
      this.engine.pickup(lane, time)
    }
    const collectedNow = [...this.runCollected]
    const solved = step === STEPS - 1 && collectedNow.every(Boolean)
    const stepSeconds = this.engine.stepSeconds

    if (solved) {
      this.winning = true
      this.engine.fanfare(time + stepSeconds)
    }

    this.engine.whenDrawn(time, () => {
      const s = this.store.get()
      if (s.phase !== 'playing') return
      const now = performance.now()
      this.store.set({
        playhead: step,
        prevStep: s.charStep,
        prevLane: s.charLane,
        charStep: step,
        charLane: lane,
        hopStartedAt: now,
        collected: collectedNow,
        lastPickup: pickedUp
          ? { step, lane, kind: this.level.collectibles[hit].kind, at: now }
          : s.lastPickup,
      })
    })

    if (solved) {
      this.engine.whenDrawn(time + stepSeconds, () => {
        const s = this.store.get()
        if (s.phase !== 'playing') return
        this.engine.stop()
        this.store.set({
          phase: 'won',
          playhead: null,
          wonAt: performance.now(),
          runs: s.runs + 1,
        })
      })
    } else if (step === STEPS - 1) {
      // Run finished without collecting everything: shortly before the
      // next loop starts, send the character back to the start pad and
      // put the fruit back so the next run reads as a fresh attempt.
      this.engine.whenDrawn(time + stepSeconds * 0.8, () => {
        const s = this.store.get()
        if (s.phase !== 'playing') return
        this.store.set({
          runs: s.runs + 1,
          charStep: -1,
          charLane: this.level.startLane,
          prevStep: -1,
          prevLane: this.level.startLane,
          hopStartedAt: performance.now(),
          collected: this.level.collectibles.map(() => false),
        })
      })
    }
  }
}
