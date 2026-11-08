# JUICED — Implementation 02

A tiny musical puzzle game for a virtual handheld. Eight steps, four pitches,
one juice drop, three fruit. Compose the melody that carries the drop across
all three fruit in a single run.

Implementation 02 puts the game inside a 3D model of the real purple handheld
(React Three Fiber). The 2D game still runs on its own at `#flat`.

## Run

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # production build in dist/ (relative base, host anywhere)
    npm run preview    # serve dist/ locally

## Controls

| Game Boy | Keyboard | Action |
|---|---|---|
| D-pad left/right | Arrow left/right | choose step |
| D-pad up/down | Arrow up/down | choose pitch (G E D C, top to bottom) |
| A | Z | place / toggle note at the selected cell |
| B | X | clear the selected step |
| Start | Enter | play / stop the loop |
| Select | Shift | reset the puzzle |

On-screen buttons mirror these. Any first key or click unlocks audio.

3D handheld extras : click/tap the device's buttons directly; the power switch
is on the top edge (or the Power button, or P). F or "Show back" turns the
device around. Drag to tilt a little; scroll/pinch to zoom a little.
The boot sequence (~2.3 s) is skipped by pressing any game button.

## Structure

    src/game/      constants, types, level, pure run simulation, store, controller (rules)
    src/audio/     Tone.js engine; the Transport is the single clock
    src/render/    Canvas 2D renderer, 3x5 pixel font, palette, sprites
    src/input/     keyboard mapping
    src/ui/        on-screen controls (React)
    src/handheld/  3D device : dims (measured from photos), shell geometry,
                   generated label textures, buttons, stickers, back, cartridge
    src/scene/     R3F canvas, lighting, constrained camera
    src/App.tsx    routes between HandheldApp (default) and FlatApp (#flat)
    public/stickers/  the three stickers, cut from the photo of the real device

`window.JUICED` exposes `getState()`, `dispatch(action)`, `togglePower()`,
`flip()` and `canvas` (the live 160x144 LCD source) for tests and hosts.

The 3D buttons call the same `GameController.dispatch` as the keyboard; the
controller's `onPress` lets the model depress buttons for keyboard input too.
