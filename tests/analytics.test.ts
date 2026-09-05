import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createGameLifecycleTracker,
  type GameLifecycleEvent,
  type GameEventProperties
} from '../lib/game/analytics'
import { initialSnapshot, type GameSnapshot } from '../lib/game/types'

function snapshot(
  phase: GameSnapshot['phase'],
  overrides: Partial<GameSnapshot> = {}
): GameSnapshot {
  return { ...initialSnapshot(10), phase, totalEnemies: 21, ...overrides }
}

function recorder() {
  const events: {
    name: GameLifecycleEvent
    properties: GameEventProperties
  }[] = []
  return {
    events,
    track: createGameLifecycleTracker((name, properties) =>
      events.push({ name, properties })
    )
  }
}

void test('a run tracks one start and one player death across repeated snapshots and pauses', () => {
  const { events, track } = recorder()
  track(snapshot('loading'))
  track(snapshot('paused'))
  track(snapshot('playing'))
  track(snapshot('playing', { elapsed: 1.9 }))
  track(snapshot('paused', { elapsed: 2.3 }))
  track(snapshot('playing', { elapsed: 2.3 }))
  track(
    snapshot('dead', {
      elapsed: 14.9,
      kills: 4,
      secrets: 1
    })
  )
  track(snapshot('dead', { elapsed: 15.1, kills: 4, secrets: 1 }))

  assert.deepEqual(events, [
    {
      name: 'Game Started',
      properties: { difficulty: 10, totalRisks: 21 }
    },
    {
      name: 'Player Died',
      properties: {
        difficulty: 10,
        elapsedSeconds: 14,
        risksMitigated: 4,
        totalRisks: 21,
        secretsFound: 1
      }
    }
  ])
})

void test('a completed run records its result once and a fresh tracker starts a new run', () => {
  const events: {
    name: GameLifecycleEvent
    properties: GameEventProperties
  }[] = []
  const send = (name: GameLifecycleEvent, properties: GameEventProperties) =>
    events.push({ name, properties })

  const first = createGameLifecycleTracker(send)
  first(snapshot('playing', { difficulty: 50, totalEnemies: 23 }))
  first(
    snapshot('won', {
      difficulty: 50,
      elapsed: 72.4,
      kills: 23,
      totalEnemies: 23,
      secrets: 2
    })
  )
  first(snapshot('dead', { difficulty: 50, totalEnemies: 23 }))

  const replay = createGameLifecycleTracker(send)
  replay(snapshot('playing', { difficulty: 90, totalEnemies: 29 }))

  assert.deepEqual(events, [
    {
      name: 'Game Started',
      properties: { difficulty: 50, totalRisks: 23 }
    },
    {
      name: 'Level Finished',
      properties: {
        difficulty: 50,
        elapsedSeconds: 72,
        risksMitigated: 23,
        totalRisks: 23,
        secretsFound: 2
      }
    },
    {
      name: 'Game Started',
      properties: { difficulty: 90, totalRisks: 29 }
    }
  ])
})
