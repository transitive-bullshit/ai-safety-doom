import assert from 'node:assert/strict'
import { test } from 'node:test'

import { at, CELL, floorHeight, ceilingHeight, LEVEL } from '../lib/game/level'
import {
  direction,
  distance,
  rayBox,
  rayCircle,
  rayBox3,
  rayCylinder
} from '../lib/game/math'
import {
  AMMO_LIMITS,
  BARREL_HEIGHT,
  BARREL_HEALTH,
  BARREL_RADIUS,
  ARRIVAL_GRACE_SECONDS,
  DIFFICULTY_SETTINGS,
  ENEMY_HEIGHT,
  GameWorld,
  MAX_STEP_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  WEAPON_COST,
  WEAPON_POOL
} from '../lib/game/model'
import type { Barrel, Door, Enemy, GameInput } from '../lib/game/model'
import type { Difficulty, EnemyKind, Point, WeaponId } from '../lib/game/types'
import { SHUTDOWN_CHARGE_SECONDS } from '../lib/game/types'

const idle: GameInput = {
  forward: 0,
  strafe: 0,
  turn: 0,
  fire: false,
  sprint: false
}

function advance(
  world: GameWorld,
  seconds: number,
  input: Partial<GameInput> = {}
) {
  const ticks = Math.ceil(seconds * 60)
  for (let tick = 0; tick < ticks; tick++)
    world.step(seconds / ticks, { ...idle, ...input })
}

function isolatedWorld() {
  const world = new GameWorld(10)
  world.enemies = []
  world.barrels = []
  world.pickups = []
  return world
}

function target(kind: EnemyKind, point: Point, id = 'target'): Enemy {
  const definition = new GameWorld(10).enemies.find(
    (enemy) => enemy.kind === kind
  )!
  return {
    ...definition,
    ...point,
    y: floorHeight(point.x, point.z),
    id,
    home: point,
    cooldown: 1000
  }
}

function placePlayer(world: GameWorld, point: Point, angle = 0) {
  Object.assign(world.player, point, {
    y: floorHeight(point.x, point.z),
    vx: 0,
    vz: 0,
    vy: 0,
    grounded: true,
    angle
  })
}

function approachDoor(world: GameWorld, door: Door) {
  const approach = [
    [0, CELL],
    [0, -CELL],
    [CELL, 0],
    [-CELL, 0]
  ]
    .map(([dx, dz]) => ({ x: door.x + dx!, z: door.z + dz! }))
    .find((point) => !world.isBlocked(point.x, point.z))!
  placePlayer(
    world,
    approach,
    Math.atan2(-(door.x - approach.x), -(door.z - approach.z))
  )
  return approach
}

function openDoorWorld() {
  const world = isolatedWorld()
  const door = world.doors.find((candidate) => !candidate.secret)!
  const approach = approachDoor(world, door)
  world.interact()
  advance(world, 0.8)
  world.drainEvents()
  return { world, door, approach }
}

function doorActions(world: GameWorld) {
  return world
    .drainEvents()
    .filter((event) => event.type === 'door')
    .map((event) => event.doorAction)
}

function openRun() {
  for (let row = 1; row < LEVEL.grid.length - 1; row++) {
    for (let column = 1; column < LEVEL.grid[row]!.length - 5; column++) {
      const points = Array.from({ length: 5 }, (_, offset) =>
        at(column + offset, row)
      )
      if (
        points.every(
          (point, index) =>
            LEVEL.grid[row]![column + index] === '.' &&
            floorHeight(point.x, point.z) ===
              floorHeight(points[0]!.x, points[0]!.z) &&
            ceilingHeight(point.x, point.z) - floorHeight(point.x, point.z) >=
              3.6
        )
      ) {
        return {
          start: points[0]!,
          near: points[2]!,
          far: points[4]!,
          angle: -Math.PI / 2
        }
      }
    }
  }
  throw new Error('The level needs an open firing lane')
}

function pathLength(from: Point, to: Point) {
  const start = [Math.floor(from.x / CELL), Math.floor(from.z / CELL), 0]
  const end = `${Math.floor(to.x / CELL)},${Math.floor(to.z / CELL)}`
  const queue = [start]
  const visited = new Set([`${start[0]},${start[1]}`])
  for (const [x, z, depth] of queue) {
    if (`${x},${z}` === end) return depth!
    if (depth! > 14) continue
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nx = x! + dx!,
        nz = z! + dz!,
        key = `${nx},${nz}`
      if (visited.has(key) || LEVEL.grid[nz]?.[nx] !== '.') continue
      const a = at(x!, z!),
        b = at(nx, nz)
      if (
        floorHeight(b.x, b.z) - floorHeight(a.x, a.z) >
        MAX_STEP_HEIGHT + 1e-6
      )
        continue
      visited.add(key)
      queue.push([nx, nz, depth! + 1])
    }
  }
  return Infinity
}

function barrierPair() {
  for (let row = 1; row < LEVEL.grid.length - 1; row++) {
    for (let column = 1; column < LEVEL.grid[row]!.length - 1; column++) {
      if (LEVEL.grid[row]![column] !== '.') continue
      for (const [dx, dz] of [
        [1, 0],
        [0, 1]
      ]) {
        if (LEVEL.grid[row + dz!]?.[column + dx!] !== '#') continue
        for (let width = 2; width <= 4; width++) {
          const x = column + dx! * width,
            z = row + dz! * width
          if (LEVEL.grid[z]?.[x] !== '.') continue
          const start = at(column, row),
            end = at(x, z)
          if (pathLength(start, end) <= 14)
            return { start, end, angle: Math.atan2(-dx!, -dz!) }
        }
      }
    }
  }
  throw new Error('The level needs an occluding wall with a navigable detour')
}

function heightEdges() {
  const edges: { low: Point; high: Point; rise: number }[] = []
  for (let row = 1; row < LEVEL.grid.length - 1; row++) {
    for (let column = 1; column < LEVEL.grid[row]!.length - 1; column++) {
      if (LEVEL.grid[row]![column] !== '.') continue
      for (const [dx, dz] of [
        [1, 0],
        [0, 1]
      ]) {
        if (LEVEL.grid[row + dz!]?.[column + dx!] !== '.') continue
        const a = at(column, row),
          b = at(column + dx!, row + dz!)
        const rise = floorHeight(b.x, b.z) - floorHeight(a.x, a.z)
        if (Math.abs(rise) > 0.001)
          edges.push(
            rise > 0
              ? { low: a, high: b, rise }
              : { low: b, high: a, rise: -rise }
          )
      }
    }
  }
  return edges
}

const toward = (from: Point, to: Point) =>
  Math.atan2(-(to.x - from.x), -(to.z - from.z))

void test('momentum accelerates quickly, brakes firmly, and is independent of frame rate', () => {
  const lane = openRun()
  const runs = [30, 60, 120].map((fps) => {
    const world = isolatedWorld()
    placePlayer(world, lane.start, lane.angle)
    world.step(1 / fps, { ...idle, forward: 1 })
    assert.ok(Math.hypot(world.player.vx, world.player.vz) > 0)
    assert.ok(Math.hypot(world.player.vx, world.player.vz) < PLAYER_WALK_SPEED)
    for (let frame = 1; frame < fps; frame++)
      world.step(1 / fps, { ...idle, forward: 1 })
    const release = { ...world.player }
    for (let frame = 0; frame < fps / 2; frame++) world.step(1 / fps, idle)
    assert.ok(distance(release, world.player) < 0.3)
    assert.ok(Math.hypot(world.player.vx, world.player.vz) < 0.001)
    return world.player
  })
  for (const run of runs) assert.ok(distance(run, runs[0]!) < 1e-7)
})

void test('small stairs are climbable, high ledges block ascent, and drops land under gravity', () => {
  const edges = heightEdges()
  const step = edges.find((edge) => edge.rise <= MAX_STEP_HEIGHT)!
  const ledge = edges.find((edge) => edge.rise > MAX_STEP_HEIGHT * 2)!
  assert.ok(step && ledge)
  const stairs = isolatedWorld()
  placePlayer(stairs, step.low, toward(step.low, step.high))
  for (
    let tick = 0;
    tick < 120 && distance(stairs.player, step.high) > 0.4;
    tick++
  )
    stairs.step(1 / 60, { ...idle, forward: 1 })
  assert.ok(distance(stairs.player, step.high) < 0.5)
  assert.equal(stairs.player.y, floorHeight(step.high.x, step.high.z))

  const blocked = isolatedWorld()
  placePlayer(blocked, ledge.low, toward(ledge.low, ledge.high))
  advance(blocked, 1, { forward: 1 })
  assert.ok(distance(blocked.player, ledge.low) < CELL / 2)
  assert.equal(blocked.player.y, floorHeight(ledge.low.x, ledge.low.z))

  const falling = isolatedWorld()
  placePlayer(falling, ledge.high, toward(ledge.high, ledge.low))
  advance(falling, 0.5, { forward: 1 })
  assert.equal(falling.player.grounded, false)
  assert.ok(falling.player.vy < 0)
  assert.ok(falling.player.y > floorHeight(ledge.low.x, ledge.low.z))
  advance(falling, 1)
  assert.equal(
    falling.player.y,
    floorHeight(falling.player.x, falling.player.z)
  )
  assert.equal(falling.player.grounded, true)
  assert.equal(falling.player.vy, 0)
  assert.ok(falling.landingCounter > 0)
  assert.ok(
    falling
      .drainEvents()
      .some((event) => event.type === 'land' && event.impact! > 2)
  )
})

void test('pursuing enemies take a stair detour instead of climbing a visible high ledge', () => {
  const edge = heightEdges().find(
    (candidate) =>
      candidate.rise > MAX_STEP_HEIGHT &&
      pathLength(candidate.low, candidate.high) < 14
  )!
  assert.ok(edge)
  const world = isolatedWorld()
  world.time = ARRIVAL_GRACE_SECONDS
  placePlayer(world, edge.high)
  const enemy = target('sycophant', edge.low)
  enemy.alerted = true
  world.enemies = [enemy]
  for (let frame = 0; frame < 60 * 25; frame++) {
    const previousY = enemy.y
    world.step(1 / 60, idle)
    assert.ok(enemy.y - previousY <= MAX_STEP_HEIGHT + 1e-6)
    assert.equal(world.isBlocked(enemy.x, enemy.z, 0.4), false)
  }
  assert.ok(distance(enemy, world.player) < 2)
  assert.equal(enemy.y, world.player.y)
})

void test('vertical rays and cylinders discriminate heights and exact slab contacts', () => {
  assert.equal(
    rayCylinder(
      { x: 0, y: 5, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      1,
      2
    ),
    Infinity
  )
  assert.equal(
    rayCylinder(
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      1,
      2
    ),
    4
  )
  assert.equal(
    rayBox3(
      { x: 0, y: 3, z: 0 },
      { x: 1, y: -0.5, z: 0 },
      { minX: 2, maxX: 8, minY: -Infinity, maxY: 1, minZ: -1, maxZ: 1 }
    ),
    4
  )
})

void test('height-aware autoaim hits an elevated actor and projectiles collide with floor risers', () => {
  const edge = heightEdges().find(
    (candidate) => candidate.rise > MAX_STEP_HEIGHT * 2 && candidate.rise < 2.5
  )!
  assert.ok(edge)
  const world = isolatedWorld()
  placePlayer(world, edge.low, toward(edge.low, edge.high))
  const enemy = target('deception', edge.high)
  world.enemies = [enemy]
  const before = enemy.health
  world.step(1 / 60, { ...idle, fire: true })
  assert.ok(enemy.health < before)
  world.player.owned.push(2)
  world.player.ammo[2] = 20
  world.selectWeapon(2)
  advance(world, 0.35)
  world.step(1 / 60, { ...idle, fire: true })
  assert.ok(world.projectiles[0]!.vy > 0)
  const heightBefore = world.projectiles[0]!.y
  advance(world, 0.04)
  assert.ok(world.projectiles[0]!.y > heightBefore)

  const obstructed = isolatedWorld()
  const ray = direction(toward(edge.low, edge.high))
  const start = { ...edge.low, y: floorHeight(edge.low.x, edge.low.z) + 0.2 }
  obstructed.projectiles.push({
    id: 'low-shot',
    ...start,
    dx: ray.x * 200,
    dz: ray.z * 200,
    vy: 0,
    kind: 'plasma',
    owner: 'player',
    life: 5
  })
  advance(obstructed, 0.1)
  assert.equal(obstructed.projectiles.length, 0)
})

void test('ray intersections handle tangency, origin containment, parallel slabs, and rear targets', () => {
  const origin = { x: 0, z: 0 }
  const ray = { x: 1, z: 0 }
  assert.equal(rayCircle(origin, ray, { x: 5, z: 0 }, 1), 4)
  assert.equal(rayCircle(origin, ray, { x: 5, z: 1 }, 1), 5)
  assert.equal(rayCircle(origin, ray, { x: -5, z: 0 }, 1), Infinity)
  assert.equal(rayCircle(origin, ray, origin, 1), 0)
  assert.equal(rayBox(origin, ray, { minX: 2, maxX: 3, minZ: -1, maxZ: 1 }), 2)
  assert.equal(
    rayBox(origin, ray, { minX: 2, maxX: 3, minZ: 1, maxZ: 2 }),
    Infinity
  )
  assert.equal(
    rayBox(origin, ray, { minX: -2, maxX: -1, minZ: -1, maxZ: 1 }),
    Infinity
  )
  assert.equal(rayBox(origin, ray, { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }), 0)
  assert.deepEqual(direction(0), { x: -0, z: -1 })
})

void test('the authored level has reachable entities, resources, doors, and finale', () => {
  const widths = new Set(LEVEL.grid.map((row) => row.length))
  assert.equal(widths.size, 1)
  const start = [
    Math.floor(LEVEL.spawn.x / CELL),
    Math.floor(LEVEL.spawn.z / CELL)
  ]
  const reached = new Set([start.join(',')])
  const queue = [start]
  for (const [column, row] of queue) {
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]) {
      const next = [column! + dx!, row! + dz!]
      const cell = LEVEL.grid[next[1]!]?.[next[0]!]
      const key = next.join(',')
      if (!cell || cell === '#' || reached.has(key)) continue
      const from = at(column!, row!)
      const to = at(next[0]!, next[1]!)
      if (
        floorHeight(to.x, to.z) - floorHeight(from.x, from.z) >
        MAX_STEP_HEIGHT + 1e-6
      )
        continue
      reached.add(key)
      queue.push(next)
    }
  }
  for (const point of [
    ...LEVEL.enemies,
    ...LEVEL.reinforcements,
    ...LEVEL.pickups,
    ...LEVEL.doors,
    LEVEL.shutdown
  ]) {
    const key = `${Math.floor(point.x / CELL)},${Math.floor(point.z / CELL)}`
    assert.ok(reached.has(key), `Unreachable entity at ${key}`)
  }
  for (const row of LEVEL.grid) assert.equal(row[0], '#')
  assert.ok(LEVEL.grid[0]!.split('').every((cell) => cell === '#'))
  assert.ok(
    LEVEL.grid
      .at(-1)!
      .split('')
      .every((cell) => cell === '#')
  )
  assert.ok(
    LEVEL.pickups
      .filter((pickup) => pickup.kind === 'weapon')
      .every((pickup) => pickup.weapon !== undefined)
  )
  assert.ok(floorHeight(LEVEL.spawn.x, LEVEL.spawn.z) > 0)
})

void test('each enemy alerts once on sight, respecting occlusion and nightmare resurrection', () => {
  const lane = openRun()
  const barrier = barrierPair()
  const kinds = new Set(new GameWorld(50).enemies.map((enemy) => enemy.kind))
  for (const kind of kinds) {
    const world = new GameWorld(99)
    world.pickups = []
    world.barrels = []
    placePlayer(world, barrier.start, barrier.angle)
    const enemy = target(kind, barrier.end)
    world.enemies = [enemy]
    world.step(1 / 60, idle)
    assert.equal(enemy.alerted, false)
    assert.equal(world.drainEvents().length, 0)

    Object.assign(enemy, lane.near, {
      y: floorHeight(lane.near.x, lane.near.z),
      home: lane.near
    })
    placePlayer(world, lane.start, lane.angle)
    world.step(1 / 60, idle)
    const alerts = world
      .drainEvents()
      .filter((event) => event.type === 'enemy-alert')
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0]!.kind, kind)
    assert.equal(alerts[0]!.x, lane.near.x)
    assert.equal(alerts[0]!.z, lane.near.z)
    assert.ok(typeof alerts[0]!.y === 'number' && alerts[0]!.y! > enemy.y)
    advance(world, 1)
    assert.equal(
      world.drainEvents().filter((event) => event.type === 'enemy-alert')
        .length,
      0
    )

    // Re-entering sight after resurrection gets a fresh bark; Sam stays dead.
    Object.assign(enemy, { health: 0, state: 'dead', stateTime: 22.1 })
    placePlayer(world, LEVEL.shutdown)
    world.step(1 / 60, idle)
    world.drainEvents()
    placePlayer(world, lane.start, lane.angle)
    world.step(1 / 60, idle)
    assert.equal(
      world.drainEvents().filter((event) => event.type === 'enemy-alert')
        .length,
      kind === 'sam' ? 0 : 1
    )
  }
})

void test('damage wakes surviving enemies once and surprise kills emit only one typed death cue', () => {
  const lane = openRun()
  const kinds = new Set(new GameWorld(50).enemies.map((enemy) => enemy.kind))
  for (const kind of kinds) {
    for (const lethal of [false, true]) {
      const world = isolatedWorld()
      placePlayer(world, lane.start, lane.angle)
      const enemy = target(kind, lane.near)
      if (lethal) enemy.health = 1
      world.enemies = [enemy]
      world.step(1 / 60, { ...idle, fire: true })
      assert.ok(enemy.health < enemy.maxHealth)
      const events = world.drainEvents()
      const alerts = events.filter((event) => event.type === 'enemy-alert')
      const deaths = events.filter((event) => event.type === 'kill')
      assert.equal(alerts.length, lethal ? 0 : 1)
      assert.equal(deaths.length, lethal ? 1 : 0)
      const cue = lethal ? deaths[0]! : alerts[0]!
      assert.equal(cue.kind, kind)
      assert.equal(cue.x, enemy.x)
      assert.equal(cue.z, enemy.z)
      assert.ok(typeof cue.y === 'number' && cue.y > enemy.y)
      advance(world, 0.6, { fire: true })
      const later = world.drainEvents()
      assert.equal(
        later.filter((event) => event.type === 'enemy-alert').length,
        0
      )
      if (lethal)
        assert.equal(later.filter((event) => event.type === 'kill').length, 0)
    }
  }
})

void test('a multi-pellet surprise kill discards its pending alert without silencing another enemy', () => {
  const world = isolatedWorld()
  const lane = openRun()
  placePlayer(world, lane.start, lane.angle)
  const victim = target(
    'sycophant',
    { x: lane.start.x + 6.4, z: lane.start.z },
    'victim'
  )
  const survivor = target('sam', lane.far, 'survivor')
  world.enemies = [survivor]
  world.time = ARRIVAL_GRACE_SECONDS
  world.step(1 / 60, idle)
  // Keep the survivor's alert in the same undrained batch as the surprise kill.
  world.enemies.unshift(victim)
  world.player.owned.push(1)
  world.player.ammo[1] = 2
  world.selectWeapon(1)
  world.step(1 / 60, { ...idle, fire: true })
  assert.equal(victim.health, 0)
  assert.ok(survivor.health > 0)
  const events = world.drainEvents()
  const alerts = events.filter((event) => event.type === 'enemy-alert')
  const deaths = events.filter((event) => event.type === 'kill')
  assert.equal(alerts.length, 1)
  assert.equal(
    alerts[0]!.type === 'enemy-alert' && alerts[0]!.enemyId,
    survivor.id
  )
  assert.equal(deaths.length, 1)
  assert.equal(deaths[0]!.type === 'kill' && deaths[0]!.enemyId, victim.id)
})

void test('every enemy attack emits once at release; dodged swipes sound and occluded volleys cancel', () => {
  const lane = openRun()
  const barrier = barrierPair()
  const kinds = new Set(new GameWorld(50).enemies.map((enemy) => enemy.kind))
  for (const kind of kinds) {
    for (const interrupted of [false, true]) {
      const world = new GameWorld(50)
      placePlayer(world, lane.start, lane.angle)
      world.pickups = []
      world.barrels = []
      const enemy = target(
        kind,
        kind === 'sycophant'
          ? { x: lane.start.x + 1.4, z: lane.start.z }
          : lane.near
      )
      enemy.cooldown = 0
      world.enemies = [enemy]
      world.step(1 / 60, idle)
      assert.equal(enemy.state, 'attack')
      world.drainEvents()
      advance(world, 0.2)
      assert.equal(world.projectiles.length, 0)
      assert.equal(
        world.drainEvents().filter((event) => event.type === 'enemy').length,
        0
      )
      if (interrupted) {
        Object.assign(enemy, barrier.end, {
          y: floorHeight(barrier.end.x, barrier.end.z)
        })
        placePlayer(world, barrier.start, barrier.angle)
      }
      const before = world.player.health
      const releasePosition = { x: enemy.x, z: enemy.z }
      advance(world, 0.3)
      const attacks = world
        .drainEvents()
        .filter((event) => event.type === 'enemy')
      assert.equal(attacks.length, !interrupted || kind === 'sycophant' ? 1 : 0)
      if (attacks.length) {
        assert.equal(attacks[0]!.kind, kind)
        assert.equal(attacks[0]!.x, releasePosition.x)
        assert.equal(attacks[0]!.z, releasePosition.z)
      }
      if (!interrupted) {
        if (kind === 'sycophant') assert.ok(world.player.health < before)
        else {
          assert.ok(world.projectiles.length > 0)
          assert.ok(
            world.projectiles.every(
              (projectile) => projectile.enemyKind === attacks[0]!.kind
            )
          )
        }
      } else {
        assert.equal(world.player.health, before)
        assert.equal(world.projectiles.length, 0)
      }
      advance(world, 0.15)
      assert.equal(
        world.drainEvents().filter((event) => event.type === 'enemy').length,
        0
      )
    }
  }
})

void test('pain or death before attack release cancels its sound and projectile', () => {
  const lane = openRun()
  const kinds = new Set(new GameWorld(50).enemies.map((enemy) => enemy.kind))
  for (const kind of kinds) {
    for (const lethal of [false, true]) {
      const world = new GameWorld(50)
      world.pickups = []
      world.barrels = []
      placePlayer(world, lane.start, lane.angle)
      const enemy = target(
        kind,
        kind === 'sycophant'
          ? { x: lane.start.x + 1.4, z: lane.start.z }
          : lane.near
      )
      enemy.cooldown = 0
      if (lethal) enemy.health = 1
      world.enemies = [enemy]
      world.step(1 / 60, idle)
      assert.equal(enemy.state, 'attack')
      world.drainEvents()
      world.step(1 / 60, { ...idle, fire: true })
      assert.equal(enemy.state, lethal ? 'dead' : 'hurt')
      advance(world, 0.5)
      assert.equal(world.projectiles.length, 0)
      const events = world.drainEvents()
      assert.equal(events.filter((event) => event.type === 'enemy').length, 0)
      assert.equal(
        events.filter((event) => event.type === 'enemy-alert').length,
        0
      )
      assert.equal(
        events.filter((event) => event.type === 'kill').length,
        lethal ? 1 : 0
      )
    }
  }
})

void test('movement is independent of diagonal input and respects solid walls at high frame deltas', () => {
  const straight = isolatedWorld()
  const diagonal = isolatedWorld()
  const start = { ...straight.player }
  advance(straight, 0.4, { forward: 1 })
  advance(diagonal, 0.4, { forward: 1, strafe: 1 })
  assert.ok(
    Math.abs(
      distance(start, straight.player) - distance(start, diagonal.player)
    ) < 1e-7
  )

  const wall = isolatedWorld()
  const barrier = barrierPair()
  placePlayer(wall, barrier.start, barrier.angle)
  for (let frame = 0; frame < 200; frame++)
    wall.step(10, { ...idle, forward: 1, sprint: true })
  assert.ok(!wall.isBlocked(wall.player.x, wall.player.z))
  assert.ok(distance(wall.player, barrier.start) < CELL)
  assert.equal(wall.isBlocked(Number.NaN, 0), true)
  assert.equal(wall.isBlocked(-1, -1), true)
})

void test('doors physically block passage, open by nearby interaction, and count secrets once', () => {
  const world = isolatedWorld()
  for (const door of world.doors) {
    assert.ok(world.isBlocked(door.x, door.z))
    approachDoor(world, door)
    world.interact()
    assert.equal(door.targetOpen, true)
    assert.ok(world.isBlocked(door.x, door.z))
    advance(world, 0.8)
    assert.equal(world.isBlocked(door.x, door.z), false)
    const secrets = world.secrets
    world.interact()
    assert.equal(world.secrets, secrets)
    if (door.secret) {
      advance(world, 0.8)
      assert.equal(door.open, 1)
      assert.equal(door.targetOpen, true)
      assert.equal(
        world
          .drainEvents()
          .filter(
            (event) =>
              event.type === 'door' && event.x === door.x && event.z === door.z
          ).length,
        1
      )
    }
  }
  assert.equal(world.secrets, world.doors.filter((door) => door.secret).length)
})

void test('lab doors emit one opening, closing, and completed pressure-seal event per transition', () => {
  const world = isolatedWorld()
  const door = world.doors.find((candidate) => !candidate.secret)!
  approachDoor(world, door)
  world.interact()
  world.interact()
  assert.deepEqual(doorActions(world), ['open'])
  advance(world, 0.6)
  assert.ok(door.open < 1)
  world.interact()
  assert.deepEqual(doorActions(world), [])
  advance(world, 0.05)
  assert.equal(door.open, 1)
  world.interact()
  assert.equal(door.targetOpen, false)
  assert.deepEqual(doorActions(world), ['close'])
  advance(world, 0.6)
  assert.ok(door.open > 0)
  assert.deepEqual(doorActions(world), [])
  advance(world, 0.05)
  assert.equal(door.open, 0)
  assert.deepEqual(doorActions(world), ['sealed'])
  advance(world, 1)
  assert.deepEqual(doorActions(world), [])
  world.interact()
  advance(world, 0.8)
  assert.equal(door.open, 1)
  assert.deepEqual(doorActions(world), ['open'])
})

void test('a closing lab door can be reopened without playing a completed seal', () => {
  const { world, door } = openDoorWorld()
  world.interact()
  advance(world, 0.2)
  const partiallyClosed = door.open
  assert.ok(partiallyClosed > 0 && partiallyClosed < 1)
  world.interact()
  world.interact()
  advance(world, 0.05)
  assert.ok(door.open > partiallyClosed)
  advance(world, 0.8)
  assert.equal(door.open, 1)
  assert.deepEqual(doorActions(world), ['close', 'open'])
})

void test('lab doors refuse to close across the player footprint, including an edge overlap', () => {
  const { world, door, approach } = openDoorWorld()
  const outward = {
    x: (approach.x - door.x) / CELL,
    z: (approach.z - door.z) / CELL
  }
  const placeAtEdge = (clearance: number) => {
    const offset = CELL / 2 + PLAYER_RADIUS + clearance
    placePlayer(
      world,
      {
        x: door.x + outward.x * offset,
        z: door.z + outward.z * offset
      },
      world.player.angle
    )
  }
  placeAtEdge(-0.02)
  world.interact()
  advance(world, 0.1)
  assert.equal(door.open, 1)
  assert.equal(door.targetOpen, true)
  assert.deepEqual(doorActions(world), [])
  placeAtEdge(0.02)
  world.interact()
  advance(world, 0.8)
  assert.equal(door.open, 0)
  assert.equal(world.isBlocked(world.player.x, world.player.z), false)
  assert.deepEqual(doorActions(world), ['close', 'sealed'])
})

void test('living monsters block lab-door closure with their own footprint while corpses do not', () => {
  for (const kind of Object.keys(ENEMY_HEIGHT) as EnemyKind[]) {
    const { world, door } = openDoorWorld()
    const enemy = target(kind, door)
    world.enemies = [enemy]
    world.interact()
    assert.equal(door.targetOpen, true, kind)
    assert.deepEqual(doorActions(world), [])
    enemy.health = 0
    enemy.state = 'dead'
    world.interact()
    advance(world, 0.8)
    assert.equal(door.open, 0, kind)
    assert.deepEqual(doorActions(world), ['close', 'sealed'])
  }
  const { world, door, approach } = openDoorWorld()
  const offset = CELL / 2 + 1.2
  world.enemies = [
    target('sam', {
      x: door.x + ((approach.x - door.x) / CELL) * offset,
      z: door.z + ((approach.z - door.z) / CELL) * offset
    })
  ]
  world.interact()
  assert.equal(door.targetOpen, true)
  assert.deepEqual(doorActions(world), [])
})

void test('a player or monster entering an open doorway reverses its closure before it can block', () => {
  for (const actor of ['player', 'enemy'] as const) {
    const { world, door } = openDoorWorld()
    world.interact()
    advance(world, 0.05)
    assert.ok(door.open > 0.86)
    if (actor === 'player') placePlayer(world, door)
    else world.enemies = [target('paperclip', door)]
    advance(world, 0.1)
    assert.equal(door.targetOpen, true)
    assert.equal(door.open, 1)
    assert.equal(world.isBlocked(door.x, door.z), false)
    advance(world, 0.3)
    assert.deepEqual(doorActions(world), ['close', 'open'])
  }
})

void test('partially closed doors block later player movement and inactive simulations leave doors silent', () => {
  const { world, door } = openDoorWorld()
  world.interact()
  advance(world, 0.1)
  assert.equal(world.isBlocked(door.x, door.z), true)
  advance(world, 0.5, { forward: 1 })
  assert.equal(world.isBlocked(world.player.x, world.player.z), false)
  assert.ok(distance(world.player, door) >= CELL / 2 + PLAYER_RADIUS)
  const position = door.open
  world.drainEvents()
  for (const dt of [0, -1, Number.NaN]) world.step(dt, idle)
  assert.equal(door.open, position)
  assert.deepEqual(doorActions(world), [])
  for (const phase of ['dead', 'won'] as const) {
    world.phase = phase
    world.interact()
    advance(world, 1)
    assert.equal(door.open, position)
    assert.deepEqual(doorActions(world), [])
  }
})

void test('hitscan selects the nearest enemy and geometry occludes enemies behind walls', () => {
  const world = isolatedWorld()
  const lane = openRun()
  placePlayer(world, lane.start, lane.angle)
  const near = target('deception', lane.near, 'near')
  const far = target('deception', lane.far, 'far')
  world.enemies = [far, near]
  const before = near.health
  world.step(1 / 60, { ...idle, fire: true })
  assert.ok(near.health < before)
  assert.equal(far.health, far.maxHealth)

  const blocked = isolatedWorld()
  const barrier = barrierPair()
  placePlayer(blocked, barrier.start, barrier.angle)
  const behindWall = target('deception', barrier.end)
  blocked.enemies = [behindWall]
  advance(blocked, 0.5, { fire: true })
  assert.equal(behindWall.health, behindWall.maxHealth)
  assert.equal(blocked.hasLineOfSight(blocked.player, behindWall), false)
})

void test('pickups clamp each resource, unlock weapons, and apply only once', () => {
  for (const source of LEVEL.pickups) {
    const world = isolatedWorld()
    placePlayer(world, source)
    world.player.health = 99
    world.player.armor = 199
    world.player.ammo = AMMO_LIMITS.map((limit) => Math.max(0, limit - 1))
    world.pickups = [{ ...source, collected: false }]
    world.step(1 / 60, idle)
    assert.ok(world.pickups[0]!.collected)
    const events = world
      .drainEvents()
      .filter((event) => event.type === 'pickup')
    assert.equal(events.length, 1)
    assert.equal(events[0]!.pickupKind, source.kind)
    assert.equal(events[0]!.weapon, source.weapon)
    assert.equal(events[0]!.ammoPool, source.ammoPool)
    assert.equal(events[0]!.kind, undefined)
    const notices = world.snapshot().notices
    assert.equal(notices.length, 1)
    assert.equal(notices[0]!.subject, source.id)
    assert.equal(
      notices[0]!.kind,
      source.kind === 'weapon' ? 'weapon' : 'pickup'
    )
    assert.ok(world.player.health <= 100)
    assert.ok(world.player.armor <= 200)
    assert.ok(
      world.player.ammo.every((ammo, index) => ammo <= AMMO_LIMITS[index]!)
    )
    if (source.weapon !== undefined)
      assert.ok(world.player.owned.includes(source.weapon))
    const resources = [
      world.player.health,
      world.player.armor,
      ...world.player.ammo
    ]
    world.step(1 / 60, idle)
    assert.equal(
      world.drainEvents().filter((event) => event.type === 'pickup').length,
      0
    )
    assert.equal(world.snapshot().notices[0]!.id, notices[0]!.id)
    assert.deepEqual(
      [world.player.health, world.player.armor, ...world.player.ammo],
      resources
    )
  }
})

void test('full resources and duplicate weapons stay uncollected and silent, while a new weapon can unlock with full ammo', () => {
  for (const source of LEVEL.pickups) {
    const world = isolatedWorld()
    placePlayer(world, source)
    world.player.health = 100
    world.player.armor = 200
    world.player.ammo = [...AMMO_LIMITS]
    world.player.owned = [0, 1, 2, 3]
    world.pickups = [{ ...source, collected: false }]
    advance(world, 0.5)
    assert.equal(world.pickups[0]!.collected, false)
    assert.equal(
      world.drainEvents().filter((event) => event.type === 'pickup').length,
      0
    )
    assert.equal(world.snapshot().notices.length, 0)
  }
  const source = LEVEL.pickups.find(
    (pickup) => pickup.kind === 'weapon' && pickup.weapon !== 0
  )!
  const world = isolatedWorld()
  placePlayer(world, source)
  world.player.ammo = [...AMMO_LIMITS]
  world.pickups = [{ ...source, collected: false }]
  world.step(1 / 60, idle)
  const events = world.drainEvents().filter((event) => event.type === 'pickup')
  assert.equal(world.pickups[0]!.collected, true)
  assert.equal(events.length, 1)
  assert.equal(events[0]!.pickupKind, source.kind)
  assert.equal(events[0]!.weapon, source.weapon)
})

void test('weapons respect cadence and their ammunition costs, including a free pistol', () => {
  for (const weapon of [0, 1, 2, 3] as WeaponId[]) {
    const world = isolatedWorld()
    world.player.owned = [0, 1, 2, 3]
    world.player.ammo = [100, 50, 200]
    world.selectWeapon(weapon)
    const pool = WEAPON_POOL[weapon]
    const before = world.player.ammo[pool]!
    world.step(1 / 60, { ...idle, fire: true })
    assert.equal(world.player.ammo[pool], before - WEAPON_COST[weapon])
    if (weapon === 3) {
      assert.ok(
        world
          .drainEvents()
          .some((event) => event.type === 'charge' && event.weapon === weapon)
      )
      assert.equal(world.projectiles.length, 0)
      assert.equal(world.snapshot().chargeProgress, 0)
    }
    world.step(1 / 60, { ...idle, fire: true })
    assert.equal(world.player.ammo[pool], before - WEAPON_COST[weapon])
    if (weapon === 3) {
      assert.ok(world.shutdownCharge !== null)
      assert.equal(world.shotCounter, 0)
      assert.ok((world.snapshot().chargeProgress ?? 0) > 0)
      advance(world, SHUTDOWN_CHARGE_SECONDS + 0.03)
      assert.equal(world.shutdownCharge, null)
      assert.equal(world.shotCounter, 1)
      assert.equal(world.snapshot().chargeProgress, null)
      assert.ok(
        world
          .drainEvents()
          .some((event) => event.type === 'shot' && event.weapon === weapon)
      )
    } else {
      assert.equal(world.shotCounter, 1)
    }
    advance(world, 2)
    world.player.ammo[pool] = 0
    const shots = world.shotCounter
    world.step(1 / 60, { ...idle, fire: true })
    assert.equal(world.player.ammo[pool], 0)
    assert.equal(world.shotCounter, shots + Number(WEAPON_COST[weapon] === 0))
  }
})

void test('the pistol keeps firing with empty reserves on every difficulty without consuming another pool', () => {
  for (const difficulty of [1, 10, 50, 90, 99] as Difficulty[]) {
    const world = new GameWorld(difficulty)
    world.enemies = []
    world.barrels = []
    world.pickups = []
    world.player.ammo = [0, 12, 80]
    const before = [...world.player.ammo]
    advance(world, 8, { fire: true })
    assert.ok(world.shotCounter >= 25 && world.shotCounter <= 30)
    assert.deepEqual(world.player.ammo, before)
    assert.equal(world.player.weapon, 0)
    const snapshot = world.snapshot()
    assert.ok(snapshot.ammoPools.every(Number.isFinite))
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot)).ammoPools, before)
    const shots = world.shotCounter
    advance(world, 1)
    assert.equal(world.shotCounter, shots)
  }
})

void test('easy arrivals pause enemy awareness until the grace expires or a shot is fired', () => {
  const arrivalWorld = (difficulty: Difficulty) => {
    const world = new GameWorld(difficulty)
    const lane = openRun()
    placePlayer(world, lane.start, lane.angle)
    world.enemies = [target('deception', lane.near)]
    return world
  }
  for (const difficulty of [1, 10] as const) {
    const world = arrivalWorld(difficulty)
    const start = world.enemies.map(({ id, x, z }) => ({ id, x, z }))
    advance(world, ARRIVAL_GRACE_SECONDS - 0.1)
    assert.equal(world.player.health, 100)
    assert.equal(world.projectiles.length, 0)
    assert.ok(world.enemies.every((enemy) => !enemy.alerted))
    assert.deepEqual(
      world.enemies.map(({ id, x, z }) => ({ id, x, z })),
      start
    )
    advance(world, 0.2)
    assert.ok(world.enemies.some((enemy) => enemy.alerted))

    const firing = arrivalWorld(difficulty)
    firing.step(1 / 60, { ...idle, fire: true })
    assert.ok(firing.enemies.some((enemy) => enemy.alerted))
    assert.ok(firing.time < ARRIVAL_GRACE_SECONDS)

    const charging = arrivalWorld(difficulty)
    charging.player.owned.push(3)
    charging.player.ammo[2] = WEAPON_COST[3]
    charging.selectWeapon(3)
    charging.step(1 / 60, { ...idle, fire: true })
    assert.ok(charging.enemies.some((enemy) => enemy.alerted))
  }
  for (const difficulty of [50, 90, 99] as const) {
    const world = arrivalWorld(difficulty)
    world.step(1 / 60, idle)
    assert.ok(world.enemies.some((enemy) => enemy.alerted))
  }
})

void test('projectiles are swept against geometry and a shutdown blast cannot pass through walls', () => {
  const world = isolatedWorld()
  const barrier = barrierPair()
  placePlayer(world, barrier.start, barrier.angle)
  const behindWall = target('sam', barrier.end)
  world.enemies = [behindWall]
  world.player.owned = [0, 2, 3]
  world.player.ammo[2] = 200
  world.selectWeapon(2)
  advance(world, 0.4, { fire: true })
  world.selectWeapon(3)
  advance(world, 1.8, { fire: true })
  advance(world, 3)
  assert.equal(behindWall.health, behindWall.maxHealth)
  assert.ok(
    world.projectiles.every(
      (projectile) => !world.isBlocked(projectile.x, projectile.z, 0)
    )
  )
})

void test('enemy projectiles respect the same walls that stop player shots', () => {
  const world = isolatedWorld()
  const barrier = barrierPair()
  placePlayer(world, barrier.start, barrier.angle)
  const ray = direction(barrier.angle)
  world.projectiles = [
    {
      id: 'test-enemy-shot',
      ...barrier.end,
      y: floorHeight(barrier.end.x, barrier.end.z) + PLAYER_EYE_HEIGHT,
      vy: 0,
      dx: -ray.x * 200,
      dz: -ray.z * 200,
      kind: 'enemy',
      owner: 'enemy',
      life: 5
    }
  ]
  advance(world, 0.5)
  assert.equal(world.player.health, 100)
  assert.equal(world.projectiles.length, 0)
})

void test('an alerted enemy navigates around an obstructing rack without entering walls', () => {
  const world = isolatedWorld()
  const barrier = barrierPair()
  placePlayer(world, barrier.end)
  const enemy = target('sycophant', barrier.start)
  enemy.alerted = true
  world.enemies = [enemy]
  assert.equal(world.hasLineOfSight(enemy, world.player), false)
  for (let frame = 0; frame < 60 * 30; frame++) {
    world.step(1 / 60, idle)
    assert.equal(world.isBlocked(enemy.x, enemy.z, 0.4), false)
  }
  assert.ok(distance(enemy, world.player) < 2)
})

void test('shutdown requires defeating the boss, victory freezes combat, and snapshots are copied', () => {
  const world = isolatedWorld()
  const lane = openRun()
  const sam = target('sam', lane.near)
  world.enemies = [sam]
  placePlayer(world, LEVEL.shutdown)
  world.interact()
  assert.equal(world.phase, 'playing')
  assert.equal(world.bossDefeated, false)

  // Position on the unblocked central arena lane and defeat him through combat.
  placePlayer(world, lane.start, lane.angle)
  world.player.owned = [0, 3]
  world.player.ammo[2] = AMMO_LIMITS[2]!
  world.selectWeapon(3)
  advance(world, 8, { fire: true })
  assert.equal(sam.health, 0)
  assert.equal(world.bossDefeated, true)
  placePlayer(world, LEVEL.shutdown)
  world.interact()
  assert.equal(world.phase, 'won')
  const before = world.snapshot()
  advance(world, 2, { forward: 1, fire: true })
  assert.equal(world.time, before.elapsed)
  assert.equal(world.shotCounter, before.shot)
  assert.equal(world.projectiles.length, 0)
  before.ammoPools[0] = -100
  before.owned.length = 0
  assert.ok(world.player.ammo[0]! >= 0)
  assert.ok(world.player.owned.length > 0)
})

void test('difficulty adds cumulative reinforcements while preserving the base roster and one boss', () => {
  const roster = (world: GameWorld) =>
    world.enemies.map(({ id, kind, x, y, z }) => ({ id, kind, x, y, z }))
  const base = new GameWorld(10)
  assert.deepEqual(roster(new GameWorld(1)), roster(base))
  assert.equal(base.enemies.length, LEVEL.enemies.length)
  let previous = roster(base)
  for (const [difficulty, minimum, maximum] of [
    [50, 1, 2],
    [90, 5, 10],
    [99, 30, 40]
  ] as const) {
    const world = new GameWorld(difficulty)
    const extra = world.enemies.length - base.enemies.length
    assert.ok(extra >= minimum && extra <= maximum)
    assert.equal(extra, DIFFICULTY_SETTINGS[difficulty].extraEnemies)
    assert.deepEqual(roster(world).slice(0, previous.length), previous)
    assert.equal(
      new Set(world.enemies.map((enemy) => enemy.id)).size,
      world.enemies.length
    )
    assert.equal(
      world.enemies.filter((enemy) => enemy.kind === 'sam').length,
      1
    )
    assert.equal(world.snapshot().totalEnemies, world.enemies.length)
    previous = roster(world)
    const restart = new GameWorld(difficulty)
    assert.deepEqual(roster(restart), previous)
    world.enemies.at(-1)!.health = 0
    world.enemies.at(-1)!.x += CELL
    assert.ok(restart.enemies.at(-1)!.health > 0)
    assert.deepEqual(roster(restart), previous)
  }
})

void test('reinforcements have solid clearance and leave the arrival, doors and pickups accessible', () => {
  const world = new GameWorld(99)
  const baseIds = new Set(LEVEL.enemies.map((enemy) => enemy.id))
  const extras = world.enemies.filter((enemy) => !baseIds.has(enemy.id))
  for (const enemy of extras) {
    assert.notEqual(enemy.kind, 'sam')
    assert.equal(enemy.y, floorHeight(enemy.x, enemy.z))
    assert.equal(
      world.isBlocked(enemy.x, enemy.z, 0.9, enemy.y, ENEMY_HEIGHT[enemy.kind]),
      false,
      `${enemy.id} needs wall/barrel/headroom clearance`
    )
    assert.ok(
      distance(enemy, LEVEL.spawn) >= CELL * 2,
      `${enemy.id} is too close to arrival`
    )
    assert.ok(
      LEVEL.doors.every((door) => distance(enemy, door) > 2.5),
      `${enemy.id} obstructs a door`
    )
    assert.ok(
      LEVEL.pickups.every((pickup) => distance(enemy, pickup) > 1.4),
      `${enemy.id} overlaps a pickup`
    )
    assert.ok(
      world.enemies.every(
        (other) => other === enemy || distance(enemy, other) >= 1.8
      ),
      `${enemy.id} overlaps another enemy`
    )
  }
})

void test('difficulty changes incoming damage, movement, supplies, and nightmare respawn excludes Sam', () => {
  const easier = new GameWorld(1)
  const harder = new GameWorld(99)
  assert.ok(easier.settings.incomingDamage < harder.settings.incomingDamage)
  assert.ok(easier.settings.speed < harder.settings.speed)
  assert.ok(easier.settings.supplies > harder.settings.supplies)
  for (const world of [easier, harder]) {
    world.pickups = []
    const creature = world.enemies.find((enemy) => enemy.kind !== 'sam')!
    const boss = world.enemies.find((enemy) => enemy.kind === 'sam')!
    world.enemies = [creature, boss]
    Object.assign(creature, { health: 0, state: 'dead', stateTime: 22.1 })
    Object.assign(boss, { health: 0, state: 'dead', stateTime: 22.1 })
    placePlayer(world, LEVEL.shutdown)
    world.step(1 / 60, idle)
    assert.equal(boss.health, 0)
    assert.equal(creature.health > 0, world.difficulty === 99)
  }
})

void test('guardrails absorb damage, death clamps health and prevents further simulation', () => {
  const world = isolatedWorld()
  world.player.armor = 20
  world.projectiles.push({
    id: 'near',
    ...world.player,
    y: world.player.y + 1,
    vy: 0,
    dx: 0,
    dz: -1,
    kind: 'enemy',
    owner: 'enemy',
    life: 3
  })
  world.step(1 / 60, idle)
  assert.ok(world.player.armor < 20)
  assert.ok(world.player.health < 100 && world.player.health > 95)
  const pain = world.drainEvents().filter((event) => event.type === 'hurt')
  assert.equal(pain.length, 1)
  assert.ok(Math.abs(pain[0]!.impact! - (100 - world.player.health)) < 1e-8)
  assert.equal(pain[0]!.x, world.player.x)
  assert.equal(pain[0]!.z, world.player.z)
  world.player.health = 0.01
  world.player.armor = 0
  world.projectiles.push({
    id: 'fatal',
    ...world.player,
    y: world.player.y + 1,
    vy: 0,
    dx: 0,
    dz: -1,
    kind: 'rocket',
    owner: 'enemy',
    life: 3
  })
  world.step(1 / 60, idle)
  assert.equal(world.player.health, 0)
  assert.equal(world.phase, 'dead')
  const fatal = world.drainEvents()
  assert.equal(fatal.filter((event) => event.type === 'hurt').length, 0)
  assert.equal(fatal.filter((event) => event.type === 'player-death').length, 1)
  const before = world.time
  advance(world, 2, { fire: true, forward: 1 })
  assert.equal(world.time, before)
  assert.equal(world.drainEvents().length, 0)
})

void test('a fatal burst replaces queued player pain with one death event', () => {
  const world = isolatedWorld()
  world.player.health = 12
  world.projectiles = Array.from({ length: 3 }, (_, index) => ({
    id: `burst-${index}`,
    x: world.player.x,
    y: world.player.y + 1,
    z: world.player.z,
    dx: 0,
    dz: -1,
    vy: 0,
    kind: 'enemy',
    owner: 'enemy',
    life: 3
  }))
  world.step(1 / 60, idle)
  assert.equal(world.phase, 'dead')
  assert.equal(world.player.health, 0)
  assert.ok(world.damageCounter > 1)
  const events = world.drainEvents()
  assert.equal(events.filter((event) => event.type === 'hurt').length, 0)
  const deaths = events.filter((event) => event.type === 'player-death')
  assert.equal(deaths.length, 1)
  assert.ok(deaths[0]!.impact! > 0)
  advance(world, 1)
  assert.equal(world.drainEvents().length, 0)
})

void test('fatal melee damage stops later enemies from releasing attacks over the death cue', () => {
  const world = isolatedWorld()
  const lane = openRun()
  world.time = ARRIVAL_GRACE_SECONDS
  placePlayer(world, lane.start, lane.angle)
  world.player.health = 1
  world.enemies = [0, 1].map((index) => ({
    ...target(
      'sycophant',
      { x: lane.start.x + 1.3, z: lane.start.z },
      `attacker-${index}`
    ),
    alerted: true,
    state: 'attack',
    stateTime: 0.25
  }))
  world.step(1 / 60, idle)
  assert.equal(world.phase, 'dead')
  assert.equal(world.enemies[0]!.attackReleased, true)
  assert.equal(world.enemies[1]!.attackReleased, false)
  const events = world.drainEvents()
  assert.equal(events.filter((event) => event.type === 'enemy').length, 1)
  assert.equal(
    events.filter((event) => event.type === 'player-death').length,
    1
  )
})

function barrel(point: Point, id = 'barrel'): Barrel {
  return {
    ...point,
    id,
    y: floorHeight(point.x, point.z),
    health: BARREL_HEALTH,
    exploded: false
  }
}

void test('barrel placement leaves solid clearance and blast-safe arrival resources', () => {
  const world = isolatedWorld()
  const weapon = LEVEL.pickups.find((pickup) => pickup.weapon === 1)!
  assert.ok(LEVEL.barrels.length > 0)
  for (const definition of LEVEL.barrels) {
    assert.equal(
      world.isBlocked(
        definition.x,
        definition.z,
        BARREL_RADIUS,
        floorHeight(definition.x, definition.z),
        BARREL_HEIGHT,
        0
      ),
      false,
      definition.id
    )
    assert.ok(distance(definition, LEVEL.spawn) > 7)
    assert.ok(distance(definition, weapon) > 7)
  }
})

void test('shooting barrels creates deterministic chain blasts, damage, and persistent destruction without duplicate kills', () => {
  const world = isolatedWorld()
  const lane = openRun()
  placePlayer(world, lane.start, lane.angle)
  world.barrels = [0, 2, 4].map((offset, index) =>
    barrel(
      { x: lane.start.x + 3.2 + offset, z: lane.start.z },
      `chain-${index}`
    )
  )
  const enemy = target('paperclip', { x: lane.start.x + 6.5, z: lane.start.z })
  world.enemies = [enemy]
  assert.equal(
    world.isBlocked(world.barrels[0]!.x, world.barrels[0]!.z, 0.1),
    true
  )
  advance(world, 0.32, { fire: true })
  assert.ok(world.barrels.every((item) => item.exploded && item.health === 0))
  assert.equal(enemy.health, 0)
  assert.equal(world.kills, 1)
  const vanquished = world
    .snapshot()
    .notices.find((notice) => notice.kind === 'kill')!
  assert.ok(vanquished)
  assert.equal(vanquished.subject, enemy.kind)
  assert.ok(world.player.health < 100)
  const events = world.drainEvents()
  const explosions = events.filter(
    (event) => event.type === 'explosion' && event.source === 'barrel'
  )
  assert.deepEqual(
    explosions.map((event) => event.x),
    world.barrels.map((item) => item.x)
  )
  assert.equal(events.filter((event) => event.type === 'kill').length, 1)
  assert.equal(
    world.isBlocked(world.barrels[0]!.x, world.barrels[0]!.z, 0.1),
    false
  )
  advance(world, 1, { fire: true, forward: 1 })
  assert.ok(world.player.x > world.barrels[0]!.x)
  assert.ok(world.barrels.every((item) => item.exploded))
  assert.equal(world.kills, 1)
  assert.equal(
    world.snapshot().notices.find((notice) => notice.kind === 'kill')!.id,
    vanquished.id
  )
  assert.equal(
    world.drainEvents().filter((event) => event.type === 'explosion').length,
    0
  )
})

void test('barrel blasts cannot cross walls or an elevated floor riser', () => {
  const wall = barrierPair()
  const ledge = heightEdges().find((edge) => edge.rise >= 1.49)!
  assert.ok(ledge)
  const dx = (ledge.high.x - ledge.low.x) / CELL
  const dz = (ledge.high.z - ledge.low.z) / CELL
  const cases = [
    {
      start: wall.start,
      end: wall.end,
      shooter: { x: wall.start.x, z: wall.start.z + 1.2 }
    },
    {
      start: { x: ledge.low.x + dx * 0.8, z: ledge.low.z + dz * 0.8 },
      end: ledge.high,
      shooter: { x: ledge.low.x - dx * 0.4, z: ledge.low.z - dz * 0.4 }
    }
  ]
  for (const fixture of cases) {
    const world = isolatedWorld()
    const first = barrel(fixture.start, 'exposed')
    first.health = 1
    const protectedBarrel = barrel(fixture.end, 'protected')
    const enemy = target('deception', fixture.end)
    world.barrels = [first, protectedBarrel]
    world.enemies = [enemy]
    placePlayer(world, fixture.shooter, toward(fixture.shooter, fixture.start))
    world.step(1 / 60, { ...idle, fire: true })
    assert.equal(first.exploded, true)
    assert.equal(protectedBarrel.health, BARREL_HEALTH)
    assert.equal(protectedBarrel.exploded, false)
    assert.equal(enemy.health, enemy.maxHealth)
  }
})

void test('hitscan and projectiles hit the nearer barrel, while elevated shots pass above it', () => {
  const lane = openRun()
  for (const weapon of [0, 2] as const) {
    const world = isolatedWorld()
    placePlayer(world, lane.start, lane.angle)
    const obstacle = barrel({ x: lane.start.x + 3.2, z: lane.start.z })
    const enemy = target('deception', lane.far)
    world.enemies = [enemy]
    world.barrels = [obstacle]
    world.player.owned = [0, 2]
    world.player.ammo[2] = 100
    world.selectWeapon(weapon)
    world.step(1 / 60, { ...idle, fire: true })
    advance(world, 0.16)
    assert.ok(obstacle.health < BARREL_HEALTH)
    assert.equal(enemy.health, enemy.maxHealth)
    assert.ok(
      world
        .drainEvents()
        .some((event) => event.type === 'impact' && event.surface === 'barrel')
    )
  }
  const world = isolatedWorld()
  placePlayer(world, lane.start)
  const obstacle = barrel(lane.near)
  const enemy = target('deception', lane.far)
  world.enemies = [enemy]
  world.barrels = [obstacle]
  world.projectiles = [
    {
      id: 'over-barrel',
      ...lane.start,
      y: obstacle.y + BARREL_HEIGHT + 0.2,
      dx: 100,
      dz: 0,
      vy: 0,
      owner: 'player',
      kind: 'plasma',
      life: 2
    }
  ]
  advance(world, 0.2)
  assert.equal(obstacle.health, BARREL_HEALTH)
  assert.ok(enemy.health < enemy.maxHealth)
})

void test('spatial impacts carry finite contacts and outward wall, floor, and actor normals', () => {
  const wall = barrierPair()
  const world = isolatedWorld()
  placePlayer(world, wall.start, wall.angle)
  world.step(1 / 60, { ...idle, fire: true })
  const impact = world.drainEvents().find((event) => event.type === 'impact')
  assert.ok(impact?.type === 'impact')
  assert.equal(impact.surface, 'wall')
  assert.equal(Math.hypot(impact.normal.x, impact.normal.y, impact.normal.z), 1)
  const facing = direction(wall.angle)
  assert.ok(impact.normal.x * facing.x + impact.normal.z * facing.z < -0.99)
  const lane = openRun()
  placePlayer(world, lane.start)
  world.projectiles = [
    {
      id: 'floor-hit',
      ...lane.start,
      y: world.player.y + 0.8,
      dx: 0.01,
      dz: 0,
      vy: -20,
      owner: 'player',
      kind: 'plasma',
      life: 2
    }
  ]
  advance(world, 0.1)
  const floor = world.drainEvents().find((event) => event.type === 'impact')
  assert.ok(floor?.type === 'impact')
  assert.deepEqual(floor.normal, { x: 0, y: 1, z: 0 })
  assert.ok(Math.abs(floor.y - (world.player.y + 0.012)) < 1e-6)
  const enemy = target('deception', lane.near)
  world.enemies = [enemy]
  world.player.cooldown = 0
  world.player.angle = lane.angle
  world.step(1 / 60, { ...idle, fire: true })
  const actor = world.drainEvents().find((event) => event.type === 'impact')
  assert.ok(actor?.type === 'impact')
  assert.equal(actor.surface, 'enemy')
  assert.ok([actor.x, actor.y, actor.z].every(Number.isFinite))
  assert.ok(actor.normal.x < -0.99)
})

void test('intact barrels stop movement, enemy fire can ignite them, and fatal chains finish resolving', () => {
  const lane = openRun()
  const world = isolatedWorld()
  placePlayer(world, lane.start, lane.angle)
  const obstacle = barrel({ x: lane.start.x + 3.2, z: lane.start.z })
  world.barrels = [obstacle]
  advance(world, 1, { forward: 1 })
  assert.ok(world.player.x < obstacle.x - BARREL_RADIUS)
  assert.ok(world.player.x > lane.start.x)
  obstacle.health = 1
  world.player.health = 0.01
  const next = barrel({ x: obstacle.x + 2, z: obstacle.z }, 'next')
  world.barrels.push(next)
  const victim = target('sycophant', { x: next.x + 0.5, z: next.z })
  world.enemies = [victim]
  world.projectiles = [
    {
      id: 'hostile-ignition',
      x: obstacle.x,
      y: obstacle.y + BARREL_HEIGHT / 2,
      z: obstacle.z + 1.5,
      dx: 0,
      dz: -100,
      vy: 0,
      kind: 'enemy',
      owner: 'enemy',
      life: 2
    }
  ]
  advance(world, 0.05)
  assert.equal(world.phase, 'dead')
  assert.ok(world.barrels.every((item) => item.exploded))
  assert.equal(victim.health, 0)
  assert.equal(world.kills, 1)
  assert.equal(
    world.drainEvents().filter((event) => event.type === 'explosion').length,
    world.barrels.length
  )
})
