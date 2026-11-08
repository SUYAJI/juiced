import type { Action } from './game/controller'
import type { GameState } from './game/types'

declare global {
  interface Window {
    JUICED?: {
      getState: () => GameState
      dispatch: (action: Action) => void
      togglePower?: () => void
      flip?: (value?: boolean) => void
      /** The live 160x144 game canvas (the LCD texture source). */
      canvas?: HTMLCanvasElement
      /** Device-space point to page pixels (3D view only). */
      project?: (x: number, y: number, z: number) => { x: number; y: number }
    }
  }
}

export {}
