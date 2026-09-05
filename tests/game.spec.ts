import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { at, CELL, LEVEL, floorHeight } from '../lib/game/level'
import { ENEMY_ART } from '../lib/game/enemy-art'
import { DIFFICULTIES } from '../lib/game/types'
import type { Difficulty } from '../lib/game/types'

const viewport = 'canvas[data-testid="game-canvas"]'
const shell = (page: Page) => page.getByTestId('game-shell')
const browserErrors = new WeakMap<Page, string[]>()

interface Diagnostics {
  x: number
  z: number
  angle: number
  phase: string
  enemies: { id: string; x: number; z: number; health: number; kind: string }[]
  doors: { id: string; x: number; z: number; open: number }[]
  pickups: { id: string; kind: string; x: number; z: number }[]
  barrels: {
    id: string
    x: number
    y: number
    z: number
    health: number
    exploded: boolean
  }[]
}

async function readState(page: Page): Promise<Diagnostics> {
  return page.locator(viewport).evaluate((canvas) => {
    const data = (canvas as HTMLCanvasElement).dataset
    return {
      x: Number(data.x),
      z: Number(data.z),
      angle: Number(data.angle),
      phase: data.phase ?? '',
      enemies: JSON.parse(data.enemies ?? '[]'),
      doors: JSON.parse(data.doors ?? '[]'),
      pickups: JSON.parse(data.pickups ?? '[]'),
      barrels: JSON.parse(data.barrels ?? '[]')
    }
  })
}

async function startRun(page: Page, difficulty: Difficulty = 1) {
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.getByTestId(`difficulty-${difficulty}`).check()
  await page.getByTestId('start-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await expect(page.locator(viewport)).toHaveCount(1)
  await expect(page.locator(viewport)).toHaveAttribute(
    'data-difficulty',
    String(difficulty)
  )
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
}

async function turnTo(page: Page, desired: number) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const state = await readState(page)
    const delta = Math.atan2(
      Math.sin(desired - state.angle),
      Math.cos(desired - state.angle)
    )
    if (Math.abs(delta) < 0.055) return
    const key = delta > 0 ? 'ArrowLeft' : 'ArrowRight'
    await page.keyboard.down(key)
    // Use the actual rendered heading after each short input, not an assumed frame rate.
    await page.waitForTimeout(
      Math.min(180, Math.max(20, Math.abs(delta) * 400))
    )
    await page.keyboard.up(key)
  }
  const state = await readState(page)
  expect(
    Math.abs(
      Math.atan2(
        Math.sin(desired - state.angle),
        Math.cos(desired - state.angle)
      )
    )
  ).toBeLessThan(0.1)
}

async function walkTo(
  page: Page,
  target: { x: number; z: number },
  firing = false
) {
  const state = await readState(page)
  const start = [Math.floor(state.x / CELL), Math.floor(state.z / CELL)]
  const end = `${Math.floor(target.x / CELL)},${Math.floor(target.z / CELL)}`
  const visited = new Map<string, string | undefined>([
    [start.join(','), undefined]
  ])
  const queue = [start]
  const path: { x: number; z: number }[] = []
  for (const cell of queue) {
    if (cell.join(',') === end) {
      let key: string | undefined = end
      while (key) {
        const [x, z] = key.split(',').map(Number)
        path.unshift(at(x!, z!))
        key = visited.get(key)
      }
      path.shift()
      break
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const x = cell[0]! + dx!,
        z = cell[1]! + dz!,
        key = `${x},${z}`
      const tile = LEVEL.grid[z]?.[x]
      if (!tile || tile === '#' || visited.has(key)) continue
      const from = at(cell[0]!, cell[1]!),
        to = at(x, z)
      if (
        Math.abs(floorHeight(from.x, from.z) - floorHeight(to.x, to.z)) > 0.321
      )
        continue
      visited.set(key, cell.join(','))
      queue.push([x, z])
    }
  }
  path.push(target)
  if (firing) await page.keyboard.down('Space')
  try {
    for (const point of path) {
      const current = await readState(page)
      if (Math.hypot(point.x - current.x, point.z - current.z) < 0.6) continue
      await turnTo(
        page,
        Math.atan2(-(point.x - current.x), -(point.z - current.z))
      )
      await page.keyboard.down('w')
      await page.waitForFunction(
        ({ selector, x, z }) => {
          const data =
            document.querySelector<HTMLCanvasElement>(selector)?.dataset
          return (
            data && Math.hypot(Number(data.x) - x, Number(data.z) - z) < 0.55
          )
        },
        { selector: viewport, ...point },
        { timeout: 10_000 }
      )
      await page.keyboard.up('w')
    }
  } finally {
    await page.keyboard.up('w')
    if (firing) await page.keyboard.up('Space')
  }
}

async function openingWeapon(page: Page, firing = false) {
  const weapon = LEVEL.pickups.find((pickup) => pickup.weapon === 1)!
  for (const point of LEVEL.route) {
    await walkTo(page, point, firing)
    if (Math.hypot(point.x - weapon.x, point.z - weapon.z) < 0.1) break
  }
  return weapon
}

test.beforeEach(async ({ page, browser }, testInfo) => {
  testInfo.annotations.push({ type: 'browser', description: browser.version() })
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  await testInfo.attach('browser-baseline', {
    body: JSON.stringify(
      {
        browser: browser.version(),
        platform: process.platform,
        architecture: process.arch
      },
      null,
      2
    ),
    contentType: 'application/json'
  })
})

test.afterEach(async ({ page }, testInfo) => {
  const errors = browserErrors.get(page) ?? []
  await testInfo.attach('uncaught-browser-errors', {
    body: JSON.stringify(errors),
    contentType: 'application/json'
  })
  expect(errors).toEqual([])
})

test('direct navigation validates difficulty and starts the selected setting', async ({
  page
}) => {
  await page.goto('/?skill=invalid')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(shell(page)).toHaveAttribute('data-phase', 'title')
  await page.getByTestId('new-game').click()
  await expect(page.getByTestId('difficulty-10')).toBeChecked()
  await expect(page.getByRole('radio')).toHaveCount(DIFFICULTIES.length)

  const chosen = DIFFICULTIES.find((difficulty) => difficulty.value > 50)!
  await page.getByTestId(`difficulty-${chosen.value}`).check()
  await page.getByTestId('start-game').click()
  await expect(page).toHaveURL(new RegExp(`[?&]skill=${chosen.value}(?:&|$)`))
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await expect(page.locator(viewport)).toHaveAttribute(
    'data-difficulty',
    String(chosen.value)
  )

  await page.reload()
  await page.getByTestId('new-game').click()
  await expect(page.getByTestId(`difficulty-${chosen.value}`)).toBeChecked()
})

test('movement, combat, weapon pickup, and door interaction cross the UI and simulation', async ({
  page
}) => {
  await startRun(page)
  const weapon = await openingWeapon(page)
  const initial = await readState(page)
  const target = initial.enemies
    .filter((enemy) => enemy.kind === 'deception' && enemy.health > 0)
    .sort(
      (a, b) =>
        Math.hypot(a.x - initial.x, a.z - initial.z) -
        Math.hypot(b.x - initial.x, b.z - initial.z)
    )[0]!
  const angle = Math.atan2(-(target.x - initial.x), -(target.z - initial.z))
  await turnTo(page, angle)
  const ammoBefore = Number(await page.getByTestId('hud-ammo').textContent())
  await page.keyboard.down('Space')
  try {
    await expect
      .poll(
        async () =>
          (await readState(page)).enemies.find(
            (enemy) => enemy.id === target.id
          )?.health
      )
      .toBe(0)
  } finally {
    await page.keyboard.up('Space')
  }
  expect(Number(await page.getByTestId('hud-ammo').textContent())).toBeLessThan(
    ammoBefore
  )
  await expect
    .poll(async () =>
      Number((await page.getByTestId('hud-kills').textContent())?.split('/')[0])
    )
    .toBeGreaterThan(0)
  await expect(
    page.locator(
      `[data-notice-kind="kill"][data-notice-subject="${target.kind}"]`
    )
  ).toBeVisible()

  await walkTo(page, weapon, true)
  await expect
    .poll(async () =>
      (await readState(page)).pickups.some((pickup) => pickup.id === weapon.id)
    )
    .toBe(false)
  await expect(page.getByTestId('hud-weapon')).toHaveAttribute(
    'data-weapon',
    String(weapon.weapon)
  )
  const discovery = page.locator(
    `[data-notice-kind="weapon"][data-notice-subject="${weapon.id}"]`
  )
  await expect(discovery).toBeVisible()
  expect(
    await discovery
      .locator('strong')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
  ).toBeGreaterThanOrEqual(20)

  const gate = LEVEL.doors.find((door) => !door.secret)!
  const from = await readState(page)
  const horizontal = Math.abs(gate.x - from.x) > Math.abs(gate.z - from.z)
  const side = horizontal
    ? Math.sign(from.x - gate.x)
    : Math.sign(from.z - gate.z)
  const approach = {
    x: gate.x + (horizontal ? CELL * side : 0),
    z: gate.z + (horizontal ? 0 : CELL * side)
  }
  await walkTo(page, approach, true)
  await turnTo(page, Math.atan2(-(gate.x - approach.x), -(gate.z - approach.z)))
  await expect
    .poll(
      async () =>
        (await readState(page)).doors.find((door) => door.id === gate.id)?.open
    )
    .toBe(0)
  await page.keyboard.press('e')
  await expect
    .poll(
      async () =>
        (await readState(page)).doors.find((door) => door.id === gate.id)?.open
    )
    .toBeGreaterThan(0.9)
  // Ordinary lab doors close through the same interaction key, and both
  // their travel and collision state freeze with the paused simulation.
  await expect
    .poll(
      async () =>
        (await readState(page)).doors.find((door) => door.id === gate.id)?.open
    )
    .toBe(1)
  await page.keyboard.press('e')
  await page.waitForTimeout(120)
  await page.keyboard.press('Escape')
  await expect(shell(page)).toHaveAttribute('data-phase', 'paused')
  const pausedDoor = (await readState(page)).doors.find(
    (door) => door.id === gate.id
  )!
  expect(pausedDoor.open).toBeGreaterThan(0)
  expect(pausedDoor.open).toBeLessThan(1)
  await page.waitForTimeout(450)
  expect(
    (await readState(page)).doors.find((door) => door.id === gate.id)?.open
  ).toBe(pausedDoor.open)
  await page.getByTestId('resume-game').click()
  await expect
    .poll(
      async () =>
        (await readState(page)).doors.find((door) => door.id === gate.id)?.open
    )
    .toBe(0)
  await page.keyboard.press('e')
  await expect
    .poll(
      async () =>
        (await readState(page)).doors.find((door) => door.id === gate.id)?.open
    )
    .toBe(1)
  const exit = {
    x: gate.x - (horizontal ? CELL * side : 0),
    z: gate.z - (horizontal ? 0 : CELL * side)
  }
  await walkTo(page, exit, true)
  const crossed = await readState(page)
  expect(Math.hypot(crossed.x - exit.x, crossed.z - exit.z)).toBeLessThan(1)
})

test('shootable data barrels chain-explode and remain destroyed while crossing their position', async ({
  page
}, testInfo) => {
  await startRun(page)
  await openingWeapon(page)
  const pair = LEVEL.barrels.slice(0, 2)
  const near = pair[1]!
  const approach = { x: near.x, z: near.z + CELL * 3 }
  await walkTo(page, approach)
  const state = await readState(page)
  expect(
    state.barrels
      .filter((barrel) =>
        pair.some((definition) => definition.id === barrel.id)
      )
      .every((barrel) => !barrel.exploded)
  ).toBe(true)
  expect(state.barrels.length).toBe(LEVEL.barrels.length)
  await turnTo(page, Math.atan2(-(near.x - state.x), -(near.z - state.z)))
  await page.screenshot({ path: testInfo.outputPath('barrels-before.png') })
  const before = Number(await page.getByTestId('hud-ammo').textContent())
  await page.keyboard.down('Space')
  try {
    await expect
      .poll(
        async () =>
          (await readState(page)).barrels.filter(
            (barrel) =>
              pair.some((definition) => definition.id === barrel.id) &&
              barrel.exploded
          ).length
      )
      .toBe(pair.length)
  } finally {
    await page.keyboard.up('Space')
  }
  expect(Number(await page.getByTestId('hud-ammo').textContent())).toBeLessThan(
    before
  )
  await page.screenshot({
    path: testInfo.outputPath('barrels-chain-explosion.png')
  })
  await page.waitForTimeout(180)
  await page.screenshot({
    path: testInfo.outputPath('barrels-blast-settled.png')
  })
  await walkTo(page, near)
  const after = await readState(page)
  expect(Math.hypot(after.x - near.x, after.z - near.z)).toBeLessThan(1)
  expect(
    after.barrels.filter(
      (barrel) =>
        pair.some((definition) => definition.id === barrel.id) &&
        barrel.exploded &&
        barrel.health === 0
    ).length
  ).toBe(pair.length)
  await page.screenshot({ path: testInfo.outputPath('barrels-aftermath.png') })
})

test('pause freezes the run; map, sound, resume, and repeated restart keep one runtime', async ({
  page
}) => {
  await startRun(page)
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('automap')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('automap')).toBeHidden()

  const weapon = await openingWeapon(page, true)
  await page.keyboard.press('Escape')
  await expect(shell(page)).toHaveAttribute('data-phase', 'paused')
  const paused = await readState(page)
  const pausedAmmo = await page.getByTestId('hud-ammo').textContent()
  const pausedHealth = await page.getByTestId('hud-health').textContent()
  // Space on the focused Resume button is an intentional accessible activation.
  // Focus the viewport to verify gameplay inputs themselves stay inactive.
  await page.locator(viewport).focus()
  await page.keyboard.down('w')
  await page.keyboard.down('Space')
  await page.waitForTimeout(400)
  await page.keyboard.up('w')
  await page.keyboard.up('Space')
  const stillPaused = await readState(page)
  expect({
    x: stillPaused.x,
    z: stillPaused.z,
    enemies: stillPaused.enemies
  }).toEqual({ x: paused.x, z: paused.z, enemies: paused.enemies })
  expect(await page.getByTestId('hud-ammo').textContent()).toBe(pausedAmmo)
  expect(await page.getByTestId('hud-health').textContent()).toBe(pausedHealth)

  await page.getByTestId('mute').click()
  await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('resume-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await page.keyboard.down('s')
  await expect
    .poll(async () => {
      const next = await readState(page)
      return Math.hypot(next.x - paused.x, next.z - paused.z)
    })
    .toBeGreaterThan(0.3)
  await page.keyboard.up('s')

  for (let restart = 0; restart < 2; restart++) {
    await page.keyboard.press('Escape')
    await expect(shell(page)).toHaveAttribute('data-phase', 'paused')
    await page.getByTestId('restart-game').click()
    await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
    await expect(page.locator(viewport)).toHaveCount(1)
    const reset = await readState(page)
    expect(reset.x).toBeCloseTo(LEVEL.spawn.x, 1)
    expect(reset.z).toBeCloseTo(LEVEL.spawn.z, 1)
    expect(reset.pickups.some((pickup) => pickup.id === weapon.id)).toBe(true)
    await expect(page.getByTestId('hud-weapon')).toHaveAttribute(
      'data-weapon',
      '0'
    )
    await expect(page.getByTestId('mute')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  }
  await page.keyboard.press('Escape')
  await page.getByTestId('return-menu').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'title')
  await expect(page.locator(viewport)).toHaveCount(0)
  await page.getByTestId('new-game').click()
  await page.getByTestId('difficulty-50').check()
  await page.getByTestId('start-game').click()
  await expect(page.locator(viewport)).toHaveAttribute('data-difficulty', '50')
})

test('an asset loading failure offers a working retry', async ({ page }) => {
  const enemyAtlas = `**${ENEMY_ART.deception.asset}`
  await page.route(enemyAtlas, (route) => route.abort())
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'error')
  await expect(page.locator(viewport)).toHaveCount(0)
  await page.unroute(enemyAtlas)
  await page.getByTestId('restart-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await expect(page.locator(viewport)).toHaveCount(1)
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
})

test('an actual enemy kill leads to death and a fresh playable replay', async ({
  page
}) => {
  await startRun(page, 99)
  await page.keyboard.down('w')
  await page.waitForTimeout(450)
  await page.keyboard.up('w')
  await expect(shell(page)).toHaveAttribute('data-phase', 'dead', {
    timeout: 45_000
  })
  await expect(page.getByTestId('hud-health')).toHaveText(/^0%$/)
  const dead = await readState(page)
  expect(Number.isFinite(dead.x) && Number.isFinite(dead.z)).toBe(true)
  await page.getByTestId('restart-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await expect(page.locator(viewport)).toHaveCount(1)
  await expect(page.getByTestId('hud-health')).toHaveText(/^100%$/)
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
})

test('fullscreen toggles through the browser fullscreen API', async ({
  page
}) => {
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  // Entry now captures the mouse immediately; release it before using the UI.
  await page.keyboard.press('Escape')
  await expect(shell(page)).toHaveAttribute('data-phase', 'paused')
  const toggle = page.getByTestId('fullscreen')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page.evaluate(() =>
      document.fullscreenElement?.getAttribute('data-testid')
    )
  ).toBe('game-shell')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(
    true
  )
})
