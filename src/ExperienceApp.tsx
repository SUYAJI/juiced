import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AudioEngine } from './audio/engine'
import { dismissBoot } from './boot'
import { createAnim } from './experience/anim'
import { ExperienceStore, prefersReducedMotion, useExperience } from './experience/store'
import { GameController, type Action } from './game/controller'
import { LEVEL_01 } from './game/level'
import { GameStore, useGameState } from './game/store'
import type { HandheldContextValue } from './handheld/context'
import { FRONT_Z, LCD } from './handheld/dims'
import { PartsStore, useParts } from './handheld/parts'
import { attachKeyboard } from './input/keyboard'
import { Renderer } from './render/renderer'
import { Scene } from './scene/Scene'

const SEEN_KEY = 'juiced.introSeen'
/** Touch-first devices get "tap" wording and no keyboard mentions. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches
const VERB = TOUCH ? 'Tap' : 'Click'
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The whole experience: the lunchbox, then the handheld. The game objects
 * (store, controller, audio, renderer) are the same ones Implementation 02
 * built; the experience store only decides where the device is.
 */
export default function ExperienceApp({ startInHand = false }: { startInHand?: boolean }) {
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const game = useMemo(() => {
    const store = new GameStore(LEVEL_01, 'off')
    const engine = new AudioEngine()
    const controller = new GameController(store, engine, LEVEL_01)
    const gameCanvas = document.createElement('canvas')
    const renderer = new Renderer(gameCanvas, store, LEVEL_01)
    const parts = new PartsStore()
    // a battery or the cartridge out means no power (composition is kept)
    parts.subscribe(() => controller.setPowerBlocked(parts.anyOut()))
    return { store, engine, controller, gameCanvas, renderer, parts }
  }, [])
  const exp = useMemo(() => new ExperienceStore(startInHand ? 'handheldActive' : 'lunchboxClosed', reduced), [startInHand, reduced])
  const anim = useMemo(() => {
    const a = createAnim()
    a.idle = reduced ? 0 : 1
    return a
  }, [reduced])

  const snap = useExperience(exp)
  const gameState = useGameState(game.store)
  const [flipped, setFlipped] = useState(false)
  const flippedRef = useRef(false)
  flippedRef.current = flipped
  const partsState = useParts(game.parts)
  const [seen, setSeen] = useState(readSeen)
  // The scene has drawn its first frames: drop the loading screen and
  // start listening for input (a tap before this would land on nothing).
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  const onReady = useCallback(() => {
    readyRef.current = true
    setReady(true)
    dismissBoot()
  }, [])
  // Won since it was last picked up / packed after a win (closing cue).
  const wonRef = useRef(false)
  const packRef = useRef(false)
  const [packed, setPacked] = useState(false)

  const value = useMemo<HandheldContextValue>(() => {
    const { store, controller, renderer, gameCanvas } = game
    const press = (action: Action) => {
      if (exp.state !== 'handheldActive') return
      void controller.ensureAudio().then(() => controller.dispatch(action))
    }
    const togglePower = () => {
      if (exp.state !== 'handheldActive') return
      void controller.ensureAudio().then(() => controller.togglePower())
    }
    return {
      store,
      controller,
      renderer,
      gameCanvas,
      press,
      togglePower,
      isActive: () => exp.state === 'handheldActive',
      isFlipped: () => flippedRef.current,
      parts: game.parts,
    }
  }, [game, exp])

  // ---- experience actions (each one is a user gesture, so audio can start)
  const actions = useMemo(() => {
    const { controller, engine } = game
    const withAudio = (fn: () => void) => void controller.ensureAudio().then(fn)
    return {
      open: () => {
        if (!exp.open()) return
        setPacked(false)
        withAudio(() => {
          setTimeout(() => engine.rustle(0.5), exp.durations.lidDelay * 1000)
        })
      },
      close: () => {
        if (!exp.close()) return
        withAudio(() => engine.rustle(0.45))
      },
      pickUp: () => {
        if (!exp.pickUp()) return
        withAudio(() => engine.rustle(0.3))
      },
      putBack: () => {
        if (!exp.putBack()) return
        // After a win, putting it back ends the visit: the bag zips itself shut.
        if (wonRef.current || game.store.get().phase === 'won') packRef.current = true
        setFlipped(false)
        game.parts.reseatAll()
        withAudio(() => setTimeout(() => engine.rustle(0.3), exp.durations.putBack * 700))
      },
      skip: () => {
        setPacked(false)
        exp.skipToHandheld()
      },
    }
  }, [game, exp])

  // ---- the victory moment ---------------------------------------------
  // 1. On a win, juice drops spill out of the screen with the fanfare.
  useEffect(() => {
    if (gameState.wonAt === null) return
    wonRef.current = true
    if (reduced || flippedRef.current || exp.state !== 'handheldActive') return
    game.parts.spawn({ origin: [0, LCD.y - LCD.h / 2, FRONT_Z], side: 'front', count: 14 })
  }, [gameState.wonAt, game, exp, reduced])

  // 2. Put back after a win: once it's lying in the tray, zip the bag shut.
  useEffect(() => {
    if (snap.state !== 'lunchboxOpen' || !packRef.current) return
    packRef.current = false
    wonRef.current = false
    const id = setTimeout(() => {
      if (exp.state !== 'lunchboxOpen') return
      setPacked(true)
      actions.close()
    }, reduced ? 150 : 500)
    return () => clearTimeout(id)
  }, [snap.state, exp, actions, reduced])

  // remember that the intro has been seen once the handheld is in hand
  useEffect(() => {
    if (snap.state !== 'handheldActive') return
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* storage unavailable: fine */
    }
    setSeen(true)
  }, [snap.state])

  useEffect(() => {
    const { controller, store } = game
    const detach = attachKeyboard(value.press, () => void controller.ensureAudio())
    const extra = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (!readyRef.current) return
      const s = exp.state
      if (s === 'handheldActive') {
        if (e.key === 'p' || e.key === 'P') value.togglePower()
        if (e.key === 'f' || e.key === 'F') setFlipped((f) => !f)
        if (e.key === 'Escape') actions.putBack()
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (s === 'lunchboxClosed') actions.open()
        else if (s === 'lunchboxOpen') actions.pickUp()
      } else if (e.key === 'Escape' && s === 'lunchboxOpen') {
        actions.close()
      }
    }
    window.addEventListener('keydown', extra)
    window.JUICED = {
      getState: () => store.get(),
      dispatch: value.press,
      togglePower: value.togglePower,
      flip: (v?: boolean) => setFlipped((f) => (v === undefined ? !f : v)),
      canvas: game.gameCanvas,
      experience: () => exp.state,
      open: actions.open,
      pickUp: actions.pickUp,
      putBack: actions.putBack,
      close: actions.close,
      parts: () => game.parts.get(),
      timeScale: (v: number) => {
        exp.timeScale = v
      },
    }
    return () => {
      detach()
      window.removeEventListener('keydown', extra)
      controller.dispose()
      document.body.style.cursor = 'auto'
    }
  }, [game, exp, value, actions])

  const s = snap.state
  const off = gameState.power === 'off'
  const missing = partsState.cart || partsState.batteries[0] || partsState.batteries[1]
  // First time at the controls: say what the puzzle is until the first run.
  const showGoal = gameState.power === 'on' && gameState.phase === 'edit' && gameState.runs === 0 && !flipped
  const won = gameState.power === 'on' && gameState.phase === 'won' && !flipped

  return (
    <div className="handheld-page" data-state={s} data-ready={ready}>
      <Scene
        value={value}
        exp={exp}
        anim={anim}
        flipped={flipped}
        onOpen={actions.open}
        onClose={actions.close}
        onPick={actions.pickUp}
        onReady={onReady}
      />

      <header className="hud-top">
        <span className="hud-title">JUICED</span>
        <a className="hud-link" href="#flat">
          Flat view
        </a>
      </header>

      {ready && s === 'lunchboxClosed' && packed && (
        <div className="hud-foot">
          <p className="hud-cue">All packed up. Thanks for playing.</p>
          <button className="hud-quiet" onClick={actions.open}>
            Unzip it again
          </button>
        </div>
      )}

      {ready && s === 'lunchboxClosed' && !packed && (
        <div className="hud-foot">
          <p className="hud-cue">{VERB} the lunchbox to unzip it</p>
          {seen && (
            <button className="hud-quiet" onClick={actions.skip}>
              Skip to the handheld
            </button>
          )}
        </div>
      )}

      {s === 'lunchboxOpen' && (
        <div className="hud-foot">
          <p className="hud-cue">{VERB} the handheld to pick it up</p>
          <button className="hud-quiet" onClick={actions.close}>
            Zip it back up
          </button>
        </div>
      )}

      {s === 'handheldActive' && (
        <>
          <button className={`hud-back ${won ? 'is-cta' : ''}`} onClick={actions.putBack} title="Esc">
            ← Put it back
          </button>
          {off && missing && (
            <p className="hud-hint">
              {partsState.cart && (partsState.batteries[0] || partsState.batteries[1])
                ? 'Put the batteries and cartridge back to power on'
                : partsState.cart
                  ? 'Put the cartridge back to power on'
                  : 'Put the batteries back to power on'}
            </p>
          )}
          {off && !missing && !flipped && (
            <p className="hud-hint">
              {TOUCH
                ? 'Tap the glowing switch on the top edge, or tap Power'
                : 'Click the glowing switch on the top edge, click Power, or press P'}
            </p>
          )}
          {won && <p className="hud-hint is-win">Juiced! Remix your tune, or put the handheld back to pack up.</p>}
          {showGoal && (
            <p className="hud-hint">
              Each note moves the drop to its row. Catch all three fruit in one run, then{' '}
              {TOUCH ? 'tap Start (the right small button).' : 'press Start (Enter).'}
            </p>
          )}
          <nav className="hud-bar" aria-label="Device">
            <button className={`hud-btn ${off ? '' : 'is-on'}`} onClick={value.togglePower} aria-pressed={!off}>
              <span className="led" aria-hidden /> Power
            </button>
            <button className="hud-btn" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
              {flipped ? 'Show front' : 'Show back'}
            </button>
          </nav>
          <p className="hud-keys">
            Arrows · Z = A · X = B · Enter = Start · Shift = Select · P = Power · F = Flip · Esc = Put back
          </p>
        </>
      )}
    </div>
  )
}
