import { useSyncExternalStore } from 'react'
import type { GameState, Level, Power } from './types'
import { emptySequence } from './logic'

type Listener = () => void

/**
 * Minimal external store. The renderer reads `get()` every frame; React
 * components subscribe through `useGameState()` for the on-screen controls.
 */
export class GameStore {
  private state: GameState
  private listeners = new Set<Listener>()

  constructor(level: Level, power: Power = 'on') {
    this.state = { ...initialState(level), power }
  }

  get(): GameState {
    return this.state
  }

  set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export function initialState(level: Level): GameState {
  return {
    sequence: emptySequence(),
    cursorStep: 0,
    cursorLane: level.startLane,
    phase: 'edit',
    playhead: null,
    charStep: -1,
    charLane: level.startLane,
    prevStep: -1,
    prevLane: level.startLane,
    hopStartedAt: 0,
    collected: level.collectibles.map(() => false),
    lastPickup: null,
    wonAt: null,
    runs: 0,
    audioReady: false,
    power: 'on',
    bootStartedAt: 0,
  }
}

export function useGameState(store: GameStore): GameState {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
    () => store.get(),
  )
}
