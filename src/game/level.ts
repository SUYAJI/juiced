import type { Level } from './types'

/**
 * The first puzzle. Three fruit at different column/lane positions.
 * One straightforward solution: G on step 1, C on step 4, E on step 6.
 * Several others exist because held lanes carry across silent steps.
 */
export const LEVEL_01: Level = {
  startLane: 2,
  collectibles: [
    { step: 1, lane: 0, kind: 'orange' },
    { step: 4, lane: 3, kind: 'berry' },
    { step: 6, lane: 1, kind: 'lime' },
  ],
}
