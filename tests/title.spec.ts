import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

import { DIFFICULTIES } from '../lib/game/types'

const menu = (page: Page) => page.locator('.console-screen')
const shell = (page: Page) => page.getByTestId('game-shell')

async function bitmapReady(page: Page) {
  await expect(page.locator('.console-text').first()).toBeVisible()
  await expect(
    page.locator('.console-text:not([data-ready="true"])')
  ).toHaveCount(0)
  const rendered = await page
    .locator('.console-text canvas,.console-text img')
    .evaluateAll((rasters) =>
      rasters.every((element) => {
        const canvas =
          element instanceof HTMLImageElement
            ? document.createElement('canvas')
            : (element as HTMLCanvasElement)
        if (element instanceof HTMLImageElement) {
          if (!element.complete || !element.naturalWidth) return false
          canvas.width = element.naturalWidth
          canvas.height = element.naturalHeight
          canvas.getContext('2d')!.drawImage(element, 0, 0)
        }
        if (canvas.width <= 0 || canvas.height <= 0) return false
        const pixels = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data
        return pixels.some((value, index) => index % 4 === 3 && value > 0)
      })
    )
  expect(rendered).toBe(true)
}

async function captureLayout(page: Page, testInfo: TestInfo, name: string) {
  if (await page.locator('.console-text').count()) await bitmapReady(page)
  const layout = await page.evaluate(() => {
    const surface =
      document.querySelector<HTMLElement>('dialog[open]') ??
      document.querySelector<HTMLElement>('.console-screen') ??
      document.querySelector<HTMLElement>('.overlay-panel')!
    const outer = surface.getBoundingClientRect()
    const selector =
      surface instanceof HTMLDialogElement
        ? 'h2,.control-row,p,.manual-note,.action-button,.manual-return'
        : surface.matches('.overlay-panel')
          ? '.eyebrow,h2,p,.quick-controls,.console-session-action,.briefing-objective,.prior-note'
          : '.console-logo,.console-subtitle,.console-menu,.console-heading,.console-difficulties,.console-difficulty-description,.console-tagline,.console-instructions,.console-edition'
    const boundary = surface
      .closest('.game-viewport')
      ?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      right: innerWidth,
      bottom: innerHeight
    }
    const boxes = Array.from(
      surface.querySelectorAll<HTMLElement>(selector)
    ).map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        element: element.dataset.testid ?? element.className ?? element.tagName,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        contained:
          rect.left >= outer.left - 1 &&
          rect.right <= outer.right + 1 &&
          rect.top >= outer.top - 1 &&
          rect.bottom <= outer.bottom + 1
      }
    })
    const menuHeader = surface.querySelector('.console-page-header')
    const menuFooter = surface.querySelector('.console-page-footer')
    const menuStack = surface.querySelector('.console-content-stack')
    const menuCenter =
      menuHeader && menuFooter && menuStack
        ? (() => {
            const header = menuHeader.getBoundingClientRect()
            const footer = menuFooter.getBoundingClientRect()
            const content = menuStack.getBoundingClientRect()
            return {
              spaceAbove: content.top - header.bottom,
              spaceBelow: footer.top - content.bottom,
              offset: Math.abs(
                (content.top + content.bottom - header.bottom - footer.top) / 2
              )
            }
          })()
        : null
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight
      },
      surface: {
        x: outer.x,
        y: outer.y,
        width: outer.width,
        height: outer.height,
        clientWidth: surface.clientWidth,
        scrollWidth: surface.scrollWidth,
        clientHeight: surface.clientHeight,
        scrollHeight: surface.scrollHeight
      },
      contained:
        outer.left >= boundary.left - 1 &&
        outer.right <= boundary.right + 1 &&
        outer.top >= boundary.top - 1 &&
        outer.bottom <= boundary.bottom + 1,
      boxes,
      menuCenter
    }
  })
  await testInfo.attach(`${name}-geometry`, {
    body: JSON.stringify(layout, null, 2),
    contentType: 'application/json'
  })
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, { path, contentType: 'image/png' })
  expect(layout.document.width).toBeLessThanOrEqual(layout.viewport.width + 1)
  expect(layout.contained).toBe(true)
  expect(layout.document.height).toBeLessThanOrEqual(layout.viewport.height + 1)
  expect(layout.surface.scrollWidth).toBeLessThanOrEqual(
    layout.surface.clientWidth + 1
  )
  expect(layout.surface.scrollHeight).toBeLessThanOrEqual(
    layout.surface.clientHeight + 1
  )
  expect(layout.boxes.filter((box) => !box.contained)).toEqual([])
  if (layout.menuCenter) {
    expect(layout.menuCenter.spaceAbove).toBeGreaterThanOrEqual(0)
    expect(layout.menuCenter.spaceBelow).toBeGreaterThanOrEqual(0)
    expect(layout.menuCenter.offset).toBeLessThanOrEqual(1)
  }
}

test('menus remain centered between header and footer on a short desktop viewport', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await captureLayout(page, testInfo, 'short-title')
  await page.getByTestId('menu-options').click()
  await expect(menu(page)).toHaveAttribute('data-menu-page', 'options')
  await captureLayout(page, testInfo, 'short-options')
  await page.keyboard.press('Escape')
  await page.getByTestId('new-game').click()
  await expect(menu(page)).toHaveAttribute('data-menu-page', 'difficulty')
  await captureLayout(page, testInfo, 'short-difficulty')
})

for (const viewport of [
  { width: 1024, height: 720 },
  { width: 1440, height: 900 }
]) {
  test(`console menu keyboard journeys and raster layout at ${viewport.width}x${viewport.height}`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    const fonts: { url: string; status: number }[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('response', (response) => {
      if (response.request().resourceType() === 'font')
        fonts.push({ url: response.url(), status: response.status() })
    })
    await page.goto('/')
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'title')
    await expect(page.getByTestId('title-logo')).toBeVisible()
    await expect
      .poll(() =>
        page
          .getByTestId('title-logo')
          .locator('img')
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0
          )
      )
      .toBe(true)
    await bitmapReady(page)
    const font = await page.evaluate(() => {
      const fallback = document.querySelector('.console-text-fallback')!
      const family = getComputedStyle(fallback)
        .fontFamily.split(',')[0]!
        .replace(/["']/g, '')
        .trim()
      const loaded = Array.from(document.fonts).some(
        (face) =>
          face.family.replace(/["']/g, '') === family &&
          face.status === 'loaded'
      )
      return { family, loaded }
    })
    expect(font.loaded).toBe(true)
    expect(
      fonts.every((response) => response.status >= 200 && response.status < 300)
    ).toBe(true)
    await testInfo.attach('loaded-fonts', {
      body: JSON.stringify({ font, resources: fonts }),
      contentType: 'application/json'
    })
    await expect(page.getByTestId('new-game')).toBeFocused()
    await captureLayout(page, testInfo, 'title')

    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('menu-options')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'options')
    await expect(page.getByTestId('menu-mute')).toBeFocused()
    await expect(page.getByTestId('menu-mute')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('menu-mute')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await captureLayout(page, testInfo, 'options')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('menu-fullscreen')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement !== null))
      .toBe(true)
    await page.keyboard.press('Enter')
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true)
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('menu-controls')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await captureLayout(page, testInfo, 'controls')
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'options')
    await expect(page.getByTestId('menu-controls')).toBeFocused()
    await page.locator('.console-instructions button').focus()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('menu-back')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'title')
    await expect(page.getByTestId('new-game')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('title-social-github')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('title-social-x')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('menu-credits')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('credits.png') })
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(page.getByTestId('menu-credits')).toBeFocused()
    await page.getByTestId('new-game').click()
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'difficulty')
    const selected = Number(
      await page.locator('input[name="difficulty"]:checked').inputValue()
    )
    const index = DIFFICULTIES.findIndex(
      (difficulty) => difficulty.value === selected
    )
    const next = DIFFICULTIES[(index + 1) % DIFFICULTIES.length]!
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId(`difficulty-${selected}`)).toBeChecked()
    await expect(page.getByTestId(`difficulty-${next.value}`)).not.toBeChecked()
    await expect(page.getByTestId(`difficulty-${next.value}`)).toBeFocused()
    await captureLayout(page, testInfo, 'difficulty')
    await page.keyboard.press('Enter')
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'difficulty')
    await expect(page.getByTestId(`difficulty-${next.value}`)).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('start-game')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
    await expect(page).toHaveURL(new RegExp(`[?&]skill=${next.value}(?:&|$)`))
    await expect(page.getByTestId('game-canvas')).toHaveAttribute(
      'data-difficulty',
      String(next.value)
    )
    await expect(page.getByTestId('mute')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.getByTestId('enter-game')).toHaveCount(0)
    const ammo = await page.getByTestId('hud-ammo').textContent()
    await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
    await page.waitForTimeout(650)
    await expect(page.getByTestId('hud-ammo')).toHaveText(ammo!)
    const hudLayout = await page.locator('.hud-wrap').evaluate((hud) => {
      const boundary = hud.getBoundingClientRect()
      return Array.from(
        hud.querySelectorAll(
          '.status-number,.status-label,.status-detail,.arsenal-keys,.portrait-frame,.data-cell > div'
        )
      ).every((element) => {
        const box = element.getBoundingClientRect()
        return (
          box.top >= boundary.top &&
          box.bottom <= boundary.bottom &&
          box.left >= boundary.left &&
          box.right <= boundary.right
        )
      })
    })
    expect(hudLayout).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('hud.png') })
    // Pointer capture restores the cursor over a different menu row. Mounting that
    // row must not steal the initial Resume selection without an actual mouse move.
    await page.keyboard.press('Escape')
    await expect(shell(page)).toHaveAttribute('data-phase', 'paused')
    await expect(page.getByTestId('resume-game')).toBeFocused()
    await captureLayout(page, testInfo, 'paused')
    await expect(page.getByTestId('resume-game')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    const controlsAction = page.locator('[data-console-action]').nth(1)
    await expect(controlsAction).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(controlsAction).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('resume-game')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(shell(page)).toHaveAttribute('data-phase', 'playing')
    await expect(page.getByTestId('hud-ammo')).toHaveText(ammo!)
    await page.reload()
    await expect(menu(page)).toHaveAttribute('data-menu-page', 'title')
    await page.getByTestId('new-game').click()
    await expect(page.getByTestId(`difficulty-${next.value}`)).toBeChecked()
    await expect(page.getByTestId('start-game')).toBeVisible()
    expect(errors).toEqual([])
  })
}
