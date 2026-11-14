import type { Action } from '../game/controller'

/** Keyboard mapping for the handheld inputs. */
const KEY_MAP: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  z: 'a',
  Z: 'a',
  x: 'b',
  X: 'b',
  Enter: 'start',
  Shift: 'select',
}

export function actionForKey(e: KeyboardEvent): Action | null {
  return KEY_MAP[e.key] ?? null
}

/**
 * Attach key handling to the window. Returns a cleanup function.
 * `onAction` receives the mapped action; `onAnyKey` fires first so the
 * caller can unlock audio on the gesture.
 */
export function attachKeyboard(
  onAction: (action: Action) => void,
  onAnyKey: () => void,
): () => void {
  const held = new Set<string>()
  const down = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    onAnyKey()
    const action = actionForKey(e)
    if (!action) return
    e.preventDefault()
    if (held.has(e.key)) return // ignore auto-repeat
    held.add(e.key)
    onAction(action)
  }
  const up = (e: KeyboardEvent) => held.delete(e.key)
  const blur = () => held.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}
