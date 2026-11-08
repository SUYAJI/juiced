import { useEffect, useMemo, useState } from 'react'
import { AudioEngine } from './audio/engine'
import { GameController, type Action } from './game/controller'
import { LEVEL_01 } from './game/level'
import { GameStore, useGameState } from './game/store'
import type { HandheldContextValue } from './handheld/context'
import { attachKeyboard } from './input/keyboard'
import { Renderer } from './render/renderer'
import { Scene } from './scene/Scene'

/**
 * The 3D handheld. Builds the same store / engine / controller / renderer
 * as the flat game; the renderer draws into an offscreen 160x144 canvas
 * that the scene uses as the LCD texture.
 */
export default function HandheldApp() {
  const value = useMemo<HandheldContextValue>(() => {
    const store = new GameStore(LEVEL_01, 'off')
    const engine = new AudioEngine()
    const controller = new GameController(store, engine, LEVEL_01)
    const gameCanvas = document.createElement('canvas')
    const renderer = new Renderer(gameCanvas, store, LEVEL_01)
    const press = (action: Action) => {
      void controller.ensureAudio().then(() => controller.dispatch(action))
    }
    const togglePower = () => {
      void controller.ensureAudio().then(() => controller.togglePower())
    }
    return { store, controller, renderer, gameCanvas, press, togglePower }
  }, [])

  const { store, controller, press, togglePower } = value
  const state = useGameState(store)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    const detach = attachKeyboard(press, () => void controller.ensureAudio())
    const extra = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (e.key === 'p' || e.key === 'P') togglePower()
      if (e.key === 'f' || e.key === 'F') setFlipped((f) => !f)
    }
    window.addEventListener('keydown', extra)
    window.JUICED = {
      getState: () => store.get(),
      dispatch: press,
      togglePower,
      flip: (v?: boolean) => setFlipped((f) => (v === undefined ? !f : v)),
      canvas: value.gameCanvas,
    }
    return () => {
      detach()
      window.removeEventListener('keydown', extra)
      controller.dispose()
    }
  }, [controller, press, store, togglePower, value.gameCanvas])

  const off = state.power === 'off'

  return (
    <div className="handheld-page">
      <Scene value={value} flipped={flipped} />

      <header className="hud-top">
        <span className="hud-title">JUICED</span>
        <a className="hud-link" href="#flat">
          Flat view
        </a>
      </header>

      {off && !flipped && (
        <p className="hud-hint">Click the glowing switch on the top edge, tap Power, or press P</p>
      )}

      <nav className="hud-bar" aria-label="Device">
        <button
          className={`hud-btn ${off ? '' : 'is-on'}`}
          onClick={togglePower}
          aria-pressed={!off}
        >
          <span className="led" aria-hidden /> Power
        </button>
        <button className="hud-btn" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
          {flipped ? 'Show front' : 'Show back'}
        </button>
      </nav>

      <p className="hud-keys">
        Arrows · Z = A · X = B · Enter = Start · Shift = Select · P = Power · F = Flip
      </p>
    </div>
  )
}
