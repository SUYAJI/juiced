import { useEffect, useMemo, useRef } from 'react'
import { AudioEngine } from './audio/engine'
import { GameController, type Action } from './game/controller'
import { LEVEL_01 } from './game/level'
import { GameStore, useGameState } from './game/store'
import { attachKeyboard } from './input/keyboard'
import { Renderer } from './render/renderer'
import { Controls } from './ui/Controls'

export default function FlatApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // One store / engine / controller for the life of the app.
  const { store, controller } = useMemo(() => {
    const store = new GameStore(LEVEL_01)
    const engine = new AudioEngine()
    const controller = new GameController(store, engine, LEVEL_01)
    return { store, controller }
  }, [])

  const state = useGameState(store)

  // Any gesture may be the first one; unlock audio, then act.
  const handle = (action: Action) => {
    void controller.ensureAudio().then(() => controller.dispatch(action))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas, store, LEVEL_01)
    renderer.start()
    const detach = attachKeyboard(handle, () => void controller.ensureAudio())
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.location.hash = 'handheld'
    }
    window.addEventListener('keydown', onEsc)
    // Small external handle: lets tests (and later the 3D host) read state
    // and send inputs without going through DOM events.
    window.JUICED = {
      getState: () => store.get(),
      dispatch: handle,
      togglePower: () => void controller.ensureAudio().then(() => controller.togglePower()),
      canvas: canvasRef.current ?? undefined,
    }
    return () => {
      renderer.stop()
      detach()
      window.removeEventListener('keydown', onEsc)
      controller.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="shell">
      <a className="back-btn" href="#handheld">
        ← Back to handheld
      </a>
      <div
        className="screen-frame"
        onPointerDown={() => void controller.ensureAudio()}
        data-phase={state.phase}
      >
        <canvas ref={canvasRef} className="screen" width={160} height={144} />
      </div>

      <Controls onAction={handle} />

      <p className="hint">
        Arrows: step / pitch · Z: A · X: B · Enter: Start · Shift: Select · Esc: back to handheld
      </p>
    </main>
  )
}
