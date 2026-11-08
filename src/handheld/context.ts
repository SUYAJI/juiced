import { createContext, useContext } from 'react'
import type { Action, GameController } from '../game/controller'
import type { GameStore } from '../game/store'
import type { Renderer } from '../render/renderer'

export interface HandheldContextValue {
  store: GameStore
  controller: GameController
  renderer: Renderer
  gameCanvas: HTMLCanvasElement
  /** Send a button press (unlocks audio first). */
  press: (action: Action) => void
  togglePower: () => void
}

export const HandheldContext = createContext<HandheldContextValue | null>(null)

export function useHandheld(): HandheldContextValue {
  const v = useContext(HandheldContext)
  if (!v) throw new Error('useHandheld must be used inside HandheldContext')
  return v
}
