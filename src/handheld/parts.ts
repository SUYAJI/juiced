import { useSyncExternalStore } from 'react'

/** Which device face a burst of critters runs across. */
export type Side = 'front' | 'back'

export interface SpawnRequest {
  /** Where they come out, in the device's own centimetre coordinates. */
  origin: [number, number, number]
  side: Side
  count: number
}

export interface PartsState {
  batteries: [boolean, boolean]
  cart: boolean
}

type Listener = () => void

/**
 * Removable parts of the handheld (the two AAs and the cartridge), plus a
 * tiny event channel for the juice-drop critters that tumble out when a
 * part is lifted. Kept outside the game store: it is about the object,
 * not the game. Taking a part out powers the device off (see ExperienceApp).
 */
export class PartsStore {
  private state: PartsState = { batteries: [false, false], cart: false }
  private listeners = new Set<Listener>()
  private spawners = new Set<(r: SpawnRequest) => void>()

  get(): PartsState {
    return this.state
  }

  anyOut(): boolean {
    return this.state.cart || this.state.batteries[0] || this.state.batteries[1]
  }

  private set(next: PartsState) {
    this.state = next
    this.listeners.forEach((l) => l())
  }

  toggleBattery(i: 0 | 1): boolean {
    const batteries: [boolean, boolean] = [...this.state.batteries]
    batteries[i] = !batteries[i]
    this.set({ ...this.state, batteries })
    return batteries[i]
  }

  toggleCart(): boolean {
    this.set({ ...this.state, cart: !this.state.cart })
    return this.state.cart
  }

  /** Put everything back (used when the handheld goes back in the lunchbox). */
  reseatAll(): void {
    if (!this.anyOut()) return
    this.set({ batteries: [false, false], cart: false })
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  spawn(req: SpawnRequest): void {
    this.spawners.forEach((s) => s(req))
  }

  onSpawn(s: (r: SpawnRequest) => void): () => void {
    this.spawners.add(s)
    return () => this.spawners.delete(s)
  }
}

export function useParts(store: PartsStore): PartsState {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
    () => store.get(),
  )
}
