import { expect, test } from '@playwright/test'

import { DIFFICULTIES } from '../lib/game/types'

test('the difficulty skull marks the committed choice while another row or Start is hovered', async ({
  page
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await page.getByTestId('new-game').click()
  const selected = page.locator('input[name="difficulty"]:checked')
  const selectedValue = Number(await selected.inputValue())
  const other = DIFFICULTIES.find(({ value }) => value !== selectedValue)!
  await page.getByTestId(`difficulty-${other.value}`).hover()
  await expect(page.getByTestId(`difficulty-${selectedValue}`)).toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('hovered-difficulty.png') })
  await expect(
    page.locator('.console-screen .console-skull:visible')
  ).toHaveCount(1)
  await expect(
    page
      .getByTestId(`difficulty-${selectedValue}`)
      .locator('..')
      .locator('.console-skull')
  ).toBeVisible({ timeout: 1000 })
  const visualStates = await page
    .locator('.console-difficulties')
    .evaluate((list) => {
      const focused = list.querySelector('.console-difficulty:focus-within')!
      const selected = list.querySelector(
        '.console-difficulty[data-selected="true"]'
      )!
      return {
        focusFilter: getComputedStyle(focused.querySelector('canvas')!).filter,
        selectedFilter: getComputedStyle(selected.querySelector('canvas')!)
          .filter,
        focusEdge: getComputedStyle(focused).boxShadow
      }
    })
  expect(visualStates.focusFilter).not.toBe(visualStates.selectedFilter)
  expect(visualStates.focusEdge).not.toBe('none')
  await page.getByTestId('start-game').hover()
  await page.screenshot({ path: testInfo.outputPath('hovered-start.png') })
  await expect(
    page.locator('.console-screen .console-skull:visible')
  ).toHaveCount(1)
  await expect(
    page
      .getByTestId(`difficulty-${selectedValue}`)
      .locator('..')
      .locator('.console-skull')
  ).toBeVisible({ timeout: 1000 })
})

test('difficulty hover and arrow previews do not commit until confirmed', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await page.getByTestId('new-game').click()
  const initial = page.locator('input[name="difficulty"]:checked')
  const initialValue = Number(await initial.inputValue())
  const alternatives = DIFFICULTIES.filter(
    ({ value }) => value !== initialValue
  )
  const hoverValue = alternatives[0]!.value
  const hover = page.getByTestId(`difficulty-${hoverValue}`)

  await hover.hover()
  await expect(hover).toBeFocused()
  await expect(hover).not.toBeChecked()
  await expect(page.getByTestId(`difficulty-${initialValue}`)).toBeChecked()
  const skulls = page.locator('.console-difficulty .console-skull:visible')
  await expect(skulls).toHaveCount(1)
  await expect(hover.locator('..').locator('.console-skull')).toBeHidden()

  await hover.click()
  await expect(hover).toBeChecked()
  await expect(hover.locator('..').locator('.console-skull')).toBeVisible()
  const next =
    DIFFICULTIES[
      (DIFFICULTIES.findIndex(({ value }) => value === hoverValue) + 1) %
        DIFFICULTIES.length
    ]!
  await page.keyboard.press('ArrowDown')
  const nextInput = page.getByTestId(`difficulty-${next.value}`)
  await expect(nextInput).toBeFocused()
  await expect(hover).toBeChecked()
  await expect(nextInput).not.toBeChecked()
  await page.keyboard.press('Space')
  await expect(nextInput).toBeChecked()
  const prior =
    DIFFICULTIES[
      (DIFFICULTIES.findIndex(({ value }) => value === next.value) -
        1 +
        DIFFICULTIES.length) %
        DIFFICULTIES.length
    ]!
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId(`difficulty-${prior.value}`)).toBeFocused()
  await expect(nextInput).toBeChecked()

  // Enter commits this option but stays on difficulty selection. Only the
  // separate Start action may launch the run.
  await page.keyboard.press('Enter')
  await expect(page.locator('.console-screen')).toHaveAttribute(
    'data-menu-page',
    'difficulty'
  )
  await expect(page.getByTestId(`difficulty-${prior.value}`)).toBeChecked()
  await expect(
    page
      .getByTestId(`difficulty-${prior.value}`)
      .locator('..')
      .locator('.console-skull')
  ).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('start-game')).toBeFocused()
  await expect(
    page.locator('.console-screen .console-skull:visible')
  ).toHaveCount(1)
  await expect(
    page
      .getByTestId(`difficulty-${prior.value}`)
      .locator('..')
      .locator('.console-skull')
  ).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  await expect(page).toHaveURL(new RegExp(`[?&]skill=${prior.value}(?:&|$)`))
  await expect(page.getByTestId('game-canvas')).toHaveAttribute(
    'data-difficulty',
    String(prior.value)
  )
  await expect(page.getByTestId('enter-game')).toHaveCount(0)
})

test('the start button uses the clicked difficulty after another option is hovered', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await page.getByTestId('new-game').click()
  const chosen = DIFFICULTIES[0]!
  const preview = DIFFICULTIES[DIFFICULTIES.length - 1]!
  await page.getByTestId(`difficulty-${chosen.value}`).click()
  await page.getByTestId(`difficulty-${preview.value}`).hover()
  await expect(page.getByTestId(`difficulty-${preview.value}`)).toBeFocused()
  await expect(page.getByTestId(`difficulty-${chosen.value}`)).toBeChecked()
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  await expect(page).toHaveURL(new RegExp(`[?&]skill=${chosen.value}(?:&|$)`))
  await expect(page.getByTestId('game-canvas')).toHaveAttribute(
    'data-difficulty',
    String(chosen.value)
  )
})
