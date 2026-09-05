import assert from 'node:assert/strict'
import { test } from 'node:test'

import { at, ceilingHeight, floorHeight, LEVEL } from '../lib/game/level'
import {
  ARRIVAL_GRACE_SECONDS,
  DIFFICULTY_SETTINGS,
  GameWorld
} from '../lib/game/model'
import type { GameInput, Projectile } from '../lib/game/model'
import type { Difficulty } from '../lib/game/types'

const idle: GameInput = {
  forward: 0,
  strafe: 0,
  turn: 0,
  fire: false,
  sprint: false
}
const tick = 1 / 60

function angleBetween(a: Projectile, b: Projectile) {
  return Math.atan2(a.dx * b.dz - a.dz * b.dx, a.dx * b.dx + a.dz * b.dz)
}

function encounter(difficulty: Difficulty = 10) {
  const world = new GameWorld(difficulty)
  const boss = world.enemies.find((enemy) => enemy.kind === 'sam')!
  for (let row = 1; row < LEVEL.grid.length - 1; row++) {
    for (let column = 1; column < LEVEL.grid[row]!.length - 3; column++) {
      const lane = Array.from({ length: 3 }, (_, offset) =>
        at(column + offset, row)
      )
      const y = floorHeight(lane[0]!.x, lane[0]!.z)
      if (
        !lane.every(
          (point, offset) =>
            LEVEL.grid[row]![column + offset] === '.' &&
            floorHeight(point.x, point.z) === y &&
            ceilingHeight(point.x, point.z) - y >= 3.6
        )
      )
        continue
      Object.assign(world.player, lane[0], {
        y,
        angle: -Math.PI / 2,
        vx: 0,
        vy: 0,
        vz: 0,
        grounded: true
      })
      Object.assign(boss, lane[2], {
        y,
        home: lane[2],
        alerted: true,
        cooldown: 1000
      })
      world.enemies = [boss]
      world.pickups = []
      world.barrels = []
      world.time = ARRIVAL_GRACE_SECONDS + 1
      assert.ok(world.hasLineOfSight(boss, world.player))
      return { world, boss }
    }
  }
  throw new Error('The level needs an open boss firing lane')
}

function enrage(world: GameWorld) {
  const boss = world.enemies[0]!
  boss.health = boss.maxHealth / 2
  world.step(tick, idle)
  assert.equal(world.bossEnraged, true)
  boss.cooldown = 0
}

function startAttack(world: GameWorld) {
  for (let frame = 0; frame < 240; frame++) {
    world.step(tick, idle)
    world.projectiles = []
    if (world.enemies[0]!.state === 'attack') {
      assert.equal(world.enemies[0]!.stateTime, 0)
      return world.time
    }
  }
  throw new Error('The boss did not begin its attack')
}

function recordAttack(world: GameWorld) {
  const shots: { time: number; projectile: Projectile }[] = []
  for (let frame = 0; frame < 120; frame++) {
    world.step(tick, idle)
    for (const projectile of world.projectiles)
      shots.push({ time: world.time, projectile: { ...projectile } })
    // Capture releases without letting a fixture player absorb the whole fight.
    world.projectiles = []
    if (world.enemies[0]!.state !== 'attack') return shots
  }
  throw new Error('The boss never recovered from its attack')
}

function waitForRocket(world: GameWorld) {
  for (let frame = 0; frame < 120; frame++) {
    world.step(tick, idle)
    if (world.projectiles.length) return
  }
  throw new Error('The boss did not release its rocket')
}

void test('a surviving half-health crossing announces one phase and a new run resets it', () => {
  const { world, boss } = encounter()
  boss.health = boss.maxHealth / 2 + 1
  world.step(tick, idle)
  assert.equal(world.bossEnraged, false)

  world.step(tick, { ...idle, fire: true })
  assert.ok(boss.health > 0 && boss.health < boss.maxHealth / 2)
  assert.equal(world.bossEnraged, true)
  const notice = world
    .snapshot()
    .notices.find((item) => item.subject === 'boss-enraged')!
  assert.equal(notice.kind, 'event')
  for (let frame = 0; frame < 60; frame++)
    world.step(tick, { ...idle, fire: true })
  assert.equal(
    world.snapshot().notices.find((item) => item.subject === 'boss-enraged')
      ?.id,
    notice.id
  )
  for (let frame = 0; frame < 360; frame++) world.step(tick, idle)
  assert.ok(
    !world.snapshot().notices.some((item) => item.subject === 'boss-enraged')
  )

  const fresh = encounter()
  assert.equal(fresh.world.bossEnraged, false)
  fresh.boss.cooldown = 0
  startAttack(fresh.world)
  assert.equal(fresh.boss.bossVolley?.pattern, 'wide')
})

void test('a fatal damage batch suppresses escalation and pending rockets', () => {
  for (const alreadyEnraged of [false, true]) {
    const { world, boss } = encounter()
    if (alreadyEnraged) {
      enrage(world)
      boss.cooldown = 1000
      for (let frame = 0; frame < 360; frame++) world.step(tick, idle)
      boss.cooldown = 0
      startAttack(world)
    }
    boss.health = 1
    world.step(tick, { ...idle, fire: true })
    assert.equal(world.bossDefeated, true)
    assert.equal(world.bossEnraged, alreadyEnraged)
    for (let frame = 0; frame < 90; frame++) world.step(tick, idle)
    assert.equal(world.projectiles.length, 0)
    assert.ok(
      !world.snapshot().notices.some((item) => item.subject === 'boss-enraged')
    )
  }
})

void test('all tiers alternate a telegraphed tight burst with the original simultaneous wide fan', () => {
  for (const difficulty of [1, 10, 50, 90, 99] as const) {
    const { world, boss } = encounter(difficulty)
    enrage(world)
    for (const pattern of ['rapid', 'wide', 'rapid'] as const) {
      const began = startAttack(world)
      assert.equal(boss.bossVolley?.pattern, pattern)
      const shots = recordAttack(world)
      assert.equal(shots.length, 3)
      assert.ok(
        shots.every(
          ({ projectile }) =>
            projectile.owner === 'enemy' &&
            projectile.kind === 'rocket' &&
            projectile.enemyKind === boss.kind
        )
      )
      const delay = shots[0]!.time - began
      assert.ok(
        delay >=
          (pattern === 'rapid' ? (difficulty <= 10 ? 0.66 : 0.58) : 0.48) - 1e-6
      )
      const angles = shots.map(({ projectile }) =>
        angleBetween(shots[0]!.projectile, projectile)
      )
      if (pattern === 'rapid') {
        const minimumSpacing = difficulty <= 10 ? 0.15 : 0.13
        for (let index = 1; index < shots.length; index++) {
          const spacing = shots[index]!.time - shots[index - 1]!.time
          assert.ok(Math.abs(spacing - minimumSpacing) <= tick + 1e-6)
        }
        assert.ok(Math.max(...angles) - Math.min(...angles) < 0.08)
      } else {
        assert.ok(shots.every((shot) => shot.time === shots[0]!.time))
        assert.ok(Math.max(...angles) - Math.min(...angles) > 0.3)
      }
      const speed = Math.hypot(shots[0]!.projectile.dx, shots[0]!.projectile.dz)
      assert.ok(
        Math.abs(speed - 11 * DIFFICULTY_SETTINGS[difficulty].speed) < 1e-6
      )
    }
  }
})

void test('crossing half health during a committed wide windup preserves that attack', () => {
  const { world, boss } = encounter(99)
  boss.cooldown = 0
  startAttack(world)
  assert.equal(boss.bossVolley?.pattern, 'wide')
  boss.health = boss.maxHealth / 2
  world.step(tick, idle)
  assert.equal(world.bossEnraged, true)
  assert.equal(boss.bossVolley?.pattern, 'wide')
  const shots = recordAttack(world)
  assert.equal(shots.length, 3)
  assert.ok(shots.every((shot) => shot.time === shots[0]!.time))
  startAttack(world)
  assert.equal(boss.bossVolley?.pattern, 'rapid')
})

void test('rapid rockets commit to the initial target so a sidestep evades the burst', () => {
  const { world, boss } = encounter(99)
  enrage(world)
  startAttack(world)
  waitForRocket(world)
  const first = { ...world.projectiles[0]! }
  const target = { ...boss.bossVolley!.target! }
  world.projectiles = []
  world.player.z += 0.9
  const remaining = recordAttack(world)
  assert.equal(remaining.length, 2)
  assert.deepEqual(boss.bossVolley!.target, target)
  for (const { projectile } of remaining)
    assert.ok(Math.abs(angleBetween(first, projectile)) < 0.04)
})

void test('lost sight or a pain interruption cancels the remaining rapid rockets', () => {
  for (const interruption of ['cover', 'pain'] as const) {
    const { world, boss } = encounter(99)
    enrage(world)
    startAttack(world)
    waitForRocket(world)
    world.projectiles = []
    if (interruption === 'cover') {
      const hidden = LEVEL.grid
        .flatMap((row, z) =>
          row.split('').flatMap((tile, x) => (tile === '.' ? [at(x, z)] : []))
        )
        .find(
          (point) =>
            !world.hasLineOfSight(boss, {
              ...point,
              y: floorHeight(point.x, point.z)
            })
        )!
      assert.ok(hidden)
      Object.assign(world.player, hidden, {
        y: floorHeight(hidden.x, hidden.z)
      })
      world.step(0.1, idle)
      world.step(0.1, idle)
      assert.equal(boss.bossVolley!.shotsFired, 3)
    } else {
      world.step(tick, { ...idle, fire: true })
      assert.equal(boss.state, 'hurt')
    }
    for (let frame = 0; frame < 20; frame++) world.step(tick, idle)
    assert.equal(world.projectiles.length, 0)
  }
})
