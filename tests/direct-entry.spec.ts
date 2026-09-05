import { expect, test } from '@playwright/test'
import { ENEMY_ART } from '../lib/game/enemy-art'
import { initialSnapshot } from '../lib/game/types'

test('slow assets enter play directly without a second gesture or held trigger', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${ENEMY_ART.deception.asset}`, async (route) => {
    await gate
    await route.continue()
  })

  await page.goto('/?skill=1')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'loading'
  )
  // Outlast Chrome's transient activation window: an ordinary slow download
  // must still enter gameplay, with the existing canvas capture fallback.
  await page.waitForTimeout(6000)
  release()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  await expect(page.getByTestId('enter-game')).toHaveCount(0)
  await page.waitForTimeout(700)
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute(
    'data-infinite',
    'true'
  )
  expect(
    Number(await page.getByTestId('hud-ammo').getAttribute('data-value'))
  ).toBe(initialSnapshot(1).ammo)
  const canvas = page.getByTestId('game-canvas')
  const before = Number(await canvas.getAttribute('data-z'))
  await page.keyboard.down('w')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-z')))
    .toBeLessThan(before - 0.5)
  await page.keyboard.up('w')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'paused'
  )
  expect(errors).toEqual([])
})

test('cancelling an in-flight launch cannot replace the next training run', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    `**${ENEMY_ART.deception.asset}`,
    async (route) => {
      await gate
      await route.continue()
    },
    { times: 1 }
  )

  await page.goto('/?skill=50')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'loading'
  )
  await page
    .locator('[data-menu-phase="loading"] [data-console-action]')
    .click()
  await expect(page.getByTestId('new-game')).toBeVisible()
  await page.getByTestId('new-game').click()
  await page.getByTestId('difficulty-1').check()
  await page.getByTestId('start-game').click()
  release()

  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  await expect(page.getByTestId('game-canvas')).toHaveCount(1)
  await expect(page.getByTestId('game-canvas')).toHaveAttribute(
    'data-difficulty',
    '1'
  )
  await expect(page).toHaveURL(/\?skill=1$/)
  await page.waitForTimeout(750)
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute(
    'data-infinite',
    'true'
  )
  expect(
    Number(await page.getByTestId('hud-ammo').getAttribute('data-value'))
  ).toBe(initialSnapshot(1).ammo)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'paused'
  )
  expect(errors).toEqual([])
})
