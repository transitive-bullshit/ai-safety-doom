import type { GameSnapshot } from './types'

export type GameLifecycleEvent =
  | 'Game Started'
  | 'Player Died'
  | 'Level Finished'

export type GameEventProperties = Record<
  string,
  string | number | boolean | null
>

type SendEvent = (
  name: GameLifecycleEvent,
  properties: GameEventProperties
) => void

function sendVercelEvent(
  name: GameLifecycleEvent,
  properties: GameEventProperties
) {
  // The game itself is loaded on demand, and analytics should stay off its hot path.
  void import('@vercel/analytics')
    .then(({ track }) => track(name, properties))
    .catch(() => {})
}

function resultProperties(snapshot: GameSnapshot) {
  return {
    difficulty: snapshot.difficulty,
    elapsedSeconds: Math.floor(snapshot.elapsed),
    risksMitigated: snapshot.kills,
    totalRisks: snapshot.totalEnemies,
    secretsFound: snapshot.secrets
  } satisfies GameEventProperties
}

/** Track one start and at most one terminal outcome for a single training run. */
export function createGameLifecycleTracker(send: SendEvent = sendVercelEvent) {
  let started = false
  let ended = false

  return (snapshot: GameSnapshot) => {
    if (!started) {
      if (snapshot.phase !== 'playing') return
      started = true
      send('Game Started', {
        difficulty: snapshot.difficulty,
        totalRisks: snapshot.totalEnemies
      })
      return
    }

    if (ended || (snapshot.phase !== 'dead' && snapshot.phase !== 'won')) return
    ended = true
    send(
      snapshot.phase === 'dead' ? 'Player Died' : 'Level Finished',
      resultProperties(snapshot)
    )
  }
}
