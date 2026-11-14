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
  cart: boolean
}

type Listener = () => void

/**
 * The removable cartridge, plus a tiny event channel for the juice-drop
 * critters (they tumble out when the cartridge is lifted, and spill from the
 * screen on a win). Kept outside the game store: it is about the object, not
 * the game. Taking the cartridge out powers the device off (see ExperienceApp).
 * The batteries are fixed in the bay: they are scenery, not a control.
 */
export class PartsStore {
  private state: PartsState = { cart: false }
  private listeners = new Set<Listener>()
  private spawners = new Set<(r: SpawnRequest) => void>()

  get(): PartsState {
    return this.state
  }

  anyOut(): boolean {
    return this.state.cart
  }

  private set(next: PartsState) {
    this.state = next
    this.listeners.forEach((l) => l())
  }

  toggleCart(): boolean {
    this.set({ cart: !this.state.cart })
    return this.state.cart
  }

  /** Put the cartridge back (used when the handheld goes back in the lunchbox). */
  reseatAll(): void {
    if (!this.anyOut()) return
    this.set({ cart: false })
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
