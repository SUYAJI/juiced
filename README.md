# JUICED — Implementation 03

A tiny musical puzzle game for a virtual handheld. Eight steps, four pitches,
one juice drop, three fruit. Compose the melody that carries the drop across
all three fruit in a single run.

Implementation 03 opens with a 3D recreation of the real 1997 yellow soft
lunchbox. Unzip it, fold the cap back, and pick up the purple handheld from
Implementation 02 to play. `#handheld` jumps straight to the handheld;
`#flat` runs the 2D game on its own.

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

## Lunchbox flow

Tap the lunchbox (or Enter) to unzip it; tap the handheld (or Enter) to pick
it up; "Put it back" (or Esc) returns it; "Zip it back up" closes the bag.
After the first visit a quiet "Skip to the handheld" appears. Game state is
kept through all of it. Reduced-motion users get short, simple transitions.

The lunchbox artwork is cut from the photos in `assets-src/lunchbox/photos`:

    python3 tools/extract_lunchbox_decals.py   # photos -> ink-only decals
    python3 tools/bake_lunchbox_textures.py    # decals + fabric -> public/lunchbox/*.jpg

## Structure

    src/game/      constants, types, level, pure run simulation, store, controller (rules)
    src/audio/     Tone.js engine; the Transport is the single clock
    src/render/    Canvas 2D renderer, 3x5 pixel font, palette, sprites
    src/input/     keyboard mapping
    src/ui/        on-screen controls (React)
    src/handheld/  3D device : dims (measured from photos), shell geometry,
                   generated label textures, buttons, stickers, back, cartridge
    src/lunchbox/  soft lunchbox : dims, soft surface + lid deformation, geometry
                   build (split at the zipper), fabric textures, contents
    src/experience/ state machine, shared animation values, camera director,
                   device carrier (tray <-> hand)
    src/scene/     R3F canvas, lights, surface, rig
    src/App.tsx    routes between ExperienceApp (default, #handheld) and FlatApp (#flat)
    public/stickers/  the three stickers, cut from the photo of the real device

`window.JUICED` exposes `getState()`, `dispatch(action)`, `togglePower()`,
`flip()` and `canvas` (the live 160x144 LCD source) for tests and hosts.

The 3D buttons call the same `GameController.dispatch` as the keyboard; the
controller's `onPress` lets the model depress buttons for keyboard input too.
