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
      projectWorld?: (x: number, y: number, z: number) => { x: number; y: number }
      /** Experience state (lunchbox flow) and its actions. */
      experience?: () => string
      open?: () => void
      pickUp?: () => void
      putBack?: () => void
      close?: () => void
      timeScale?: (v: number) => void
      parts?: () => { batteries: [boolean, boolean]; cart: boolean }
    }
  }
}

export {}
