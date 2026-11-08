import type { Action } from '../game/controller'

interface Props {
  onAction: (action: Action) => void
}

/**
 * On-screen handheld controls for testing without a keyboard.
 * Layout mirrors a Game Boy: D-pad left, A/B right, Select/Start below.
 */
export function Controls({ onAction }: Props) {
  const press = (action: Action) => (e: React.PointerEvent) => {
    e.preventDefault()
    onAction(action)
  }

  return (
    <div className="controls" aria-label="Game controls">
      <div className="dpad">
        <button className="dpad-btn up" onPointerDown={press('up')} aria-label="Up" title="Up arrow">
          ▲
        </button>
        <button className="dpad-btn left" onPointerDown={press('left')} aria-label="Left" title="Left arrow">
          ◀
        </button>
        <div className="dpad-center" />
        <button className="dpad-btn right" onPointerDown={press('right')} aria-label="Right" title="Right arrow">
          ▶
        </button>
        <button className="dpad-btn down" onPointerDown={press('down')} aria-label="Down" title="Down arrow">
          ▼
        </button>
      </div>

      <div className="ab">
        <button className="round-btn b" onPointerDown={press('b')} title="X key">
          B
        </button>
        <button className="round-btn a" onPointerDown={press('a')} title="Z key">
          A
        </button>
      </div>

      <div className="menu">
        <button className="pill-btn" onPointerDown={press('select')} title="Shift key">
          SELECT
        </button>
        <button className="pill-btn" onPointerDown={press('start')} title="Enter key">
          START
        </button>
      </div>
    </div>
  )
}
