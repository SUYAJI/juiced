import { STEPS } from './constants'
import type { Lane, Level, Sequence } from './types'

export function emptySequence(): Sequence {
  return Array.from({ length: STEPS }, () => null)
}

/**
 * Pure simulation of one run. Returns the lane the character occupies at
 * each step and which collectibles get picked up. Used for tests and for
 * verifying a level is solvable; the live game applies the same rule
 * step by step from the audio clock.
 */
export function simulateRun(sequence: Sequence, level: Level) {
  const lanes: Lane[] = []
  let lane: Lane = level.startLane
  const collected = level.collectibles.map(() => false)

  for (let step = 0; step < STEPS; step++) {
    const note = sequence[step]
    if (note !== null && note !== undefined) lane = note
    lanes.push(lane)
    level.collectibles.forEach((c, i) => {
      if (c.step === step && c.lane === lane) collected[i] = true
    })
  }

  return { lanes, collected, solved: collected.every(Boolean) }
}

/** Index of the collectible at a cell, or -1. */
export function collectibleAt(level: Level, step: number, lane: Lane): number {
  return level.collectibles.findIndex((c) => c.step === step && c.lane === lane)
}
