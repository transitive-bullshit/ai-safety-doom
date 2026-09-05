import assert from 'node:assert/strict'
import { test } from 'node:test'

import { GameNotices, NOTICE_SECONDS } from '../lib/game/notices'
import type { GameNotice } from '../lib/game/types'

const notice = (kind: GameNotice['kind'], subject: string) => ({
  kind,
  subject,
  title: subject,
  detail: `${subject}-detail`
})

void test('featured pickups receive full reading time while kills expire independently', () => {
  const feed = new GameNotices()
  feed.add(notice('pickup', 'first'))
  feed.step(1)
  feed.add(notice('pickup', 'second'))
  feed.add(notice('kill', 'enemy'))
  assert.deepEqual(
    feed.snapshot().map((item) => item.subject),
    ['first', 'enemy']
  )
  feed.step(NOTICE_SECONDS.pickup - 1)
  assert.deepEqual(
    feed.snapshot().map((item) => item.subject),
    ['second']
  )
  feed.step(NOTICE_SECONDS.pickup - 0.1)
  assert.equal(feed.snapshot()[0]!.subject, 'second')
  feed.step(0.1)
  assert.deepEqual(feed.snapshot(), [])
})

void test('weapon discoveries interrupt a pickup and then restore its remaining reading time', () => {
  const feed = new GameNotices()
  feed.add(notice('pickup', 'pickup'))
  feed.step(2)
  feed.add(notice('weapon', 'weapon'))
  feed.add(notice('kill', 'enemy'))
  feed.step(NOTICE_SECONDS.weapon - 0.1)
  assert.equal(feed.snapshot()[0]!.subject, 'weapon')
  feed.step(0.1)
  assert.equal(feed.snapshot()[0]!.subject, 'pickup')
  feed.step(NOTICE_SECONDS.pickup - 2)
  assert.deepEqual(feed.snapshot(), [])
})

void test('notification bursts are bounded, identities remain unique, and snapshots cannot mutate the feed', () => {
  const feed = new GameNotices()
  for (let i = 0; i < 100; i++) {
    feed.add(notice('pickup', `pickup-${i}`))
    feed.add(notice('kill', `kill-${i}`))
  }
  const first = feed.snapshot()
  assert.equal(first.length, 3)
  assert.equal(new Set(first.map((entry) => entry.id)).size, first.length)
  assert.deepEqual(
    first.slice(1).map((entry) => entry.subject),
    ['kill-98', 'kill-99']
  )
  first[0]!.subject = 'mutation'
  assert.equal(feed.snapshot()[0]!.subject, 'pickup-0')
  const observed: string[] = []
  for (let i = 0; i < 10; i++) {
    const current = feed.snapshot()[0]
    if (current) observed.push(current.subject!)
    feed.step(NOTICE_SECONDS.pickup)
  }
  assert.equal(observed.length, 4)
  assert.equal(observed.at(-1), 'pickup-99')
  assert.deepEqual(feed.snapshot(), [])
})

void test('elapsed-time overflow advances queued notices and invalid time leaves them unchanged', () => {
  const feed = new GameNotices()
  feed.add(notice('event', 'event'))
  feed.add(notice('pickup', 'pickup'))
  const initial = feed.snapshot()
  for (const seconds of [NaN, Infinity, -1, 0]) feed.step(seconds)
  assert.deepEqual(feed.snapshot(), initial)
  feed.step(NOTICE_SECONDS.event + NOTICE_SECONDS.pickup)
  assert.deepEqual(feed.snapshot(), [])
})
