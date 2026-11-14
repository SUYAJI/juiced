import { createContext, useContext } from 'react'
import type { Sfx } from '../audio/engine'
import type { Action, GameController } from '../game/controller'
import type { GameStore } from '../game/store'
import type { Renderer } from '../render/renderer'
import type { PartsStore } from './parts'

export interface HandheldContextValue {
  store: GameStore
  controller: GameController
  renderer: Renderer
  gameCanvas: HTMLCanvasElement
  /** Send a button press (unlocks audio first). */
  press: (action: Action) => void
  togglePower: () => void
  /**
   * True only while the handheld is in your hands (handheldActive). In the
   * lunchbox its buttons are inert and a click picks the whole device up.
   */
  isActive: () => boolean
  /** True while the device is turned to show its back. */
  isFlipped: () => boolean
  /** Removable cartridge, and the critter channel. */
  parts: PartsStore
  /** Play a tactile sound for a physical interaction (unlocks audio first). */
  sfx: (kind: Sfx) => void
}

export const HandheldContext = createContext<HandheldContextValue | null>(null)

export function useHandheld(): HandheldContextValue {
  const v = useContext(HandheldContext)
  if (!v) throw new Error('useHandheld must be used inside HandheldContext')
  return v
}
