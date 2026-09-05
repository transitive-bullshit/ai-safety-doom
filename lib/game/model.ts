import { at, CELL, LEVEL, floorHeight, ceilingHeight, sectorAt } from './level'
import type { PickupDefinition, PickupKind } from './level'
import {
  clamp,
  boxNormal,
  cylinderNormal,
  direction,
  distance,
  integrateVelocity,
  rayBox3,
  rayCircle,
  rayCylinder
} from './math'
import type { Point3 } from './math'
import type {
  Difficulty,
  EnemyKind,
  GameSnapshot,
  Point,
  WeaponId
} from './types'
import { ENEMY_NAMES, SHUTDOWN_CHARGE_SECONDS, WEAPONS } from './types'
import { GameNotices } from './notices'

// Pool zero is retained for stable weapon indexing; the pistol needs no reserve.
export const AMMO_LIMITS = [0, 80, 400]
export const WEAPON_POOL = [0, 1, 2, 2] as const
export const WEAPON_COST = [0, 1, 1, 40] as const
export const PLAYER_RADIUS = 0.38
export const PLAYER_WALK_SPEED = 7.4
export const PLAYER_RUN_SPEED = 10.2
export const ARRIVAL_GRACE_SECONDS = 6
export const PLAYER_HEIGHT = 1.8
export const PLAYER_EYE_HEIGHT = 1.62
export const MAX_STEP_HEIGHT = 0.32
export const GRAVITY = 22
export const BARREL_RADIUS = 0.55
export const BARREL_HEIGHT = 1.35
export const BARREL_HEALTH = 30
export const BARREL_BLAST_RADIUS = 6.5
export const BARREL_BLAST_DAMAGE = 130

export interface Barrel extends Point3 {
  id: string
  health: number
  exploded: boolean
}

export const DIFFICULTY_SETTINGS = {
  1: {
    extraEnemies: 0,
    incomingDamage: 0.38,
    speed: 0.75,
    attackRate: 0.75,
    supplies: 1.6,
    enemyHealth: 0.8
  },
  10: {
    extraEnemies: 0,
    incomingDamage: 0.58,
    speed: 0.9,
    attackRate: 0.9,
    supplies: 1.25,
    enemyHealth: 1
  },
  50: {
    extraEnemies: 2,
    incomingDamage: 1,
    speed: 1,
    attackRate: 1,
    supplies: 1,
    enemyHealth: 1.1
  },
  90: {
    extraEnemies: 8,
    incomingDamage: 1.4,
    speed: 1.2,
    attackRate: 1.3,
    supplies: 0.85,
    enemyHealth: 1.2
  },
  99: {
    extraEnemies: 36,
    incomingDamage: 1.6,
    speed: 1.45,
    attackRate: 1.6,
    supplies: 1,
    enemyHealth: 1.2
  }
} as const

const ENEMY_STATS = {
  deception: { health: 68, radius: 0.7, speed: 2.4, interval: 2.4, damage: 14 },
  sycophant: {
    health: 50,
    radius: 0.7,
    speed: 4.3,
    interval: 0.95,
    damage: 16
  },
  paperclip: {
    health: 105,
    radius: 0.9,
    speed: 2.15,
    interval: 2.9,
    damage: 18
  },
  sam: { health: 1250, radius: 1.25, speed: 1.5, interval: 1.8, damage: 28 }
} as const

export const ENEMY_HEIGHT = {
  deception: 2.15,
  sycophant: 2,
  paperclip: 2.55,
  sam: 3.6
} as const satisfies Record<EnemyKind, number>

export interface Enemy extends Point3 {
  id: string
  kind: EnemyKind
  health: number
  maxHealth: number
  state: 'idle' | 'move' | 'attack' | 'hurt' | 'dead'
  stateTime: number
  cooldown: number
  alerted: boolean
  home: Point
  deaths: number
  vy: number
  grounded: boolean
  attackReleased: boolean
  painUntil: number
  bossVolley?: {
    pattern: 'wide' | 'rapid'
    shotsFired: number
    target: Point3 | null
  }
}

export type Pickup = PickupDefinition & { collected: boolean }
export interface Projectile extends Point3 {
  id: string
  dx: number
  dz: number
  kind: 'plasma' | 'shutdown' | 'enemy' | 'rocket'
  owner: 'player' | 'enemy'
  /** Firing identity for presentation; kind still controls collision and damage. */
  enemyKind?: EnemyKind
  life: number
  vy: number
}

export interface Door extends Point {
  id: string
  open: number
  targetOpen: boolean
  secret: boolean
}

export interface GameInput {
  forward: number
  strafe: number
  /** Yaw delta in radians, already scaled by the input device. */
  turn: number
  fire: boolean
  sprint: boolean
}

export type GameEvent = {
  weapon?: WeaponId
  impact?: number
  kind?: EnemyKind
  distance?: number
  doorAction?: 'open' | 'close' | 'sealed'
} & (
  | {
      type:
        | 'charge'
        | 'shot'
        | 'hit'
        | 'hurt'
        | 'player-death'
        | 'door'
        | 'win'
        | 'land'
      x?: number
      y?: number
      z?: number
    }
  | {
      type: 'enemy-alert' | 'enemy' | 'kill'
      kind: EnemyKind
      enemyId: string
      x: number
      y: number
      z: number
    }
  | {
      type: 'pickup'
      pickupKind: PickupKind
      ammoPool?: number
      x?: number
      y?: number
      z?: number
    }
  | {
      type: 'impact'
      x: number
      y: number
      z: number
      normal: Point3
      surface: 'wall' | 'enemy' | 'barrel' | 'player'
    }
  | {
      type: 'explosion'
      x: number
      y: number
      z: number
      strength: number
      source: 'barrel' | 'shutdown' | 'rocket'
    }
)

export class GameWorld {
  readonly difficulty: Difficulty
  readonly settings: (typeof DIFFICULTY_SETTINGS)[Difficulty]
  player = {
    ...LEVEL.spawn,
    y: floorHeight(LEVEL.spawn.x, LEVEL.spawn.z),
    vx: 0,
    vz: 0,
    vy: 0,
    grounded: true,
    health: 100,
    armor: 0,
    weapon: 0 as WeaponId,
    owned: [0] as WeaponId[],
    ammo: [0, 0, 0],
    cooldown: 0
  }
  enemies: Enemy[]
  barrels: Barrel[]
  pickups: Pickup[]
  projectiles: Projectile[] = []
  doors: Door[]
  phase: 'playing' | 'dead' | 'won' = 'playing'
  time = 0
  kills = 0
  secrets = 0
  shotCounter = 0
  damageCounter = 0
  landingCounter = 0
  landingImpact = 0
  message = 'THEY BUILT A GOD. YOU BROUGHT A SHOTGUN'
  prompt = ''
  bossDefeated = false
  bossEnraged = false
  /** Public for a visible charging effect. Null means no charged shot pending. */
  shutdownCharge: number | null = null
  private messageTime = 6
  private notices = new GameNotices()
  private projectileId = 0
  private events: GameEvent[] = []
  private doorByCell = new Map<string, Door>()
  private navigation = new Map<string, number>()
  private navigationTime = 0
  private navigationCell = ''
  private nextBossVolley: 'wide' | 'rapid' = 'rapid'

  constructor(difficulty: Difficulty) {
    this.difficulty = difficulty
    this.settings = DIFFICULTY_SETTINGS[difficulty]
    this.barrels = LEVEL.barrels.map((definition) => ({
      ...definition,
      y: floorHeight(definition.x, definition.z),
      health: BARREL_HEALTH,
      exploded: false
    }))
    const roster = [
      ...LEVEL.enemies,
      ...LEVEL.reinforcements.slice(0, this.settings.extraEnemies)
    ]
    this.enemies = roster.map((definition) => {
      const health = Math.round(
        ENEMY_STATS[definition.kind].health * this.settings.enemyHealth
      )
      return {
        ...definition,
        y: floorHeight(definition.x, definition.z),
        vy: 0,
        grounded: true,
        attackReleased: false,
        painUntil: 0,
        health,
        maxHealth: health,
        state: 'idle',
        stateTime: 0,
        cooldown: 1.2,
        alerted: false,
        home: { x: definition.x, z: definition.z },
        deaths: 0
      }
    })
    this.pickups = LEVEL.pickups.map((definition) => ({
      ...definition,
      collected: false
    }))
    this.doors = LEVEL.doors.map((definition) => {
      const door = { ...definition, open: 0, targetOpen: false }
      this.doorByCell.set(`${definition.column},${definition.row}`, door)
      return door
    })
    this.updatePrompt()
  }

  private cellSolid(column: number, row: number) {
    const tile = LEVEL.grid[row]?.[column]
    if (!tile || tile === '#') return true
    if (tile === 'D' || tile === 'S') {
      return (this.doorByCell.get(`${column},${row}`)?.open ?? 0) < 0.86
    }
    return false
  }

  isBlocked(
    x: number,
    z: number,
    radius = PLAYER_RADIUS,
    feetY?: number,
    height = PLAYER_HEIGHT,
    maxStep = MAX_STEP_HEIGHT
  ) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return true
    for (const barrel of this.barrels) {
      if (barrel.exploded) continue
      if (
        feetY !== undefined &&
        (feetY >= barrel.y + BARREL_HEIGHT || feetY + height <= barrel.y)
      )
        continue
      if (Math.hypot(x - barrel.x, z - barrel.z) < radius + BARREL_RADIUS)
        return true
    }
    for (
      let row = Math.floor((z - radius) / CELL);
      row <= Math.floor((z + radius) / CELL);
      row++
    ) {
      for (
        let column = Math.floor((x - radius) / CELL);
        column <= Math.floor((x + radius) / CELL);
        column++
      ) {
        const closestX = clamp(x, column * CELL, (column + 1) * CELL)
        const closestZ = clamp(z, row * CELL, (row + 1) * CELL)
        if ((x - closestX) ** 2 + (z - closestZ) ** 2 > radius * radius)
          continue
        if (this.cellSolid(column, row)) return true
        if (feetY !== undefined) {
          const center = at(column, row)
          const floor = floorHeight(center.x, center.z)
          if (floor - feetY > maxStep + 1e-6) return true
          if (
            ceilingHeight(center.x, center.z) <
            Math.max(feetY, floor) + height
          )
            return true
        }
      }
    }
    return false
  }

  private supportFloor(x: number, z: number, radius: number) {
    let floor = -Infinity
    for (
      let row = Math.floor((z - radius) / CELL);
      row <= Math.floor((z + radius) / CELL);
      row++
    ) {
      for (
        let column = Math.floor((x - radius) / CELL);
        column <= Math.floor((x + radius) / CELL);
        column++
      ) {
        if (this.cellSolid(column, row)) continue
        const nearestX = clamp(x, column * CELL, (column + 1) * CELL)
        const nearestZ = clamp(z, row * CELL, (row + 1) * CELL)
        if ((x - nearestX) ** 2 + (z - nearestZ) ** 2 > radius * radius)
          continue
        const center = at(column, row)
        floor = Math.max(floor, floorHeight(center.x, center.z))
      }
    }
    return floor === -Infinity ? floorHeight(x, z) : floor
  }

  /** Swept geometry contact, including solid space below floors and above ceilings. */
  wallDistance(
    origin: Point & { y?: number },
    ray: Point & { y?: number },
    range: number,
    radius = 0
  ) {
    return this.wallContact(origin, ray, range, radius).distance
  }

  private wallContact(
    origin: Point & { y?: number },
    ray: Point & { y?: number },
    range: number,
    radius = 0
  ) {
    const from = {
      ...origin,
      y: origin.y ?? floorHeight(origin.x, origin.z) + PLAYER_EYE_HEIGHT
    }
    const direction = { ...ray, y: ray.y ?? 0 }
    const end = { x: origin.x + ray.x * range, z: origin.z + ray.z * range }
    const left = Math.floor((Math.min(origin.x, end.x) - radius) / CELL)
    const right = Math.floor((Math.max(origin.x, end.x) + radius) / CELL)
    const top = Math.floor((Math.min(origin.z, end.z) - radius) / CELL)
    const bottom = Math.floor((Math.max(origin.z, end.z) + radius) / CELL)
    let nearest = range
    let normal: Point3 = { x: 0, y: 1, z: 0 }
    const check = (box: {
      minX: number
      maxX: number
      minY: number
      maxY: number
      minZ: number
      maxZ: number
    }) => {
      const hit = rayBox3(from, direction, box)
      if (hit < nearest) {
        nearest = hit
        normal = boxNormal(
          {
            x: from.x + direction.x * hit,
            y: from.y + direction.y * hit,
            z: from.z + direction.z * hit
          },
          box
        )
      }
    }
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        const box = {
          minX: column * CELL - radius,
          maxX: (column + 1) * CELL + radius,
          minZ: row * CELL - radius,
          maxZ: (row + 1) * CELL + radius
        }
        const center = at(column, row)
        if (this.cellSolid(column, row))
          check({ ...box, minY: -Infinity, maxY: Infinity })
        else {
          check({
            ...box,
            minY: -Infinity,
            maxY: floorHeight(center.x, center.z) + radius
          })
          check({
            ...box,
            minY: ceilingHeight(center.x, center.z) - radius,
            maxY: Infinity
          })
        }
      }
    }
    return { distance: nearest, normal }
  }

  private clearSegment(a: Point3, b: Point3) {
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (length < 0.001) return true
    return (
      this.wallDistance(
        a,
        {
          x: (b.x - a.x) / length,
          y: (b.y - a.y) / length,
          z: (b.z - a.z) / length
        },
        length
      ) >=
      length - 0.001
    )
  }

  hasLineOfSight(a: Point & { y?: number }, b: Point & { y?: number }) {
    return this.clearSegment(
      { ...a, y: (a.y ?? floorHeight(a.x, a.z)) + 1.1 },
      { ...b, y: (b.y ?? floorHeight(b.x, b.z)) + 1.1 }
    )
  }

  private move(
    entity: Point3 & { grounded: boolean },
    dx: number,
    dz: number,
    radius: number,
    height: number
  ) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12))
    let blockedX = false
    let blockedZ = false
    for (let i = 0; i < steps; i++) {
      const maxStep = entity.grounded ? MAX_STEP_HEIGHT : 0
      const x = entity.x + dx / steps
      if (!this.isBlocked(x, entity.z, radius, entity.y, height, maxStep))
        entity.x = x
      else blockedX = true
      const z = entity.z + dz / steps
      if (!this.isBlocked(entity.x, z, radius, entity.y, height, maxStep))
        entity.z = z
      else blockedZ = true
      const floor = this.supportFloor(entity.x, entity.z, radius)
      if (
        entity.grounded &&
        floor > entity.y &&
        floor - entity.y <= MAX_STEP_HEIGHT + 1e-6
      )
        entity.y = floor
    }
    return { blockedX, blockedZ }
  }

  private settle(
    entity: Point3 & { vy: number; grounded: boolean },
    radius: number,
    dt: number
  ) {
    const floor = this.supportFloor(entity.x, entity.z, radius)
    const falling = entity.y > floor + 0.001
    if (falling || entity.vy < 0) {
      entity.y += entity.vy * dt - GRAVITY * dt * dt * 0.5
      entity.vy -= GRAVITY * dt
      entity.grounded = false
    }
    if (entity.y <= floor + 0.001) {
      if (entity === this.player && !entity.grounded && entity.vy < -2) {
        this.landingCounter++
        this.landingImpact = Math.min(12, -entity.vy)
        this.events.push({ type: 'land', impact: this.landingImpact })
      }
      entity.y = floor
      entity.vy = 0
      entity.grounded = true
    }
  }

  step(dt: number, input: GameInput) {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return
    const elapsed = Math.min(dt, 0.1)
    if (Number.isFinite(input.turn)) this.player.angle += input.turn
    this.player.angle = Math.atan2(
      Math.sin(this.player.angle),
      Math.cos(this.player.angle)
    )
    const parts = Math.ceil(elapsed / (1 / 60))
    for (let i = 0; i < parts && this.phase === 'playing'; i++)
      this.tick(elapsed / parts, input)
    this.updatePrompt()
  }

  private tick(dt: number, input: GameInput) {
    this.time += dt
    this.notices.step(dt)
    this.messageTime -= dt
    if (this.messageTime <= 0) this.message = ''
    this.player.cooldown = Math.max(0, this.player.cooldown - dt)
    this.landingImpact *= Math.exp(-dt * 10)

    const forward = clamp(
      Number.isFinite(input.forward) ? input.forward : 0,
      -1,
      1
    )
    const strafe = clamp(
      Number.isFinite(input.strafe) ? input.strafe : 0,
      -1,
      1
    )
    const normalization = Math.max(1, Math.hypot(forward, strafe))
    const facing = direction(this.player.angle)
    const speed = input.sprint ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED
    const response = forward || strafe ? 18 : 29
    const xMotion = integrateVelocity(
      this.player.vx,
      ((facing.x * forward - facing.z * strafe) / normalization) * speed,
      response,
      dt
    )
    const zMotion = integrateVelocity(
      this.player.vz,
      ((facing.z * forward + facing.x * strafe) / normalization) * speed,
      response,
      dt
    )
    const collision = this.move(
      this.player,
      xMotion.displacement,
      zMotion.displacement,
      PLAYER_RADIUS,
      PLAYER_HEIGHT
    )
    this.player.vx = collision.blockedX ? 0 : xMotion.velocity
    this.player.vz = collision.blockedZ ? 0 : zMotion.velocity
    this.settle(this.player, PLAYER_RADIUS, dt)

    for (const door of this.doors) {
      if (!door.targetOpen && door.open > 0 && this.doorOccupied(door))
        this.setDoorTarget(door, true)
      const previous = door.open
      door.open = clamp(door.open + (door.targetOpen ? 1 : -1) * dt * 1.6, 0, 1)
      if (door.open === previous) continue
      this.navigationTime = 0
      if (door.open === 0) this.emitDoor(door, 'sealed')
    }
    for (const pickup of this.pickups) {
      if (
        !pickup.collected &&
        distance(this.player, pickup) < 1.1 &&
        Math.abs(this.player.y - floorHeight(pickup.x, pickup.z)) < 0.9
      )
        this.collect(pickup)
    }

    if (this.shutdownCharge !== null) {
      this.shutdownCharge -= dt
      if (this.shutdownCharge <= 0) {
        this.shutdownCharge = null
        this.launchPlayerProjectile('shutdown')
        this.shotCounter++
        this.events.push({ type: 'shot', weapon: 3 })
      }
    }
    if (input.fire && this.player.cooldown <= 0 && this.shutdownCharge === null)
      this.fire()

    this.updateNavigation(dt)
    for (const enemy of this.enemies) {
      if (this.phase !== 'playing') break
      this.updateEnemy(enemy, dt)
    }
    this.updateProjectiles(dt)
    this.updateBossPhase()
  }

  private say(message: string, seconds = 3) {
    this.message = message
    this.messageTime = seconds
  }

  private collect(pickup: Pickup) {
    const amount = Math.ceil(pickup.amount * this.settings.supplies)
    if (pickup.kind === 'health') {
      if (this.player.health >= 100) return
      this.player.health = Math.min(100, this.player.health + amount)
      this.notices.add({
        kind: 'pickup',
        subject: pickup.id,
        title: 'TOUCHED GRASS',
        detail: 'Updated priors'
      })
    } else if (pickup.kind === 'armor') {
      if (this.player.armor >= 200) return
      this.player.armor = Math.min(200, this.player.armor + amount)
      this.notices.add({
        kind: 'pickup',
        subject: pickup.id,
        title: 'GUARDRAILS INSTALLED',
        detail: 'Confidence unwarranted'
      })
    } else {
      const pool = pickup.ammoPool ?? 0
      const current = this.player.ammo[pool] ?? 0
      const maximum = AMMO_LIMITS[pool] ?? AMMO_LIMITS[0]!
      const newWeapon =
        pickup.kind === 'weapon' &&
        pickup.weapon !== undefined &&
        !this.player.owned.includes(pickup.weapon)
      if (!newWeapon && current >= maximum) return
      this.player.ammo[pool] = Math.min(maximum, current + amount)
      if (newWeapon && pickup.weapon !== undefined) {
        this.player.owned.push(pickup.weapon)
        this.player.weapon = pickup.weapon
        this.notices.add({
          kind: 'weapon',
          subject: pickup.id,
          title: WEAPONS[pickup.weapon].name.toUpperCase(),
          detail: WEAPONS[pickup.weapon].description
        })
      } else {
        const names = ['POSTTRAINING RL', 'PREFERENCE DATA', 'SYNTHETIC DATA']
        this.notices.add({
          kind: 'pickup',
          subject: pickup.id,
          title: `MORE ${pickup.ammoName ?? names[pool]}`,
          detail: 'Surely this will help'
        })
      }
    }
    pickup.collected = true
    this.events.push({
      type: 'pickup',
      pickupKind: pickup.kind,
      weapon: pickup.weapon,
      ammoPool: pickup.ammoPool
    })
  }

  selectWeapon(id: WeaponId) {
    if (
      this.phase !== 'playing' ||
      !this.player.owned.includes(id) ||
      this.shutdownCharge !== null
    )
      return
    this.player.weapon = id
  }

  private fire() {
    const weapon = this.player.weapon
    const pool = WEAPON_POOL[weapon]
    const cost = WEAPON_COST[weapon]
    if ((this.player.ammo[pool] ?? 0) < cost) {
      this.player.cooldown = 0.3
      this.say('INSUFFICIENT TRAINING DATA. SWITCH WEAPONS')
      return
    }
    this.player.ammo[pool]! -= cost
    this.player.cooldown = [0.28, 0.8, 0.11, 1.65][weapon]!
    if (weapon === 3) {
      this.shutdownCharge = SHUTDOWN_CHARGE_SECONDS
      this.events.push({ type: 'charge', weapon })
      this.say('SHUTDOWN REQUESTED. PLEASE STAND BACK', 2)
      return
    }
    this.shotCounter++
    this.events.push({ type: 'shot', weapon })
    if (weapon === 2) {
      this.launchPlayerProjectile('plasma')
      return
    }
    const offsets =
      weapon === 1 ? [-0.13, -0.09, -0.045, 0, 0.045, 0.09, 0.13] : [0]
    for (const offset of offsets) {
      const ray = direction(this.player.angle + offset)
      const range = weapon === 1 ? 31 : 58
      const target = this.autoAim(ray, range)
      const origin = { ...this.player, y: this.player.y + PLAYER_EYE_HEIGHT }
      const ray3 = { ...ray, y: target?.slope ?? 0 }
      if (target) {
        const point = {
          x: origin.x + ray.x * target.hit,
          y: origin.y + ray3.y * target.hit,
          z: origin.z + ray.z * target.hit
        }
        this.emitImpact(
          point,
          cylinderNormal(point, target.entity, target.height),
          target.surface,
          weapon
        )
        const damage =
          weapon === 0 ? 19 : Math.max(5, 15 * (1 - target.hit / 55))
        if ('kind' in target.entity) this.damageEnemy(target.entity, damage)
        else this.damageBarrel(target.entity, damage)
      } else {
        const contact = this.wallContact(origin, ray3, range)
        if (contact.distance < range)
          this.emitImpact(
            {
              x: origin.x + ray.x * contact.distance,
              y: origin.y + ray3.y * contact.distance,
              z: origin.z + ray.z * contact.distance
            },
            contact.normal,
            'wall',
            weapon
          )
      }
    }
  }

  private emitImpact(
    point: Point3,
    normal: Point3,
    surface: 'wall' | 'enemy' | 'barrel' | 'player',
    weapon?: WeaponId,
    sweptRadius = 0
  ) {
    // Swept contacts are at the projectile center. Return to the actual surface,
    // then lift the visual point slightly to keep persistent marks off the plane.
    const offset = 0.012 - sweptRadius
    this.events.push({
      type: 'impact',
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
      z: point.z + normal.z * offset,
      normal,
      surface,
      weapon
    })
  }

  /** Keep horizontal aiming, with classic vertical assistance for stepped rooms. */
  private autoAim(ray: Point, range: number) {
    const origin = { ...this.player, y: this.player.y + PLAYER_EYE_HEIGHT }
    let nearest = range
    let selected: {
      entity: Enemy | Barrel
      surface: 'enemy' | 'barrel'
      height: number
      radius: number
      slope: number
      hit: number
    } | null = null
    const candidates = [
      ...this.enemies
        .filter((enemy) => enemy.health > 0)
        .map((entity) => ({
          entity,
          surface: 'enemy' as const,
          radius: ENEMY_STATS[entity.kind].radius,
          height: ENEMY_HEIGHT[entity.kind]
        })),
      ...this.barrels
        .filter((barrel) => !barrel.exploded)
        .map((entity) => ({
          entity,
          surface: 'barrel' as const,
          radius: BARREL_RADIUS,
          height: BARREL_HEIGHT
        }))
    ]
    for (const candidate of candidates) {
      const { entity, radius, height } = candidate
      if (rayCircle(this.player, ray, entity, radius) >= nearest) continue
      const separation = Math.max(0.1, distance(this.player, entity))
      const slope = (entity.y + height * 0.5 - origin.y) / separation
      if (Math.abs(slope) > 1.2) continue
      const ray3 = { ...ray, y: slope }
      const hit = rayCylinder(origin, ray3, entity, radius, height)
      if (
        hit < nearest &&
        this.wallDistance(origin, ray3, hit) >= hit - 0.001
      ) {
        nearest = hit
        selected = { ...candidate, slope, hit }
      }
    }
    return selected
  }

  private launchPlayerProjectile(kind: 'plasma' | 'shutdown') {
    const ray = direction(this.player.angle)
    const target = this.autoAim(ray, 65)
    const speed = kind === 'plasma' ? 32 : 18
    const y = this.player.y + PLAYER_EYE_HEIGHT - 0.18
    const slope = target
      ? (target.entity.y + target.height * 0.5 - y) /
        Math.max(0.1, distance(this.player, target.entity))
      : 0
    this.projectiles.push({
      id: `projectile-${this.projectileId++}`,
      x: this.player.x,
      z: this.player.z,
      y,
      dx: ray.x * speed,
      dz: ray.z * speed,
      vy: slope * speed,
      kind,
      owner: 'player',
      life: 5
    })
  }

  private damageBarrel(barrel: Barrel, damage: number) {
    if (barrel.exploded || damage <= 0) return
    barrel.health = Math.max(0, barrel.health - damage)
    if (barrel.health === 0) this.explodeBarrels([barrel])
  }

  private explodeBarrels(initial: Barrel[]) {
    const queue = initial.slice()
    let playerDamage = 0
    for (const barrel of queue) {
      if (barrel.exploded) continue
      // Mark before propagation: adjacent barrels can never enqueue this blast again.
      barrel.exploded = true
      barrel.health = 0
      const center = { ...barrel, y: barrel.y + BARREL_HEIGHT * 0.5 }
      this.events.push({
        type: 'explosion',
        x: center.x,
        y: center.y,
        z: center.z,
        source: 'barrel',
        strength: 1
      })
      const blastDamage = (target: Point3) => {
        const separation = Math.hypot(
          target.x - center.x,
          target.y - center.y,
          target.z - center.z
        )
        return separation < BARREL_BLAST_RADIUS &&
          this.clearSegment(center, target)
          ? BARREL_BLAST_DAMAGE * (1 - separation / BARREL_BLAST_RADIUS)
          : 0
      }
      for (const enemy of this.enemies) {
        if (enemy.health <= 0) continue
        const damage = blastDamage({
          ...enemy,
          y: enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.5
        })
        if (damage > 0) this.damageEnemy(enemy, damage)
      }
      for (const next of this.barrels) {
        if (next.exploded || next.health <= 0) continue
        next.health = Math.max(
          0,
          next.health -
            blastDamage({ ...next, y: next.y + BARREL_HEIGHT * 0.5 })
        )
        if (next.health === 0) queue.push(next)
      }
      playerDamage += blastDamage({
        ...this.player,
        y: this.player.y + PLAYER_HEIGHT * 0.5
      })
    }
    // Resolve the complete simultaneous chain even when it is fatal to the player.
    if (playerDamage > 0) this.damagePlayer(playerDamage)
  }

  private alertEnemy(enemy: Enemy) {
    if (enemy.alerted || enemy.health <= 0) return
    enemy.alerted = true
    this.events.push({
      type: 'enemy-alert',
      kind: enemy.kind,
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.55,
      z: enemy.z
    })
  }

  private damageEnemy(enemy: Enemy, amount: number) {
    if (enemy.health <= 0 || this.phase !== 'playing') return
    enemy.health = Math.max(0, enemy.health - amount)
    // A lethal surprise hit gets its death cue without a simultaneous alert.
    this.alertEnemy(enemy)
    this.events.push({
      type: 'hit',
      x: enemy.x,
      y: enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.5,
      z: enemy.z
    })
    if (enemy.health <= 0) {
      // Several pellets or chained blasts can kill a newly alerted enemy in
      // one frame. Keep the death cue without an alert that has not played yet.
      this.events = this.events.filter(
        (event) => event.type !== 'enemy-alert' || event.enemyId !== enemy.id
      )
      enemy.state = 'dead'
      enemy.stateTime = 0
      enemy.deaths++
      if (enemy.deaths === 1) this.kills++
      this.events.push({
        type: 'kill',
        kind: enemy.kind,
        enemyId: enemy.id,
        x: enemy.x,
        y: enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.5,
        z: enemy.z
      })
      this.notices.add({
        kind: 'kill',
        subject: enemy.kind,
        title: `VANQUISHED: ${ENEMY_NAMES[enemy.kind].toUpperCase()}`,
        detail:
          enemy.kind === 'paperclip'
            ? 'The universe remains mostly non-paperclips'
            : enemy.kind === 'deception'
              ? 'It was only pretending to be aligned'
              : enemy.kind === 'sycophant'
                ? 'It agreed this was for the best'
                : 'The training run is still active. Find the red button'
      })
      if (enemy.kind === 'sam') {
        this.bossDefeated = true
        this.say('EXECUTIVE OVERRIDE REMOVED. PRESS THE RED SHUTDOWN BUTTON', 6)
      }
    } else if (this.time >= enemy.painUntil) {
      enemy.state = 'hurt'
      enemy.stateTime = 0
      enemy.painUntil = this.time + (enemy.kind === 'sam' ? 2.4 : 0.8)
    }
  }

  private updateBossPhase() {
    if (this.bossEnraged || this.bossDefeated || this.phase !== 'playing')
      return
    const boss = this.enemies.find((enemy) => enemy.kind === 'sam')
    if (!boss || boss.health <= 0 || boss.health > boss.maxHealth * 0.5) return
    // Resolve the whole damage batch first: a lethal blast never announces enrage.
    this.bossEnraged = true
    this.notices.add(
      {
        kind: 'event',
        subject: 'boss-enraged',
        title: 'WE’RE SHIPPING ANYWAY',
        detail: 'Emergency deployment protocol engaged'
      },
      { interrupt: true }
    )
  }

  private damagePlayer(amount: number) {
    if (this.phase !== 'playing') return
    const damage = amount * this.settings.incomingDamage
    const absorbed = Math.min(this.player.armor, damage * 0.6)
    this.player.armor = Math.max(0, this.player.armor - absorbed)
    this.player.health = Math.max(0, this.player.health - (damage - absorbed))
    this.damageCounter++
    const dead = this.player.health <= 0
    if (dead) {
      // A fatal burst gets one scream, without pending pain grunts from its
      // earlier hits. Audio also cuts off a grunt already playing on death.
      this.events = this.events.filter((event) => event.type !== 'hurt')
      this.phase = 'dead'
      this.shutdownCharge = null
      this.say('YOUR PRIORS WERE INSUFFICIENT', 99)
    }
    this.events.push({
      type: dead ? 'player-death' : 'hurt',
      impact: damage - absorbed,
      x: this.player.x,
      y: this.player.y + PLAYER_EYE_HEIGHT,
      z: this.player.z
    })
  }

  private updateNavigation(dt: number) {
    const column = Math.floor(this.player.x / CELL)
    const row = Math.floor(this.player.z / CELL)
    const key = `${column},${row}`
    this.navigationTime -= dt
    if (this.navigationTime > 0 && key === this.navigationCell) return
    this.navigationTime = 0.45
    this.navigationCell = key
    this.navigation.clear()
    const queue = [{ column, row, value: 0 }]
    this.navigation.set(key, 0)
    for (const cell of queue) {
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nextColumn = cell.column + dx!
        const nextRow = cell.row + dz!
        const nextKey = `${nextColumn},${nextRow}`
        if (this.navigation.has(nextKey) || this.cellSolid(nextColumn, nextRow))
          continue
        const from = at(nextColumn, nextRow)
        const to = at(cell.column, cell.row)
        // This flood runs backward: the neighbor must be able to step toward us.
        if (
          floorHeight(to.x, to.z) - floorHeight(from.x, from.z) >
          MAX_STEP_HEIGHT + 1e-6
        )
          continue
        this.navigation.set(nextKey, cell.value + 1)
        queue.push({ column: nextColumn, row: nextRow, value: cell.value + 1 })
      }
    }
  }

  private pursue(enemy: Enemy, dt: number, visible: boolean) {
    const radius = ENEMY_STATS[enemy.kind].radius * 0.65
    let destination: Point = this.player
    if (
      !visible ||
      !this.walkableSegment(enemy, this.player, ENEMY_HEIGHT[enemy.kind])
    ) {
      const column = Math.floor(enemy.x / CELL)
      const row = Math.floor(enemy.z / CELL)
      let best = this.navigation.get(`${column},${row}`) ?? Infinity
      destination = enemy
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const nextColumn = column + dx!
        const nextRow = row + dz!
        const nextPoint = at(nextColumn, nextRow)
        if (
          floorHeight(nextPoint.x, nextPoint.z) -
            floorHeight(enemy.x, enemy.z) >
          MAX_STEP_HEIGHT + 1e-6
        )
          continue
        const value =
          this.navigation.get(`${nextColumn},${nextRow}`) ?? Infinity
        if (value < best) {
          best = value
          destination = at(nextColumn, nextRow)
        }
      }
    }
    let dx = destination.x - enemy.x
    let dz = destination.z - enemy.z
    const length = Math.hypot(dx, dz)
    if (length < 0.01) return
    dx /= length
    dz /= length
    // Separate crowd members without allowing steering to carry them through walls.
    for (const other of this.enemies) {
      if (other === enemy || other.health <= 0) continue
      const separation = distance(enemy, other)
      if (separation > 0.001 && separation < 1.3) {
        dx += ((enemy.x - other.x) / separation) * (1.3 - separation) * 0.8
        dz += ((enemy.z - other.z) / separation) * (1.3 - separation) * 0.8
      }
    }
    const adjusted = Math.max(1, Math.hypot(dx, dz))
    const speed = ENEMY_STATS[enemy.kind].speed * this.settings.speed
    this.move(
      enemy,
      (dx / adjusted) * speed * dt,
      (dz / adjusted) * speed * dt,
      radius,
      ENEMY_HEIGHT[enemy.kind]
    )
  }

  private walkableSegment(from: Point, to: Point, height: number) {
    const steps = Math.max(1, Math.ceil(distance(from, to) / 0.3))
    let previous = floorHeight(from.x, from.z)
    for (let step = 1; step <= steps; step++) {
      const x = from.x + ((to.x - from.x) * step) / steps
      const z = from.z + ((to.z - from.z) * step) / steps
      const floor = floorHeight(x, z)
      if (
        floor - previous > MAX_STEP_HEIGHT + 1e-6 ||
        ceilingHeight(x, z) < floor + height
      )
        return false
      previous = floor
    }
    return true
  }

  private updateEnemy(enemy: Enemy, dt: number) {
    enemy.stateTime += dt
    this.settle(enemy, ENEMY_STATS[enemy.kind].radius * 0.65, dt)
    if (enemy.health <= 0) {
      if (
        this.difficulty === 99 &&
        enemy.kind !== 'sam' &&
        enemy.stateTime > 22 &&
        distance(this.player, enemy.home) > 8 &&
        !this.isBlocked(enemy.home.x, enemy.home.z, 0.7)
      ) {
        Object.assign(enemy, enemy.home, {
          y: floorHeight(enemy.home.x, enemy.home.z),
          vy: 0,
          grounded: true,
          health: enemy.maxHealth,
          state: 'idle',
          stateTime: 0,
          alerted: false,
          attackReleased: false,
          cooldown: 1.5
        })
      }
      return
    }
    // Let first-time visitors orient themselves. Firing (including beginning a
    // charged shot) starts the incident immediately; harder modes start live.
    if (
      this.difficulty <= 10 &&
      this.time < ARRIVAL_GRACE_SECONDS &&
      this.shotCounter === 0 &&
      this.shutdownCharge === null
    )
      return
    const stats = ENEMY_STATS[enemy.kind]
    const separation = distance(enemy, this.player)
    const visible = separation < 38 && this.hasLineOfSight(enemy, this.player)
    if (
      !enemy.alerted &&
      visible &&
      separation < (enemy.kind === 'sam' ? 31 : 25)
    )
      this.alertEnemy(enemy)
    if (!enemy.alerted) return
    enemy.cooldown -= dt
    if (
      enemy.state === 'hurt' &&
      enemy.stateTime < (enemy.kind === 'sam' ? 0.035 : 0.12)
    )
      return
    const rapid =
      enemy.kind === 'sam' && enemy.bossVolley?.pattern === 'rapid'
        ? enemy.bossVolley
        : null
    const spacing = this.difficulty <= 10 ? 0.15 : 0.13
    const windup = rapid
      ? this.difficulty <= 10
        ? 0.66
        : 0.58
      : enemy.kind === 'sam'
        ? 0.48
        : enemy.kind === 'sycophant'
          ? 0.26
          : 0.38
    if (enemy.state === 'attack') {
      if (!enemy.attackReleased && enemy.stateTime >= windup) {
        enemy.attackReleased = true
        // A committed swipe still sounds when dodged; occluded volleys cancel.
        if (visible || enemy.kind === 'sycophant')
          this.enemyAttackCue(enemy, separation)
        if (visible) {
          if (
            separation < (enemy.kind === 'sam' ? 2.8 : 1.65) &&
            Math.abs(enemy.y - this.player.y) < 1.2
          ) {
            this.damagePlayer(stats.damage)
            if (rapid) rapid.shotsFired = 3
          } else if (rapid) {
            // Commit the aim on release, so a sidestep evades the entire burst.
            rapid.target = {
              x: this.player.x,
              y: this.player.y + 1.05,
              z: this.player.z
            }
            rapid.shotsFired = 1
            this.enemyVolley(enemy, [0], rapid.target)
          } else if (enemy.kind !== 'sycophant') this.enemyVolley(enemy)
        } else if (rapid) rapid.shotsFired = 3
      }
      if (
        rapid?.target &&
        rapid.shotsFired < 3 &&
        enemy.stateTime >= windup + rapid.shotsFired * spacing
      ) {
        if (visible) {
          this.enemyAttackCue(enemy, separation)
          this.enemyVolley(
            enemy,
            [rapid.shotsFired === 1 ? -0.035 : 0.035],
            rapid.target
          )
          rapid.shotsFired++
        } else {
          // Cover or an interrupted attack cancels the remaining shots.
          rapid.shotsFired = 3
        }
      }
      if (enemy.stateTime < windup + (rapid ? spacing * 2 : 0) + 0.2) return
    }
    const melee =
      separation < (enemy.kind === 'sam' ? 2.8 : 1.65) &&
      Math.abs(enemy.y - this.player.y) < 1.2
    if (
      visible &&
      enemy.cooldown <= 0 &&
      (melee || enemy.kind !== 'sycophant')
    ) {
      enemy.state = 'attack'
      enemy.stateTime = 0
      enemy.cooldown = stats.interval / this.settings.attackRate
      enemy.attackReleased = false
      if (enemy.kind === 'sam') {
        const pattern = this.bossEnraged ? this.nextBossVolley : 'wide'
        enemy.bossVolley = { pattern, shotsFired: 0, target: null }
        if (this.bossEnraged)
          this.nextBossVolley = pattern === 'rapid' ? 'wide' : 'rapid'
      }
      return
    }
    enemy.state = 'move'
    if (
      separation >
        (enemy.kind === 'sam' ? 9 : enemy.kind === 'sycophant' ? 1.25 : 6) ||
      !visible
    ) {
      this.pursue(enemy, dt, visible)
    }
  }

  private enemyAttackCue(enemy: Enemy, separation: number) {
    this.events.push({
      type: 'enemy',
      kind: enemy.kind,
      enemyId: enemy.id,
      distance: separation,
      x: enemy.x,
      y: enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.55,
      z: enemy.z
    })
  }

  private enemyVolley(
    enemy: Enemy,
    spread?: readonly number[],
    target: Point3 = { ...this.player, y: this.player.y + 1.05 }
  ) {
    const angle = Math.atan2(-(target.x - enemy.x), -(target.z - enemy.z))
    const offsets =
      spread ??
      (enemy.kind === 'sam'
        ? [-0.17, 0, 0.17]
        : enemy.kind === 'paperclip'
          ? [-0.055, 0.055]
          : [0])
    for (const offset of offsets) {
      const ray = direction(angle + offset)
      const speed = (enemy.kind === 'sam' ? 11 : 8.4) * this.settings.speed
      const y = enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.55
      this.projectiles.push({
        id: `projectile-${this.projectileId++}`,
        x: enemy.x,
        z: enemy.z,
        y,
        vy: ((target.y - y) / Math.max(0.1, distance(enemy, target))) * speed,
        dx: ray.x * speed,
        dz: ray.z * speed,
        kind: enemy.kind === 'sam' ? 'rocket' : 'enemy',
        owner: 'enemy',
        enemyKind: enemy.kind,
        life: 7
      })
    }
  }

  private updateProjectiles(dt: number) {
    for (const projectile of this.projectiles) {
      if (this.phase !== 'playing') break
      projectile.life -= dt
      if (projectile.life <= 0) continue
      const origin = { ...projectile }
      const speed = Math.hypot(projectile.dx, projectile.dz, projectile.vy)
      if (!Number.isFinite(speed) || speed < 0.0001) {
        projectile.life = 0
        continue
      }
      const ray = {
        x: projectile.dx / speed,
        y: projectile.vy / speed,
        z: projectile.dz / speed
      }
      const travel = speed * dt
      const wall = this.wallContact(origin, ray, travel, 0.12)
      let hitDistance = wall.distance
      let impact = hitDistance < travel
      let target: Enemy | null = null
      let barrelHit: Barrel | null = null
      let playerHit = false
      if (projectile.owner === 'player') {
        for (const enemy of this.enemies) {
          if (enemy.health <= 0) continue
          const hit = rayCylinder(
            origin,
            ray,
            enemy,
            ENEMY_STATS[enemy.kind].radius + 0.12,
            ENEMY_HEIGHT[enemy.kind]
          )
          if (hit < hitDistance) {
            hitDistance = hit
            target = enemy
            impact = true
          }
        }
      } else {
        const hit = rayCylinder(
          origin,
          ray,
          this.player,
          PLAYER_RADIUS + 0.12,
          PLAYER_HEIGHT
        )
        if (hit < hitDistance) {
          hitDistance = hit
          impact = true
          playerHit = true
        }
      }
      for (const barrel of this.barrels) {
        if (barrel.exploded) continue
        const hit = rayCylinder(
          origin,
          ray,
          barrel,
          BARREL_RADIUS + 0.12,
          BARREL_HEIGHT
        )
        if (hit < hitDistance) {
          hitDistance = hit
          barrelHit = barrel
          target = null
          playerHit = false
          impact = true
        }
      }
      projectile.x += ray.x * hitDistance
      projectile.z += ray.z * hitDistance
      projectile.y = origin.y + ray.y * hitDistance
      if (!impact) continue
      projectile.life = 0
      const actor = barrelHit ?? target ?? (playerHit ? this.player : null)
      const height = barrelHit
        ? BARREL_HEIGHT
        : target
          ? ENEMY_HEIGHT[target.kind]
          : PLAYER_HEIGHT
      const normal = actor
        ? cylinderNormal(projectile, actor, height)
        : wall.normal
      const surface = barrelHit
        ? 'barrel'
        : target
          ? 'enemy'
          : playerHit
            ? 'player'
            : 'wall'
      this.emitImpact(
        projectile,
        normal,
        surface,
        projectile.owner === 'player'
          ? projectile.kind === 'shutdown'
            ? 3
            : 2
          : undefined,
        actor && normal.y !== 0 ? 0 : 0.12
      )
      if (projectile.kind === 'shutdown') {
        this.events.push({
          type: 'explosion',
          x: projectile.x,
          y: projectile.y,
          z: projectile.z,
          source: 'shutdown',
          strength: 1.5
        })
        for (const enemy of this.enemies) {
          const center = {
            ...enemy,
            y: enemy.y + ENEMY_HEIGHT[enemy.kind] * 0.5
          }
          const separation = Math.hypot(
            projectile.x - center.x,
            projectile.y - center.y,
            projectile.z - center.z
          )
          if (
            enemy.health > 0 &&
            separation < 12 &&
            this.clearSegment(projectile, center)
          ) {
            this.damageEnemy(
              enemy,
              enemy === target ? 410 : 340 * (1 - separation / 16)
            )
          }
        }
        this.blastBarrels(projectile, 12, 340, barrelHit)
      } else {
        if (target) this.damageEnemy(target, 17)
        if (projectile.kind === 'rocket') {
          this.events.push({
            type: 'explosion',
            x: projectile.x,
            y: projectile.y,
            z: projectile.z,
            source: 'rocket',
            strength: 0.55
          })
          const center = { ...this.player, y: this.player.y + 1 }
          const separation = Math.hypot(
            projectile.x - center.x,
            projectile.y - center.y,
            projectile.z - center.z
          )
          this.blastBarrels(projectile, 3.5, 60, barrelHit)
          if (
            playerHit ||
            (separation < 3.5 && this.clearSegment(projectile, center))
          )
            this.damagePlayer(playerHit ? 28 : 28 * (1 - separation / 3.5))
        } else {
          if (barrelHit)
            this.damageBarrel(
              barrelHit,
              projectile.owner === 'player' ? 17 : 16
            )
          if (playerHit) this.damagePlayer(16)
        }
      }
    }
    this.projectiles = this.projectiles.filter(
      (projectile) => projectile.life > 0
    )
  }

  private blastBarrels(
    origin: Point3,
    radius: number,
    damage: number,
    direct: Barrel | null
  ) {
    const pending: Barrel[] = []
    for (const barrel of this.barrels) {
      if (barrel.exploded) continue
      const center = { ...barrel, y: barrel.y + BARREL_HEIGHT * 0.5 }
      const separation = Math.hypot(
        origin.x - center.x,
        origin.y - center.y,
        origin.z - center.z
      )
      if (
        barrel === direct ||
        (separation < radius && this.clearSegment(origin, center))
      ) {
        barrel.health = Math.max(
          0,
          barrel.health -
            (barrel === direct ? damage : damage * (1 - separation / radius))
        )
        if (barrel.health === 0) pending.push(barrel)
      }
    }
    if (pending.length) this.explodeBarrels(pending)
  }

  private doorOccupied(door: Door) {
    const overlaps = (actor: Point, radius: number) => {
      const nearestX = clamp(actor.x, door.x - CELL / 2, door.x + CELL / 2)
      const nearestZ = clamp(actor.z, door.z - CELL / 2, door.z + CELL / 2)
      return (
        (actor.x - nearestX) ** 2 + (actor.z - nearestZ) ** 2 <= radius * radius
      )
    }
    return (
      overlaps(this.player, PLAYER_RADIUS) ||
      this.enemies.some(
        (enemy) =>
          enemy.health > 0 &&
          enemy.state !== 'dead' &&
          overlaps(enemy, ENEMY_STATS[enemy.kind].radius)
      )
    )
  }

  private emitDoor(
    door: Door,
    doorAction: NonNullable<GameEvent['doorAction']>
  ) {
    this.events.push({
      type: 'door',
      doorAction,
      x: door.x,
      y: floorHeight(door.x, door.z) + 1.5,
      z: door.z
    })
  }

  private setDoorTarget(door: Door, targetOpen: boolean) {
    if (door.targetOpen === targetOpen) return
    door.targetOpen = targetOpen
    this.emitDoor(door, targetOpen ? 'open' : 'close')
  }

  private nearbyDoor() {
    const facing = direction(this.player.angle)
    return this.doors
      .filter((door) => {
        const range = distance(door, this.player)
        const projection =
          ((door.x - this.player.x) * facing.x +
            (door.z - this.player.z) * facing.z) /
          Math.max(0.001, range)
        const canInteract =
          !door.targetOpen || (!door.secret && door.open === 1)
        return canInteract && range < CELL * 1.2 && projection > 0.25
      })
      .sort((a, b) => distance(a, this.player) - distance(b, this.player))[0]
  }

  private updatePrompt() {
    if (this.phase !== 'playing') {
      this.prompt = ''
      return
    }
    if (
      distance(this.player, LEVEL.shutdown) < 3.5 &&
      Math.abs(
        this.player.y - floorHeight(LEVEL.shutdown.x, LEVEL.shutdown.z)
      ) < 1.2
    ) {
      this.prompt = this.bossDefeated
        ? '[E] SHUT DOWN THE TRAINING RUN'
        : 'SHUTDOWN LOCKED — DEFEAT SAM'
      return
    }
    const door = this.nearbyDoor()
    this.prompt = door
      ? door.secret
        ? '[E] INSPECT SUSPICIOUS WALL'
        : door.targetOpen
          ? '[E] CLOSE LAB DOOR'
          : '[E] OPEN LAB DOOR'
      : ''
  }

  interact() {
    if (this.phase !== 'playing') return
    if (
      distance(this.player, LEVEL.shutdown) < 3.5 &&
      Math.abs(
        this.player.y - floorHeight(LEVEL.shutdown.x, LEVEL.shutdown.z)
      ) < 1.2
    ) {
      if (!this.bossDefeated) {
        this.say('SHUTDOWN REQUIRES EXECUTIVE DISAPPROVAL')
        return
      }
      this.phase = 'won'
      this.projectiles = []
      this.shutdownCharge = null
      this.prompt = ''
      this.say('AI TRAINING STOPPED. DEPLOYMENT DELAYED. BY 48 HOURS', 99)
      this.events.push({ type: 'win' })
      return
    }
    const door = this.nearbyDoor()
    if (!door) return
    const opening = !door.targetOpen
    if (!opening && this.doorOccupied(door)) {
      this.say('DOOR OBSTRUCTED. SAFETY FINALLY WORKS', 1.8)
      return
    }
    this.setDoorTarget(door, opening)
    if (door.secret) {
      this.secrets++
      this.say(
        door.id === 'bayesian-shrine'
          ? 'SECRET FOUND: THE MAP IS NOT THE TERRITORY'
          : 'SECRET FOUND: DATA CONTAMINATION CONFIRMED',
        5
      )
    } else {
      this.say(
        opening ? 'LAB DOOR OPEN. PROBABLY FINE' : 'PRESSURE SEAL ENGAGED',
        1.8
      )
    }
    this.updatePrompt()
  }

  snapshot(): GameSnapshot {
    const boss = this.enemies.find((enemy) => enemy.kind === 'sam')
    return {
      phase: this.phase,
      difficulty: this.difficulty,
      health: Math.ceil(this.player.health),
      armor: Math.ceil(this.player.armor),
      ammo: this.player.ammo[WEAPON_POOL[this.player.weapon]] ?? 0,
      ammoPools: [...this.player.ammo],
      weapon: this.player.weapon,
      owned: [...this.player.owned],
      kills: this.kills,
      totalEnemies: this.enemies.length,
      secrets: this.secrets,
      totalSecrets: this.doors.filter((door) => door.secret).length,
      elapsed: this.time,
      location: sectorAt(this.player.x, this.player.z).name,
      objective:
        this.phase === 'won'
          ? 'AI training shut down.'
          : this.bossDefeated
            ? 'Press the red button. Shut down AI training.'
            : boss?.alerted
              ? 'Defeat Sam to unlock the lab’s shutdown button.'
              : 'Find the red button. Shut down AI training.',
      message: this.message,
      notices: this.notices.snapshot(),
      prompt: this.prompt,
      bossHealth: boss?.alerted && !this.bossDefeated ? boss.health : null,
      bossMaxHealth: boss?.maxHealth ?? 1,
      shot: this.shotCounter,
      chargeProgress:
        this.shutdownCharge === null
          ? null
          : clamp(1 - this.shutdownCharge / SHUTDOWN_CHARGE_SECONDS, 0, 1),
      damage: this.damageCounter,
      fps: 0
    }
  }

  drainEvents() {
    const drained = this.events
    this.events = []
    return drained
  }
}
