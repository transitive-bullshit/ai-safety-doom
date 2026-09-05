import { expect, test } from '@playwright/test'

test('one nearby monster vocal follows active entry, respects pause, and resets on retry', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/_vercel/insights/script.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: ''
    })
  )
  await page.goto('/?skill=1')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  const shell = page.getByTestId('game-shell')
  const canvas = page.getByTestId('game-canvas')
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  await page.keyboard.press('Escape')
  await expect(shell).toHaveAttribute('data-phase', 'paused')
  expect(await canvas.getAttribute('data-arrival-cue')).toBeNull()
  const enemies = JSON.parse((await canvas.getAttribute('data-enemies'))!) as {
    kind: string
  }[]
  await page.waitForTimeout(1900)
  expect(await canvas.getAttribute('data-arrival-cue')).toBeNull()
  await page.keyboard.press('Escape')
  await expect(canvas).toHaveAttribute('data-arrival-cue', /.+/)
  const first = (await canvas.getAttribute('data-arrival-cue'))!
  const cue = JSON.parse(first) as { kind: string; at: number }
  expect(enemies.some((enemy) => enemy.kind === cue.kind)).toBe(true)
  expect(cue.kind).not.toBe('sam')
  expect(cue.at).toBeGreaterThanOrEqual(1)
  expect(cue.at).toBeLessThanOrEqual(2)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1900)
  expect(await canvas.getAttribute('data-arrival-cue')).toBe(first)
  await page.keyboard.press('Escape')
  await page.getByTestId('restart-game').click()
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  expect(await canvas.getAttribute('data-arrival-cue')).toBeNull()
  await expect(canvas).toHaveAttribute('data-arrival-cue', /.+/)
  const restarted = JSON.parse(
    (await canvas.getAttribute('data-arrival-cue'))!
  ) as { at: number }
  expect(restarted.at).toBeGreaterThanOrEqual(1)
  expect(restarted.at).toBeLessThanOrEqual(2)
  expect(errors).toEqual([])
})
