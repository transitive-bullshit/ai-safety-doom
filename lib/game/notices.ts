import type { GameNotice } from './types'

type TimedNotice = { notice: GameNotice; remaining: number }
export const NOTICE_SECONDS = { pickup: 5, weapon: 8, kill: 4, event: 5 }
const MAX_FEATURED = 4
const MAX_KILLS = 2

/** Pickup jokes get reading time even during combat; kills have their own lane. */
export class GameNotices {
  private nextId = 0
  private featured: TimedNotice[] = []
  private kills: TimedNotice[] = []

  add(input: Omit<GameNotice, 'id'>, { interrupt = false } = {}) {
    const entry = {
      notice: { ...input, id: ++this.nextId },
      remaining: NOTICE_SECONDS[input.kind]
    }
    if (input.kind === 'kill') {
      this.kills = [...this.kills.slice(-(MAX_KILLS - 1)), entry]
    } else if (input.kind === 'weapon' || interrupt) {
      // Urgent incidents and new arguments appear now, then the interrupted joke resumes.
      this.featured = [entry, ...this.featured].slice(0, MAX_FEATURED)
    } else if (this.featured.length < MAX_FEATURED) {
      this.featured.push(entry)
    } else {
      // Keep the current joke and next discoveries; refresh only the backlog tail.
      this.featured[MAX_FEATURED - 1] = entry
    }
  }

  step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    for (const entry of this.kills) entry.remaining -= seconds
    this.kills = this.kills.filter((entry) => entry.remaining > 0)
    let elapsed = seconds
    while (this.featured.length && elapsed > 0) {
      const current = this.featured[0]!
      const consumed = Math.min(elapsed, current.remaining)
      current.remaining -= consumed
      elapsed -= consumed
      if (current.remaining <= 0) this.featured.shift()
    }
  }

  snapshot(): GameNotice[] {
    return [...this.featured.slice(0, 1), ...this.kills].map(({ notice }) => ({
      ...notice
    }))
  }
}
