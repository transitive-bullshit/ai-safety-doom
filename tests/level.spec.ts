import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'

import { at, CELL, LEVEL, floorHeight } from '../lib/game/level'
import { WEAPON_COST, WEAPON_POOL } from '../lib/game/model'
import type { Point, WeaponId } from '../lib/game/types'

const viewport = 'canvas[data-testid="game-canvas"]'

interface State extends Point {
  angle: number
  y: number
  grounded: boolean
  sector: string
  sky: boolean
  phase: string
  enemies: (Point & { id: string; health: number; kind: string })[]
  doors: (Point & { id: string; open: number })[]
  barrels: (Point & {
    id: string
    y: number
    health: number
    exploded: boolean
  })[]
  owned: number[]
  ammo: number[]
  weapon: number
  health: number
  bossDefeated: boolean
  bossEnraged: boolean
  fps: number
  charge: number | null
  notices: { kind: string; subject: string }[]
}

async function readState(page: Page): Promise<State> {
  return page.locator(viewport).evaluate((canvas) => {
    const data = (canvas as HTMLCanvasElement).dataset
    return {
      x: Number(data.x),
      z: Number(data.z),
      angle: Number(data.angle),
      y: Number(data.y),
      grounded: data.grounded === 'true',
      sector: data.sector ?? '',
      sky: data.sky === 'true',
      phase: data.phase ?? '',
      enemies: JSON.parse(data.enemies ?? '[]'),
      doors: JSON.parse(data.doors ?? '[]'),
      barrels: JSON.parse(data.barrels ?? '[]'),
      owned: Array.from(document.querySelectorAll('.arsenal-keys .owned')).map(
        (element) => Number(element.textContent) - 1
      ),
      ammo: Array.from(
        document.querySelectorAll('.data-cell [data-ammo-pool]')
      ).map((element) => Number(element.getAttribute('data-value'))),
      weapon: Number(
        document
          .querySelector('[data-testid="hud-weapon"]')
          ?.getAttribute('data-weapon')
      ),
      health: Number.parseFloat(
        document.querySelector('[data-testid="hud-health"]')?.textContent ?? '0'
      ),
      bossDefeated: data.bossDefeated === 'true',
      bossEnraged: data.bossEnraged === 'true',
      fps: Number(data.fps),
      charge:
        document.querySelector<HTMLProgressElement>(
          '[data-testid="weapon-charge"] progress'
        )?.value ?? null,
      notices: Array.from(
        document.querySelectorAll<HTMLElement>('[data-notice-kind]')
      ).map((element) => ({
        kind: element.dataset.noticeKind!,
        subject: element.dataset.noticeSubject ?? ''
      }))
    }
  })
}

function route(from: Point, target: Point) {
  const start = [Math.floor(from.x / CELL), Math.floor(from.z / CELL)]
  const goal = [Math.floor(target.x / CELL), Math.floor(target.z / CELL)].join(
    ','
  )
  const visited = new Map<string, string | undefined>([
    [start.join(','), undefined]
  ])
  const queue = [start]
  for (const cell of queue) {
    const key = cell.join(',')
    if (key === goal) {
      let previous: string | undefined = key
      const result: Point[] = []
      while (previous) {
        const [x, z] = previous.split(',').map(Number)
        result.unshift(at(x!, z!))
        previous = visited.get(previous)
      }
      result.shift()
      result.push(target)
      return result
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const next = [cell[0]! + dx!, cell[1]! + dz!]
      const nextKey = next.join(',')
      const tile = LEVEL.grid[next[1]!]?.[next[0]!]
      if (!tile || tile === '#' || visited.has(nextKey)) continue
      const fromPoint = at(cell[0]!, cell[1]!),
        toPoint = at(next[0]!, next[1]!)
      if (
        Math.abs(
          floorHeight(fromPoint.x, fromPoint.z) -
            floorHeight(toPoint.x, toPoint.z)
        ) > 0.321
      )
        continue
      visited.set(nextKey, key)
      queue.push(next)
    }
  }
  throw new Error('No level route to the next destination')
}

function visible(from: Point, to: Point, doors: State['doors']) {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.2)
  for (let step = 1; step < steps; step++) {
    const x = from.x + ((to.x - from.x) * step) / steps
    const z = from.z + ((to.z - from.z) * step) / steps
    const column = Math.floor(x / CELL)
    const row = Math.floor(z / CELL)
    const tile = LEVEL.grid[row]?.[column]
    if (!tile || tile === '#') return false
    if (
      (tile === 'D' || tile === 'S') &&
      doors.some(
        (door) =>
          door.open < 0.86 &&
          Math.floor(door.x / CELL) === column &&
          Math.floor(door.z / CELL) === row
      )
    )
      return false
  }
  return true
}

const distance = (from: Point, to: Point) =>
  Math.hypot(from.x - to.x, from.z - to.z)
const aim = (from: Point, to: Point) =>
  Math.atan2(-(to.x - from.x), -(to.z - from.z))
const angleDelta = (to: number, from: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from))

test('full level reaches Sam, defeats him, and activates the shutdown finale @slow', async ({
  page,
  browser
}, testInfo) => {
  test.setTimeout(360_000)
  const errors: string[] = []
  const consoleErrors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
    if (message.type() === 'warning') warnings.push(message.text())
  })
  // Vercel serves this deployment endpoint; local `next start` does not.
  await page.route('**/_vercel/insights/script.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: ''
    })
  )
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.getByTestId('difficulty-10').check()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  await page.locator(viewport).evaluate((canvas) => {
    const profiles = new Map<string, string>()
    Object.defineProperty(window, '__projectileProfiles', { value: profiles })
    const observe = () => {
      const entries = JSON.parse(
        (canvas as HTMLCanvasElement).dataset.projectileProfiles ?? '[]'
      ) as { enemyKind: string; profile: string }[]
      for (const entry of entries) profiles.set(entry.enemyKind, entry.profile)
    }
    new MutationObserver(observe).observe(canvas, {
      attributes: true,
      attributeFilter: ['data-projectile-profiles']
    })
    observe()
  })

  const goals = LEVEL.route

  let goalIndex = 0
  let path: Point[] = []
  let previousInteraction = 0
  let previousReport = -1
  let bossSeen = false
  let bossEscalationSeen = false
  let previousEnemies: State['enemies'] = []
  const captured = new Set<string>()
  const weaponNotices = new Set<string>()
  const vanquishedKinds = new Set<string>()
  const saveView = async (name: string) => {
    const path = testInfo.outputPath(`${name}.png`)
    await page.screenshot({ path })
    await testInfo.attach(name, { path, contentType: 'image/png' })
    captured.add(name)
  }
  await saveView('arrival-platform')
  let chargeSeen = false
  let nextFpsSample = 1000
  const busyFrameSamples: { elapsedMs: number; fps: number; threat: string }[] =
    []
  const held = new Set<string>()
  const setKeys = async (next: Set<string>) => {
    for (const key of held) if (!next.has(key)) await page.keyboard.up(key)
    for (const key of next) if (!held.has(key)) await page.keyboard.down(key)
    held.clear()
    for (const key of next) held.add(key)
  }

  const start = Date.now()
  while (Date.now() - start < 320_000) {
    const state = await readState(page)
    for (const notice of state.notices) {
      if (notice.kind === 'weapon') weaponNotices.add(notice.subject)
      if (notice.kind === 'kill') vanquishedKinds.add(notice.subject)
    }
    const shutdownWeapon = LEVEL.pickups.find((pickup) => pickup.weapon === 3)!
    if (
      state.notices.some(
        (notice) =>
          notice.kind === 'weapon' && notice.subject === shutdownWeapon.id
      ) &&
      !captured.has('shutdown-weapon-found')
    ) {
      await saveView('shutdown-weapon-found')
    }
    if (state.phase === 'won') break
    if (state.bossEnraged && !state.bossDefeated && !bossEscalationSeen) {
      bossEscalationSeen = true
      await saveView('boss-emergency-phase')
    }
    expect(
      state.phase,
      `Run ended before victory at route segment ${goalIndex}`
    ).toBe('playing')
    const defeatedSam = state.enemies.find(
      (candidate) => candidate.kind === 'sam' && candidate.health === 0
    )
    if (
      defeatedSam &&
      !captured.has('sam-death') &&
      visible(state, defeatedSam, state.doors)
    ) {
      const delta = angleDelta(aim(state, defeatedSam), state.angle)
      if (Math.abs(delta) > 0.075) {
        await setKeys(new Set([delta > 0 ? 'ArrowLeft' : 'ArrowRight']))
        await page.waitForTimeout(
          Math.min(120, Math.max(20, Math.abs(delta) * 330))
        )
        await setKeys(new Set())
        await page.waitForTimeout(100)
      } else {
        await setKeys(new Set())
        await page.waitForTimeout(180)
        await saveView('sam-death')
      }
      continue
    }
    let goal = goals[goalIndex]!
    if (distance(state, goal) < 0.7 && goalIndex < goals.length - 1) {
      goalIndex++
      goal = goals[goalIndex]!
      path = []
    }
    if (!path.length) path = route(state, goal)
    while (path.length > 1 && distance(state, path[0]!) < 0.65) path.shift()
    const destination = path[0] ?? goal
    const enemy = state.enemies
      .filter(
        (candidate) =>
          candidate.health > 0 &&
          distance(state, candidate) < 29 &&
          visible(state, candidate, state.doors)
      )
      .sort((a, b) => distance(state, a) - distance(state, b))[0]
    const elapsedMs = Date.now() - start
    if (enemy && elapsedMs >= nextFpsSample) {
      busyFrameSamples.push({ elapsedMs, fps: state.fps, threat: enemy.kind })
      nextFpsSample = elapsedMs + 1000
    }
    if (state.charge !== null) {
      chargeSeen = true
      expect(state.charge).toBeGreaterThanOrEqual(0)
      expect(state.charge).toBeLessThanOrEqual(1)
    }
    const nearbyDoor = state.doors.find(
      (door) =>
        door.open < 0.86 &&
        distance(state, door) < 3.7 &&
        distance(door, destination) < CELL
    )
    const available = ([3, 2, 1, 0] as WeaponId[]).filter(
      (weapon) =>
        state.owned.includes(weapon) &&
        state.ammo[WEAPON_POOL[weapon]]! >= WEAPON_COST[weapon]
    )
    const selected =
      enemy?.kind === 'sam'
        ? available[0]
        : (available.find((weapon) => weapon !== 3) ?? available[0])
    if (selected !== undefined && selected !== state.weapon)
      await page.keyboard.press(String(selected + 1))

    const facingTarget =
      enemy && distance(state, enemy) < 14
        ? enemy
        : (nearbyDoor ?? enemy ?? destination)
    const desired = aim(state, facingTarget)
    const delta = angleDelta(desired, state.angle)
    const next = new Set<string>()
    if (Math.abs(delta) > 0.075)
      next.add(delta > 0 ? 'ArrowLeft' : 'ArrowRight')
    if (enemy && Math.abs(angleDelta(aim(state, enemy), state.angle)) < 0.13)
      next.add('Space')

    const dx = destination.x - state.x
    const dz = destination.z - state.z
    const length = Math.max(0.001, Math.hypot(dx, dz))
    const forward =
      (dx * -Math.sin(state.angle) + dz * -Math.cos(state.angle)) / length
    const strafe =
      (dx * Math.cos(state.angle) + dz * -Math.sin(state.angle)) / length
    if (distance(state, goal) > 0.6) {
      if (Math.abs(forward) > 0.38) next.add(forward > 0 ? 'w' : 's')
      if (Math.abs(strafe) > 0.38) next.add(strafe > 0 ? 'd' : 'a')
    }
    await setKeys(next)
    if (
      nearbyDoor &&
      Math.abs(angleDelta(aim(state, nearbyDoor), state.angle)) < 0.3 &&
      Date.now() - previousInteraction > 400
    ) {
      await page.keyboard.press('e')
      previousInteraction = Date.now()
    }
    if (state.bossDefeated && distance(state, LEVEL.shutdown) < 3.4) {
      await setKeys(new Set(['Space', 'Enter']))
      await page.keyboard.press('e')
    }
    const scene =
      state.sector === 'staging' && state.y < 0.1 && goalIndex >= 6
        ? 'lower-staging'
        : state.sector === 'computer' && goalIndex >= 11
          ? 'computer-room'
          : state.sector === 'court' && goalIndex >= 29 && state.y < 0.1
            ? 'courtyard'
            : null
    if (scene && !captured.has(scene) && Math.abs(delta) < 0.1) {
      await setKeys(new Set())
      await saveView(scene)
    }
    if (
      enemy?.kind === 'sam' &&
      !bossSeen &&
      Math.abs(angleDelta(aim(state, enemy), state.angle)) < 0.1
    ) {
      bossSeen = true
      await expect(page.getByTestId('hud-boss')).toBeVisible()
      const screenshot = testInfo.outputPath('boss-encounter.png')
      await page.screenshot({ path: screenshot })
      await testInfo.attach('boss-encounter', {
        path: screenshot,
        contentType: 'image/png'
      })
    }
    if (
      enemy &&
      enemy.kind !== 'sam' &&
      distance(state, enemy) < 14 &&
      !captured.has(`${enemy.kind}-encounter`) &&
      Math.abs(angleDelta(aim(state, enemy), state.angle)) < 0.1
    ) {
      await setKeys(new Set())
      await saveView(`${enemy.kind}-encounter`)
    }
    const newlyDead = state.enemies.find(
      (candidate) =>
        candidate.health === 0 &&
        !captured.has(`${candidate.kind}-death`) &&
        previousEnemies.some(
          (previous) => previous.id === candidate.id && previous.health > 0
        ) &&
        distance(state, candidate) < 16 &&
        Math.abs(angleDelta(aim(state, candidate), state.angle)) < 0.16
    )
    if (newlyDead) {
      await setKeys(new Set())
      await page.waitForTimeout(180)
      await saveView(`${newlyDead.kind}-death`)
    }
    previousEnemies = state.enemies
    if (goalIndex !== previousReport) {
      previousReport = goalIndex
      console.log(
        `Route ${goalIndex}/${goals.length - 1}; health=${state.health}; y=${state.y}; sector=${state.sector}; weapons=${state.owned.join(',')}; elapsed=${Math.round((Date.now() - start) / 1000)}s`
      )
    }
    await page.waitForTimeout(70)
  }
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'won'
  )
  const final = await readState(page)
  const shutdown = page.getByTestId('shutdown-transition')
  await expect(shutdown).toHaveAttribute('data-stage', 'power-down')
  await expect(page.getByTestId('restart-game')).toHaveCount(0)
  await expect(page.getByTestId('shutdown-title')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'won'
  )
  await page.waitForTimeout(440)
  await saveView('shutdown-wave')
  const duringShutdown = await readState(page)
  expect({
    x: duringShutdown.x,
    z: duringShutdown.z,
    health: duringShutdown.health,
    enemies: duringShutdown.enemies
  }).toEqual({
    x: final.x,
    z: final.z,
    health: final.health,
    enemies: final.enemies
  })
  await expect(shutdown).toHaveAttribute('data-stage', 'delayed')
  await expect(page.getByTestId('shutdown-title')).toBeVisible()
  await expect(page.getByTestId('shutdown-payoff')).toHaveCount(0)
  await expect(page.getByTestId('restart-game')).toHaveCount(0)
  await expect(page.locator(viewport)).toHaveAttribute(
    'data-powered-lamps',
    '0'
  )
  await saveView('shutdown-delayed-title')
  await expect(shutdown).toHaveAttribute('data-stage', 'payoff')
  await expect(page.getByTestId('shutdown-payoff')).toBeVisible()
  await expect(page.getByTestId('restart-game')).toBeFocused()
  await page.keyboard.down('Space')
  await page.keyboard.down('Enter')
  await setKeys(new Set())
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'won'
  )
  expect(final.bossDefeated).toBe(true)
  expect(final.enemies.find((enemy) => enemy.kind === 'sam')?.health).toBe(0)
  expect(final.owned).toEqual(
    expect.arrayContaining(
      LEVEL.pickups
        .filter((pickup) => pickup.kind === 'weapon')
        .map((pickup) => pickup.weapon)
    )
  )
  expect(bossSeen).toBe(true)
  expect(bossEscalationSeen).toBe(true)
  expect(captured.has('sam-death')).toBe(true)
  expect(chargeSeen).toBe(true)
  expect([...weaponNotices]).toEqual(
    expect.arrayContaining(
      LEVEL.pickups
        .filter((pickup) => pickup.kind === 'weapon')
        .map((pickup) => pickup.id)
    )
  )
  expect([...vanquishedKinds]).toEqual(
    expect.arrayContaining([
      ...new Set(LEVEL.enemies.map((enemy) => enemy.kind))
    ])
  )
  await expect(page.getByTestId('weapon-charge')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(consoleErrors).toEqual([])
  await expect(page.getByTestId('restart-game')).toBeVisible()
  const victoryScreenshot = testInfo.outputPath('shutdown-victory.png')
  await page.screenshot({ path: victoryScreenshot })
  await testInfo.attach('shutdown-victory', {
    path: victoryScreenshot,
    contentType: 'image/png'
  })
  const fps = busyFrameSamples.map((sample) => sample.fps).sort((a, b) => a - b)
  const performance = {
    samples: fps.length,
    min: fps[0],
    median: fps[Math.floor(fps.length / 2)],
    max: fps.at(-1)
  }
  const projectileProfiles = await page.evaluate(() => [
    ...(
      window as unknown as {
        __projectileProfiles: Map<string, string>
      }
    ).__projectileProfiles
  ])
  const rangedEnemies = [
    ...new Set(
      LEVEL.enemies
        .filter((enemy) => enemy.kind !== 'sycophant')
        .map((enemy) => enemy.kind)
    )
  ]
  expect(projectileProfiles.map(([kind]) => kind)).toEqual(
    expect.arrayContaining(rangedEnemies)
  )
  expect(new Set(projectileProfiles.map(([, profile]) => profile)).size).toBe(
    rangedEnemies.length
  )
  for (const [kind, profile] of projectileProfiles) expect(profile).toBe(kind)
  console.log(
    `Busy encounter FPS: ${JSON.stringify(performance)}; browser=${browser.version()}; cpu=${cpus()[0]?.model}`
  )
  const evidence = testInfo.outputPath('full-route-evidence.json')
  await writeFile(
    evidence,
    JSON.stringify(
      {
        difficulty: 10,
        elapsedMs: Date.now() - start,
        browser: browser.version(),
        cpu: cpus()[0]?.model,
        architecture: process.arch,
        performance,
        consoleErrors,
        warnings,
        weaponNotices: [...weaponNotices],
        vanquishedKinds: [...vanquishedKinds],
        bossEscalationSeen,
        projectileProfiles,
        busyFrameSamples,
        final
      },
      null,
      2
    )
  )
  await testInfo.attach('full-route-evidence', {
    path: evidence,
    contentType: 'application/json'
  })
  await page.getByTestId('restart-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  await expect(shutdown).toHaveCount(0)
  await expect(page.locator(viewport)).toHaveAttribute(
    'data-shutdown-elapsed',
    '-1.000'
  )
  await expect(page.locator(viewport)).toHaveAttribute(
    'data-boss-enraged',
    'false'
  )
  expect(
    Number(await page.locator(viewport).getAttribute('data-powered-lamps'))
  ).toBeGreaterThan(0)
})
