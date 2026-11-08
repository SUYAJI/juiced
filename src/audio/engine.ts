import * as Tone from 'tone'
import { BPM, PITCHES, STEP_NOTE, STEPS } from '../game/constants'
import type { Lane } from '../game/types'

export type StepCallback = (step: number, time: number) => void

/**
 * All sound lives here. The Transport is the single clock: the controller
 * receives `onStep(step, time)` from `scheduleRepeat`, triggers notes at
 * `time`, and mirrors visual changes through `whenDrawn(time, fn)` so
 * movement and sound share one timeline.
 */
export class AudioEngine {
  private started = false
  private lead!: Tone.PolySynth<Tone.Synth>
  private blip!: Tone.PolySynth<Tone.Synth>
  private ui!: Tone.PolySynth<Tone.Synth>
  private repeatId: number | null = null
  private master!: Tone.Volume
  private zipSynth: Tone.NoiseSynth | null = null
  private zipLfo: Tone.LFO | null = null
  private cloth: Tone.NoiseSynth | null = null
  private stepCounter = 0

  get isStarted(): boolean {
    return this.started
  }

  /** Must be called from a user gesture (click or key press). */
  async start(): Promise<void> {
    if (this.started) return
    await Tone.start()

    const master = new Tone.Volume(-6).toDestination()
    this.master = master
    const echo = new Tone.FeedbackDelay({
      delayTime: STEP_NOTE,
      feedback: 0.22,
      wet: 0.18,
    }).connect(master)

    // Main voice: soft triangle, short and round.
    // Polyphonic so notes already scheduled ahead (a stopped run, the boot
    // chime, the fanfare) can never collide and throw timing errors.
    this.lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.14, sustain: 0.3, release: 0.2 },
    }).connect(echo)
    this.lead.maxPolyphony = 8

    // Pickup voice: thin square, very short. Polyphonic so overlapping
    // triggers never throw timing errors.
    this.blip = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 },
    }).connect(master)
    this.blip.volume.value = -12
    this.blip.maxPolyphony = 8

    // Editing feedback: tiny and dry. Polyphonic for the same reason;
    // the player can mash buttons faster than a note decays.
    this.ui = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
    }).connect(master)
    this.ui.volume.value = -14
    this.ui.maxPolyphony = 8

    const transport = Tone.getTransport()
    transport.bpm.value = BPM
    // Visual callbacks carry game state (pickups, the win). Tone drops Draw
    // events older than `expiration`; on a slow device a dropped win would
    // leave the run stuck. Never drop: late events apply in order on the
    // next frame, so sync is exact on normal frames and correct on slow ones.
    Tone.getDraw().expiration = 3600
    this.started = true
  }

  /** Duration of one step in seconds, from the Transport tempo. */
  get stepSeconds(): number {
    return Tone.Time(STEP_NOTE).toSeconds()
  }

  now(): number {
    return Tone.now()
  }

  /** Run `fn` on the animation frame closest to audio time `time`. */
  whenDrawn(time: number, fn: () => void): void {
    Tone.getDraw().schedule(fn, time)
  }

  /** Start the looping step clock. */
  play(onStep: StepCallback): void {
    const transport = Tone.getTransport()
    this.stop()
    this.stepCounter = 0
    this.repeatId = transport.scheduleRepeat(
      (time) => {
        const step = this.stepCounter % STEPS
        this.stepCounter++
        onStep(step, time)
      },
      STEP_NOTE,
      0,
    )
    transport.start('+0.05')
  }

  /** Stop the clock and clear everything scheduled on it. */
  stop(): void {
    if (!this.started) return
    const transport = Tone.getTransport()
    if (this.repeatId !== null) {
      transport.clear(this.repeatId)
      this.repeatId = null
    }
    transport.stop()
    transport.position = 0
    // Cut anything already scheduled ahead so a stopped run goes quiet.
    this.lead?.releaseAll()
    this.blip?.releaseAll()
  }

  // ---- Musical events -------------------------------------------------

  note(lane: Lane, time: number): void {
    this.lead.triggerAttackRelease(PITCHES[lane], '16n', time)
  }

  pickup(lane: Lane, time: number): void {
    const base = Tone.Frequency(PITCHES[lane])
    this.blip.triggerAttackRelease(base.transpose(12).toNote(), '32n', time + 0.02)
    this.blip.triggerAttackRelease(base.transpose(19).toNote(), '32n', time + 0.09)
  }

  fanfare(time: number): void {
    const notes = ['C5', 'E5', 'G5', 'C6']
    notes.forEach((n, i) => {
      this.lead.triggerAttackRelease(n, '16n', time + i * 0.11)
    })
    this.blip.triggerAttackRelease('G6', '16n', time + 0.5)
    this.blip.triggerAttackRelease('C7', '8n', time + 0.6)
  }

  /** Short original power-on chime. */
  bootChime(time: number): void {
    this.lead.triggerAttackRelease('C5', '16n', time)
    this.lead.triggerAttackRelease('G5', '16n', time + 0.13)
    this.blip.triggerAttackRelease('C6', '16n', time + 0.3)
    this.blip.triggerAttackRelease('E6', '8n', time + 0.42)
  }

  // ---- Lunchbox: zipper and fabric -----------------------------------

  /**
   * A zipper run: band-passed noise chopped by a square LFO (the teeth),
   * speeding up mid-pull. Built on first use.
   */
  zip(duration: number): void {
    if (!this.started) return
    if (!this.zipSynth) {
      const gate = new Tone.Gain(0)
      this.zipLfo = new Tone.LFO({ frequency: 36, min: 0.15, max: 1, type: 'square' }).connect(gate.gain).start()
      const band = new Tone.Filter({ type: 'bandpass', frequency: 3000, Q: 0.8 })
      const vol = new Tone.Volume(-15).connect(this.master)
      this.zipSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.03, decay: 0.05, sustain: 0.8, release: 0.12 },
      })
      this.zipSynth.chain(band, gate, vol)
    }
    const t = Tone.now() + 0.01
    const f = this.zipLfo!.frequency
    f.cancelScheduledValues(t)
    f.setValueAtTime(26, t)
    f.linearRampToValueAtTime(58, t + duration * 0.45)
    f.linearRampToValueAtTime(34, t + duration)
    try {
      this.zipSynth.triggerAttackRelease(duration, t)
    } catch {
      /* a second pull mid-pull: ignore */
    }
  }

  /** Soft fabric handling: a short low-passed pink noise brush. */
  rustle(length = 0.4): void {
    if (!this.started) return
    if (!this.cloth) {
      const lp = new Tone.Filter({ type: 'lowpass', frequency: 1300, Q: 0.3 })
      const vol = new Tone.Volume(-19).connect(this.master)
      this.cloth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.07, decay: length, sustain: 0, release: 0.1 },
      })
      this.cloth.chain(lp, vol)
    }
    try {
      this.cloth.triggerAttackRelease(length, Tone.now() + 0.01)
    } catch {
      /* overlapping rustle: ignore */
    }
  }

  // ---- Editing feedback ----------------------------------------------

  uiMove(): void {
    if (!this.started) return
    this.ui.triggerAttackRelease('C6', '64n')
  }

  uiPlace(lane: Lane): void {
    if (!this.started) return
    const t = Tone.now()
    this.ui.triggerAttackRelease(Tone.Frequency(PITCHES[lane]).transpose(12).toNote(), '32n', t)
  }

  uiRemove(): void {
    if (!this.started) return
    const t = Tone.now()
    this.ui.triggerAttackRelease('E5', '64n', t)
    this.ui.triggerAttackRelease('C5', '64n', t + 0.05)
  }

  uiReset(): void {
    if (!this.started) return
    const t = Tone.now()
    this.ui.triggerAttackRelease('G5', '64n', t)
    this.ui.triggerAttackRelease('E5', '64n', t + 0.05)
    this.ui.triggerAttackRelease('C5', '64n', t + 0.1)
  }
}
