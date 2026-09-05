import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const shell = (page: Page) => page.getByTestId('game-shell')
const transition = (page: Page) => page.getByTestId('death-transition')

async function startRun(page: Page) {
  await page.goto('/?skill=99')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
}

async function encounterEnemies(page: Page) {
  await page.keyboard.down('w')
  await page.waitForTimeout(450)
  await page.keyboard.up('w')
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="game-shell"]')
        ?.getAttribute('data-phase') === 'dead',
    null,
    { timeout: 45_000 }
  )
}

test('fatal damage covers the game before exposing the death menu and resets on retry', async ({
  page
}, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await startRun(page)
  await page.keyboard.down('Space')
  await encounterEnemies(page)

  const detectedAt = Date.now()
  await expect(transition(page)).toHaveAttribute('data-stage', 'falling')
  await expect(page.locator('[data-menu-phase="dead"]')).toHaveCount(0)
  await expect(page.getByTestId('restart-game')).toHaveCount(0)
  const [cover, game, hud] = await Promise.all([
    transition(page).boundingBox(),
    page.locator('.game-frame').boundingBox(),
    page.locator('.hud-wrap').boundingBox()
  ])
  expect(cover).toEqual(game)
  expect(cover!.y + cover!.height).toBeGreaterThanOrEqual(hud!.y + hud!.height)

  await page.keyboard.press('Escape')
  await expect(shell(page)).toHaveAttribute('data-phase', 'dead')
  // Fire remains held from live combat through the fatal hit and menu reveal.
  await page.waitForTimeout(450)
  const columnPositions = await page
    .locator('.death-blood-column')
    .evaluateAll((columns) =>
      columns.map(
        (column) =>
          new DOMMatrixReadOnly(getComputedStyle(column).transform).m42
      )
    )
  expect(
    Math.max(...columnPositions) - Math.min(...columnPositions)
  ).toBeGreaterThan(40)
  expect(Math.min(...columnPositions)).toBeLessThan(-40)
  await page.screenshot({ path: testInfo.outputPath('blood-descending.png') })

  await expect(transition(page)).toHaveAttribute('data-stage', 'covered')
  expect(Date.now() - detectedAt).toBeGreaterThan(1000)
  await expect(page.getByTestId('restart-game')).toBeVisible()
  await expect(page.getByTestId('restart-game')).toBeFocused()
  await page.keyboard.down('Space')
  await page.keyboard.up('Space')
  await expect(shell(page)).toHaveAttribute('data-phase', 'dead')
  const settled = await page
    .locator('.death-blood-column')
    .evaluateAll((columns) =>
      columns.every(
        (column) =>
          new DOMMatrixReadOnly(getComputedStyle(column).transform).m42 === 0
      )
    )
  expect(settled).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('death-menu-covered.png') })

  await page.getByTestId('restart-game').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await expect(transition(page)).toHaveCount(0)
  await expect(page.getByTestId('game-canvas')).toHaveCount(1)
  await encounterEnemies(page)
  await expect(transition(page)).toHaveAttribute('data-stage', 'falling')
  await expect(page.getByTestId('restart-game')).toHaveCount(0)
  await expect(transition(page)).toHaveAttribute('data-stage', 'covered')
  await page.getByTestId('return-menu').click()
  await expect(shell(page)).toHaveAttribute('data-phase', 'title')
  await expect(transition(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reduced motion reveals the death menu without a falling curtain', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startRun(page)
  await encounterEnemies(page)
  await expect(transition(page)).toHaveAttribute('data-stage', 'covered')
  await expect(page.getByTestId('restart-game')).toBeVisible()
  await expect(page.getByTestId('restart-game')).toBeFocused()
  const still = await page
    .locator('.death-blood-column')
    .evaluateAll((columns) =>
      columns.every((column) => {
        const style = getComputedStyle(column)
        return style.animationName === 'none' && style.transform === 'none'
      })
    )
  expect(still).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('death-reduced-motion.png')
  })
  await page.keyboard.press('Enter')
  await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
  await expect(transition(page)).toHaveCount(0)
})
