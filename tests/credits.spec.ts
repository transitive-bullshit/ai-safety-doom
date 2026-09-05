import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

// Headless Chrome hides scrollbars by default; this journey must drag the real one.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

async function openCredits(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await page.getByTestId('menu-credits').click()
  await expect(page.getByTestId('credits-roll')).toBeVisible()
  await expect(page.getByTestId('credits-crawl')).toHaveAttribute(
    'data-ready',
    'true'
  )
  await expect(
    page.locator('.credits-crawl .console-text:not([data-ready="true"])')
  ).toHaveCount(0)
}

const scrollTop = (reading: Locator) =>
  reading.evaluate((element) => element.scrollTop)
const playback = (crawl: Locator) => crawl.getAttribute('data-paused')

for (const viewport of [
  { width: 1024, height: 720 },
  { width: 1440, height: 900 }
]) {
  test(`cinematic credits move, pause and restore focus at ${viewport.width}x${viewport.height}`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openCredits(page)
    const crawl = page.getByTestId('credits-crawl')
    const reading = page.getByTestId('credits-viewport')
    // The first heading enters at the bottom; hover and reading focus do not pause.
    await expect.poll(() => playback(crawl)).toBe('false')
    const opening = await page.locator('.credits-opening').boundingBox()
    const area = await reading.boundingBox()
    expect(opening!.y).toBeGreaterThan(area!.y + area!.height * 0.65)
    expect(opening!.y).toBeLessThan(area!.y + area!.height)
    const before = await scrollTop(reading)
    await expect.poll(() => scrollTop(reading)).toBeGreaterThan(before + 24)
    await page.getByTestId('credits-pause').click()
    await expect(page.getByTestId('credits-pause')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect.poll(() => playback(crawl)).toBe('true')
    const frozen = await scrollTop(reading)
    await page.waitForTimeout(250)
    expect(Math.abs((await scrollTop(reading)) - frozen)).toBeLessThan(0.5)
    await page.getByTestId('credits-replay').click()
    await expect.poll(() => scrollTop(reading)).toBe(0)
    await expect.poll(() => playback(crawl)).toBe('true')
    await page.getByTestId('credits-pause').click()
    await expect.poll(() => playback(crawl)).toBe('false')
    await reading.hover()
    await expect.poll(() => playback(crawl)).toBe('false')
    const hoverBefore = await reading.evaluate((element) => ({
      y: element.scrollTop,
      time: performance.now()
    }))
    await page.waitForTimeout(400)
    const hoverAfter = await reading.evaluate((element) => ({
      y: element.scrollTop,
      time: performance.now()
    }))
    const speed =
      ((hoverAfter.y - hoverBefore.y) * 1000) /
      (hoverAfter.time - hoverBefore.time)
    expect(speed).toBeGreaterThan(55)
    expect(speed).toBeLessThan(95)
    await page.mouse.move(0, 0)
    await expect.poll(() => playback(crawl)).toBe('false')
    await reading.focus()
    await expect.poll(() => playback(crawl)).toBe('false')

    const layout = await page.getByTestId('credits-roll').evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect()
      const fixed = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          '.credits-header,.credits-viewport,.credits-footer,[data-credits-action]'
        )
      ).map((element) => {
        const box = element.getBoundingClientRect()
        return (
          box.top >= bounds.top &&
          box.bottom <= bounds.bottom &&
          box.left >= bounds.left &&
          box.right <= bounds.right
        )
      })
      const reading = dialog.querySelector<HTMLElement>('.credits-viewport')!
      return {
        fixed,
        width: reading.clientWidth,
        scrollWidth: reading.scrollWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth
      }
    })
    expect(layout.fixed.every(Boolean)).toBe(true)
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 1)
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
    await page.screenshot({ path: testInfo.outputPath('credits-roll.png') })
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(page.getByTestId('menu-credits')).toBeFocused()
    expect(errors).toEqual([])
  })
}

test('Space toggles once without activating focused controls; native scrolling interrupts and resumes in place', async ({
  page
}, testInfo) => {
  await openCredits(page)
  const crawl = page.getByTestId('credits-crawl')
  const reading = page.getByTestId('credits-viewport')
  await expect.poll(() => scrollTop(reading)).toBeGreaterThan(20)
  await page.keyboard.press('Space')
  await expect(crawl).toHaveAttribute('data-paused', 'true')
  const frozen = await scrollTop(reading)
  await page.waitForTimeout(200)
  expect(await scrollTop(reading)).toBe(frozen)

  // Space stays a playback command on every footer control, including Return.
  for (const id of ['credits-pause', 'credits-replay', 'credits-return']) {
    await page.getByTestId(id).focus()
    const before = await scrollTop(reading)
    await page.keyboard.down('Space')
    await expect(crawl).toHaveAttribute('data-paused', 'false')
    await page.keyboard.down('Space')
    await page.keyboard.up('Space')
    await expect(crawl).toHaveAttribute('data-paused', 'false')
    await expect.poll(() => scrollTop(reading)).toBeGreaterThan(before + 5)
    await page.keyboard.press('Space')
    await expect(crawl).toHaveAttribute('data-paused', 'true')
    await expect(page.getByTestId('credits-roll')).toBeVisible()
  }

  await reading.focus()
  await page.keyboard.press('Space')
  await reading.hover()
  const beforeWheel = await scrollTop(reading)
  await page.mouse.wheel(0, 350)
  await expect(crawl).toHaveAttribute('data-paused', 'true')
  await expect.poll(() => scrollTop(reading)).toBeGreaterThan(beforeWheel + 250)
  await page.waitForTimeout(200)
  const manual = await scrollTop(reading)
  await page.waitForTimeout(200)
  expect(await scrollTop(reading)).toBe(manual)
  await page.keyboard.press('Space')
  await expect.poll(() => scrollTop(reading)).toBeGreaterThan(manual + 10)
  expect(await scrollTop(reading)).toBeLessThan(manual + 100)

  // Exercise the actual scrollbar track, then drag its thumb upward.
  const bounds = await reading.boundingBox()
  const trackX = bounds!.x + bounds!.width - 5
  await page.mouse.click(trackX, bounds!.y + bounds!.height * 0.65)
  await expect(crawl).toHaveAttribute('data-paused', 'true')
  await expect.poll(() => scrollTop(reading)).toBeGreaterThan(manual + 100)
  await page.waitForTimeout(250)
  const trackPosition = await scrollTop(reading)
  const thumb = await reading.evaluate((element) => ({
    top: (element.scrollTop / element.scrollHeight) * element.clientHeight,
    height: (element.clientHeight / element.scrollHeight) * element.clientHeight
  }))
  await page.mouse.move(trackX, bounds!.y + thumb.top + thumb.height / 2)
  await page.mouse.down()
  await page.mouse.move(trackX, bounds!.y + 10, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => scrollTop(reading)).toBeLessThan(trackPosition - 100)

  await reading.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('End')
  await expect(crawl).toHaveAttribute('data-paused', 'true')
  await expect(page.locator('.credits-ending')).toBeInViewport()
  await page.screenshot({
    path: testInfo.outputPath('credits-manual-scroll.png')
  })
})

test('the padded creator link opens the X profile and keyboard focus reveals it', async ({
  page
}, testInfo) => {
  await openCredits(page)
  const reading = page.getByTestId('credits-viewport')
  const author = page.getByTestId('credits-author')
  await reading.focus()
  await page.keyboard.press('Tab')
  await expect(author).toBeFocused()
  await expect(author).toBeInViewport()
  await expect(page.getByTestId('credits-crawl')).toHaveAttribute(
    'data-paused',
    'true'
  )
  const position = await scrollTop(reading)
  await page.waitForTimeout(200)
  expect(await scrollTop(reading)).toBe(position)
  await expect(author).toHaveAttribute('href', 'https://x.com/transitive_bs')
  await expect(author).toHaveAttribute('target', '_blank')
  await expect(author).toHaveAttribute('rel', 'noopener noreferrer')
  const padding = await author.evaluate((element) => {
    const style = getComputedStyle(element)
    return { x: parseFloat(style.paddingLeft), y: parseFloat(style.paddingTop) }
  })
  expect(padding.x).toBeGreaterThanOrEqual(20)
  expect(padding.y).toBeGreaterThanOrEqual(12)
  await page.screenshot({
    path: testInfo.outputPath('credits-author-link.png')
  })

  // Fulfill locally to prove navigation without depending on X availability.
  await page.context().route('https://x.com/transitive_bs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>Profile</title>'
    })
  )
  for (const activate of [
    () => author.click({ position: { x: padding.x / 2, y: padding.y / 2 } }),
    () => author.press('Enter')
  ]) {
    const popupPromise = page.waitForEvent('popup')
    await activate()
    const popup = await popupPromise
    await expect(popup).toHaveURL('https://x.com/transitive_bs')
    await popup.close()
  }
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('menu-credits')).toBeFocused()
})

test('reduced-motion credits are a static keyboard-scrollable list', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openCredits(page)
  const reading = page.getByTestId('credits-viewport')
  const crawl = page.getByTestId('credits-crawl')
  await expect
    .poll(() =>
      crawl.evaluate((element) => getComputedStyle(element).animationName)
    )
    .toBe('none')
  await expect(page.getByTestId('credits-pause')).toBeDisabled()
  await reading.focus()
  await page.keyboard.press('End')
  await expect
    .poll(() => reading.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)
  await expect(page.locator('.credits-ending')).toBeInViewport()
  await expect(page.getByTestId('credits-return')).toBeInViewport()
  await page.screenshot({
    path: testInfo.outputPath('credits-reduced-motion.png')
  })
  await page.getByTestId('credits-replay').click()
  await expect
    .poll(() => reading.evaluate((element) => element.scrollTop))
    .toBe(0)
  await page.getByTestId('credits-return').click()
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(page.getByTestId('menu-credits')).toBeFocused()
})
