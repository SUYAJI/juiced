import * as Tone from 'tone'
import { BPM, PITCHES, STEP_NOTE, STEPS } from '../game/constants'
import type { Lane } from '../game/types'

export type StepCallback = (step: number, time: number) => void

/** Physical-object sounds that are not tied to a button. */
export type Sfx = 'cartOut' | 'cartIn' | 'flip' | 'setDown'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

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
  private cloth: Tone.NoiseSynth | null = null
  private stepCounter = 0

  // Tactile layer: plastic, rubber and metal sounds of the object itself.
  // Each voice is monophonic and very short; `at()` keeps every voice's
  // start times strictly increasing so rapid presses never throw.
  private tick!: Tone.NoiseSynth // the click of a part seating
  private tickBand!: Tone.Filter
  private thump!: Tone.MembraneSynth // the body of a press
  private slide!: Tone.NoiseSynth // plastic sliding against plastic
  private slideBand!: Tone.Filter
  private chirp!: Tone.Synth // little electronic responses
  private teeth!: Tone.NoiseSynth // zipper teeth, its own voice
  private last = new Map<object, number>()

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

    // Tactile layer, kept well under the music.
    const fx = new Tone.Volume(-4).connect(master)
    this.tickBand = new Tone.Filter({ type: 'bandpass', frequency: 3200, Q: 1.6 }).connect(fx)
    this.tick = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.016, sustain: 0, release: 0.008 },
    }).connect(this.tickBand)
    this.tick.volume.value = -10
    this.thump = new Tone.MembraneSynth({
      pitchDecay: 0.014,
      octaves: 2.5,
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
    }).connect(fx)
    this.thump.volume.value = -14
    this.slideBand = new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 0.9 }).connect(fx)
    this.slide = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.02, decay: 0.08, sustain: 0.5, release: 0.05 },
    }).connect(this.slideBand)
    this.slide.volume.value = -12
    this.chirp = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.03 },
    }).connect(fx)
    this.chirp.volume.value = -24
    const teethBand = new Tone.Filter({ type: 'bandpass', frequency: 4300, Q: 2.5 }).connect(fx)
    this.teeth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.009, sustain: 0, release: 0.005 },
    }).connect(teethBand)
    this.teeth.volume.value = -16

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

  // ---- Tactile layer: the object itself --------------------------------

  /** Next safe start time for a monophonic voice (strictly increasing). */
  private at(voice: object, offset = 0, gap = 0.012): number {
    const t = Math.max(Tone.now() + 0.004 + offset, (this.last.get(voice) ?? 0) + gap)
    this.last.set(voice, t)
    return t
  }

  private click(freq: number, q: number, vel: number, offset = 0): void {
    const t = this.at(this.tick, offset)
    this.tickBand.frequency.setValueAtTime(freq * rand(0.93, 1.07), t)
    this.tickBand.Q.setValueAtTime(q, t)
    this.tick.triggerAttackRelease(0.012, t, vel * rand(0.8, 1))
  }

  private body(freq: number, vel: number, offset = 0): void {
    const t = this.at(this.thump, offset)
    this.thump.triggerAttackRelease(freq * rand(0.96, 1.04), 0.05, t, vel * rand(0.85, 1))
  }

  private scrape(from: number, to: number, length: number, vel: number, offset = 0): void {
    const t = this.at(this.slide, offset, length + 0.02)
    this.slideBand.frequency.setValueAtTime(from, t)
    this.slideBand.frequency.exponentialRampToValueAtTime(to, t + length)
    this.slide.triggerAttackRelease(length, t, vel)
  }

  /**
   * The mechanical feel of a button, heard whether or not the device is on:
   * a crisp rocker tick for the D-pad, a rubbery thud for A and B, a small
   * soft click for the Start and Select pills.
   */
  press(action: string): void {
    if (!this.started) return
    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        this.click(3800, 2.2, 0.75)
        this.body(260, 0.25)
        break
      case 'a':
        this.click(1900, 1.2, 0.6)
        this.body(150, 0.7)
        break
      case 'b':
        this.click(1600, 1.2, 0.6)
        this.body(124, 0.7)
        break
      case 'start':
      case 'select':
        this.click(2600, 1.6, 0.45)
        this.body(330, 0.18)
        break
    }
  }

  /** The power switch sliding along the top edge and snapping into place. */
  powerSwitch(): void {
    if (!this.started) return
    this.scrape(1500, 2600, 0.045, 0.35)
    this.click(3000, 2, 0.9, 0.05)
    this.body(190, 0.35, 0.05)
  }

  /** The screen losing power: a short falling electronic sigh. */
  powerDown(): void {
    if (!this.started) return
    const t = this.at(this.chirp)
    this.chirp.triggerAttack(880, t, 0.6)
    this.chirp.frequency.exponentialRampToValueAtTime(110, t + 0.2)
    this.chirp.triggerRelease(t + 0.2)
    this.last.set(this.chirp, t + 0.24)
  }

  /** Physical handling sounds. */
  sfx(kind: Sfx): void {
    if (!this.started) return
    switch (kind) {
      case 'cartOut': // pulled up the slot, then pops free
        this.scrape(700, 2200, 0.16, 0.55)
        this.body(92, 0.8, 0.15)
        this.click(1400, 1, 0.5, 0.15)
        break
      case 'cartIn': {
        // slid down, seats with a click, contacts answer with a chirp
        this.scrape(2200, 800, 0.12, 0.5)
        this.click(2300, 1.4, 1, 0.13)
        this.body(118, 0.8, 0.13)
        const t = this.at(this.chirp, 0.24)
        this.chirp.triggerAttackRelease(1568, 0.04, t, 0.7)
        this.chirp.triggerAttackRelease(2093, 0.05, t + 0.06, 0.7)
        this.last.set(this.chirp, t + 0.12)
        break
      }
      case 'flip': // turned over in the hand: a soft plastic swish
        this.scrape(600, 1800, 0.16, 0.9)
        this.click(2200, 0.9, 0.55, 0.15)
        this.body(210, 0.3, 0.15)
        break
      case 'setDown': // laid back in the padded tray
        this.body(70, 0.6)
        this.scrape(900, 500, 0.06, 0.25)
        break
    }
  }

  /**
   * Zipper teeth: a run of tiny ticks that speeds up mid-pull and eases off,
   * starting `delay` seconds from now and lasting `duration`.
   */
  zipper(duration: number, delay = 0): void {
    if (!this.started) return
    const n = Math.max(6, Math.round(duration * 24))
    const start = this.at(this.teeth, delay)
    let t = start
    for (let i = 0; i < n; i++) {
      // ease in-out spacing: slower at the ends, fastest in the middle
      const u = i / n
      const ti = start + duration * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI) * 0.6)
      t = Math.max(t + 0.006, ti)
      this.teeth.triggerAttackRelease(0.006, t, rand(0.45, 1))
    }
    this.last.set(this.teeth, t)
  }

  // ---- Lunchbox: fabric -----------------------------------------------

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
