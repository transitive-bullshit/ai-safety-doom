import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { LEVEL } from '../lib/game/level'
import { DIFFICULTY_SETTINGS } from '../lib/game/model'
import { DIFFICULTIES } from '../lib/game/types'

async function roster(page: Page) {
  return page.getByTestId('game-canvas').evaluate((canvas) => {
    const enemies = JSON.parse(
      (canvas as HTMLCanvasElement).dataset.enemies ?? '[]'
    ) as { id: string; kind: string; health: number }[]
    const counter =
      document.querySelector('[data-testid="hud-kills"]')?.textContent ?? ''
    return { enemies, total: Number(counter.split('/')[1]) }
  })
}

test('difficulty selection builds the intended enemy roster and preserves it on restart', async ({
  page
}, testInfo) => {
  const errors: string[] = []
  const evidence: {
    difficulty: number
    ids: string[]
    count: number
    restartedCount: number
  }[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const baseIds = LEVEL.enemies
    .map((enemy) => enemy.id)
    .sort((a, b) => a.localeCompare(b))
  for (const difficulty of DIFFICULTIES) {
    const expectedCount =
      LEVEL.enemies.length + DIFFICULTY_SETTINGS[difficulty.value].extraEnemies
    const expected = [
      ...LEVEL.enemies,
      ...LEVEL.reinforcements.slice(
        0,
        DIFFICULTY_SETTINGS[difficulty.value].extraEnemies
      )
    ]
    const expectedIds = expected
      .map((enemy) => enemy.id)
      .sort((a, b) => a.localeCompare(b))
    await page.goto('/')
    await expect(page.getByTestId('new-game')).toBeFocused()
    await page.getByTestId('new-game').click()
    await page.getByTestId(`difficulty-${difficulty.value}`).check()
    await page.getByTestId('start-game').click()
    await expect(page.getByTestId('game-shell')).toHaveAttribute(
      'data-phase',
      'playing'
    )
    await expect(page).toHaveURL(
      new RegExp(`[?&]skill=${difficulty.value}(?:&|$)`)
    )
    await expect(page.getByTestId('game-canvas')).toHaveAttribute(
      'data-difficulty',
      String(difficulty.value)
    )
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('game-shell')).toHaveAttribute(
      'data-phase',
      'paused'
    )
    const first = await roster(page)
    const ids = first.enemies
      .map((enemy) => enemy.id)
      .sort((a, b) => a.localeCompare(b))
    expect(ids).toEqual(expectedIds)
    expect(new Set(ids).size).toBe(expectedCount)
    expect(first.enemies.filter((enemy) => enemy.kind === 'sam')).toHaveLength(
      1
    )
    expect(first.total).toBe(expectedCount)
    if (difficulty.value <= 10) expect(ids).toEqual(baseIds)

    await page.getByTestId('restart-game').click()
    await expect(page.getByTestId('game-shell')).toHaveAttribute(
      'data-phase',
      'playing'
    )
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('game-shell')).toHaveAttribute(
      'data-phase',
      'paused'
    )
    const restarted = await roster(page)
    expect(
      restarted.enemies
        .map((enemy) => enemy.id)
        .sort((a, b) => a.localeCompare(b))
    ).toEqual(ids)
    expect(restarted.total).toBe(expectedCount)
    evidence.push({
      difficulty: difficulty.value,
      ids,
      count: first.enemies.length,
      restartedCount: restarted.enemies.length
    })
  }
  await testInfo.attach('difficulty-rosters', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json'
  })
  expect(errors).toEqual([])
})
