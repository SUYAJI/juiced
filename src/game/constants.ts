// Shared constants for JUICED. Everything else derives from these.

export const STEPS = 8
export const LANES = 4
export const BPM = 100
// One sequencer step = one eighth note. At 100 BPM that is 300 ms,
// so a full eight-step run lasts 2.4 seconds.
export const STEP_NOTE = '8n'

// Lane 0 is the top of the screen, lane 3 the bottom.
// Four notes from C major pentatonic so any combination sounds fine.
export const PITCHES = ['G4', 'E4', 'D4', 'C4'] as const
export const PITCH_LABELS = ['G', 'E', 'D', 'C'] as const

// Boot sequence length in ms (any button skips it).
export const BOOT_MS = 2300

// Logical screen size, Game Boy Color style.
export const SCREEN_W = 160
export const SCREEN_H = 144
