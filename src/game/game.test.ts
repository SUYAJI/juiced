import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../audio/engine'
import { PartsStore } from '../handheld/parts'
import { STEPS } from './constants'
import { GameController, type Action } from './controller'
import { LEVEL_01 } from './level'
import { emptySequence, simulateRun } from './logic'
import { GameStore } from './store'

/** The tune the README and the hints describe: G on step 2, C on 5, E on 7. */
const SOLUTION: Action[] = ['right', 'up', 'up', 'a', 'right', 'right', 'right', 'down', 'down', 'down', 'a', 'right', 'right', 'up', 'up', 'a']

/** A stand-in for the Tone.js engine that records calls and runs the clock by hand. */
function fakeEngine() {
  let onStep: ((step: number, time: number) => void) | null = null
  const calls: string[] = []
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push(args.length ? `${name}:${args[0]}` : name)
  }
  const engine = {
    isStarted: true,
    stepSeconds: 0.3,
    start: async () => {},
    now: () => 0,
    play: (cb: (step: number, time: number) => void) => {
      onStep = cb
    },
    stop: vi.fn(),
    whenDrawn: (_t: number, fn: () => void) => fn(),
    press: rec('press'),
    powerSwitch: rec('powerSwitch'),
    powerDown: rec('powerDown'),
    bootChime: rec('bootChime'),
    note: rec('note'),
    pickup: rec('pickup'),
    fanfare: rec('fanfare'),
    uiMove: rec('uiMove'),
    uiPlace: rec('uiPlace'),
    uiRemove: rec('uiRemove'),
    uiReset: rec('uiReset'),
  }
  /** Advance the sequencer through one full loop. */
  const loop = () => {
    for (let s = 0; s < STEPS; s++) onStep?.(s, s * 0.3)
  }
  return { engine: engine as unknown as AudioEngine, calls, loop }
}

function setup(power: 'off' | 'on' = 'off') {
  const store = new GameStore(LEVEL_01, power)
  const fake = fakeEngine()
  const controller = new GameController(store, fake.engine, LEVEL_01)
  return { store, controller, ...fake }
}

describe('puzzle', () => {
  it('level 01 is solved by the documented melody and not by silence', () => {
    const seq = emptySequence()
    seq[1] = 0 // G
    seq[4] = 3 // C
    seq[6] = 1 // E
    expect(simulateRun(seq, LEVEL_01).solved).toBe(true)
    expect(simulateRun(emptySequence(), LEVEL_01).solved).toBe(false)
  })

  it('composing the solution and pressing Start wins in one loop', () => {
    const { store, controller, loop, calls } = setup('on')
    SOLUTION.forEach((a) => controller.dispatch(a))
    controller.dispatch('start')
    expect(store.get().phase).toBe('playing')
    loop()
    expect(store.get().phase).toBe('won')
    expect(calls.some((c) => c.startsWith('fanfare'))).toBe(true)
    expect(calls.filter((c) => c.startsWith('pickup'))).toHaveLength(3)
  })
})

describe('tactile sound', () => {
  it('every button clicks, even with the power off, without changing the game', () => {
    const { store, controller, calls } = setup('off')
    const before = store.get()
    for (const a of ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'] as Action[]) controller.dispatch(a)
    expect(calls.filter((c) => c.startsWith('press:'))).toEqual([
      'press:up',
      'press:down',
      'press:left',
      'press:right',
      'press:a',
      'press:b',
      'press:start',
      'press:select',
    ])
    expect(store.get()).toBe(before) // nothing else happened while off
  })

  it('the power switch clicks both ways, and the screen sighs only when it goes dark', () => {
    const { store, controller, calls } = setup('off')
    controller.togglePower()
    expect(store.get().power).toBe('booting')
    controller.togglePower()
    expect(store.get().power).toBe('off')
    expect(calls.filter((c) => c === 'powerSwitch')).toHaveLength(2)
    expect(calls.filter((c) => c === 'powerDown')).toHaveLength(1)
  })
})

describe('parts', () => {
  it('the cartridge is the only removable part', () => {
    const parts = new PartsStore()
    expect(parts.get()).toEqual({ cart: false })
    expect('toggleBattery' in parts).toBe(false)
    expect(parts.toggleCart()).toBe(true)
    expect(parts.anyOut()).toBe(true)
    parts.reseatAll()
    expect(parts.get()).toEqual({ cart: false })
  })

  it('pulling the cartridge cuts power, keeps the tune, and blocks power until it is back', () => {
    const { store, controller } = setup('on')
    controller.dispatch('right')
    controller.dispatch('a')
    const tune = store.get().sequence
    controller.setPowerBlocked(true)
    expect(store.get().power).toBe('off')
    expect(store.get().sequence).toEqual(tune)
    controller.togglePower()
    expect(store.get().power).toBe('off')
    controller.setPowerBlocked(false)
    controller.togglePower()
    expect(store.get().power).toBe('booting')
  })
})
