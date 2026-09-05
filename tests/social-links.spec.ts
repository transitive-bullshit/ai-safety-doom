import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

const destinations = {
  x: 'https://x.com/transitive_bs',
  github: 'https://github.com/transitive-bullshit/ai-safety-doom'
}

async function checkCorner(
  page: Page,
  screen: 'title' | 'credits',
  testInfo: TestInfo
) {
  const links = page.getByTestId(`${screen}-social-links`)
  const geometry = await links.evaluate((element) => {
    const corner = element.getBoundingClientRect()
    const surface = element.closest('.console-screen,.console-credits')!
    const obstacles = Array.from(
      surface.querySelectorAll(
        '.console-content-stack,.console-tagline,.console-instructions,.console-edition,.credits-reading-hint,.credits-footer [data-credits-action]'
      )
    ).map((other) => {
      const text = document.createRange()
      text.selectNodeContents(other)
      const box = other.matches('.credits-reading-hint')
        ? text.getBoundingClientRect()
        : other.getBoundingClientRect()
      return (
        corner.left < box.right &&
        corner.right > box.left &&
        corner.top < box.bottom &&
        corner.bottom > box.top
      )
    })
    return {
      x: corner.x,
      y: corner.y,
      right: corner.right,
      bottom: corner.bottom,
      width: innerWidth,
      height: innerHeight,
      overlap: obstacles.some(Boolean)
    }
  })
  expect(geometry.x).toBeGreaterThan(geometry.width * 0.75)
  expect(geometry.y).toBeGreaterThan(geometry.height * 0.85)
  expect(geometry.right).toBeLessThan(geometry.width)
  expect(geometry.bottom).toBeLessThan(geometry.height)
  expect(geometry.overlap).toBe(false)

  for (const [id, url] of Object.entries(destinations)) {
    const link = page.getByTestId(`${screen}-social-${id}`)
    await expect(link).toHaveAttribute('href', url)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(link).toHaveAccessibleName(/.+/)
    const hit = await link.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const icon = element.querySelector('svg')!.getBoundingClientRect()
      return { width: box.width, height: box.height, padding: icon.x - box.x }
    })
    expect(hit.width).toBeGreaterThanOrEqual(48)
    expect(hit.height).toBeGreaterThanOrEqual(48)
    expect(hit.padding).toBeGreaterThanOrEqual(10)
  }
  await page.screenshot({ path: testInfo.outputPath(`${screen}-social.png`) })
}

for (const viewport of [
  { width: 1024, height: 720 },
  { width: 1440, height: 900 },
  { width: 1280, height: 600 }
]) {
  test(`social corners fit without covering menus at ${viewport.width}x${viewport.height}`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByTestId('new-game')).toBeFocused()
    await checkCorner(page, 'title', testInfo)
    await page.getByTestId('menu-credits').click()
    await expect(page.getByTestId('credits-crawl')).toHaveAttribute(
      'data-ready',
      'true'
    )
    await page.keyboard.press('Space')
    await checkCorner(page, 'credits', testInfo)
  })
}

test('social links join menu navigation and retain credits playback shortcuts', async ({
  page
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('title-social-github')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('title-social-x')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('title-social-github')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('new-game')).toBeFocused()

  for (const screen of ['title', 'credits'] as const) {
    if (screen === 'credits') {
      await page.getByTestId('menu-credits').click()
      await expect(page.getByTestId('credits-roll')).toBeVisible()
      await page.getByTestId('credits-return').focus()
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('credits-social-x')).toBeFocused()
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('credits-social-github')).toBeFocused()
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('credits-pause')).toBeFocused()
    }
    for (const [id, url] of Object.entries(destinations)) {
      const link = page.getByTestId(`${screen}-social-${id}`)
      await page
        .getByTestId(screen === 'title' ? 'new-game' : 'credits-pause')
        .focus()
      await page.mouse.move(0, 0)
      const resting = await link.evaluate(
        (element) => getComputedStyle(element).color
      )
      await link.hover()
      await expect(link).toBeFocused()
      const highlighted = await link.evaluate(
        (element) => getComputedStyle(element).color
      )
      expect(highlighted).not.toBe(resting)
      if (id === 'github')
        await page.screenshot({
          path: testInfo.outputPath(`${screen}-social-focused.png`)
        })
      if (screen === 'credits') {
        const crawl = page.getByTestId('credits-crawl')
        await expect(crawl).toHaveAttribute('data-paused', 'false')
        const tabs = page.context().pages().length
        await page.keyboard.press('Space')
        await expect(crawl).toHaveAttribute('data-paused', 'true')
        expect(page.context().pages()).toHaveLength(tabs)
        await page.keyboard.press('Space')
        await expect(crawl).toHaveAttribute('data-paused', 'false')
      }

      // Prove padded pointer and Enter activation without contacting social sites.
      await page.context().route(url, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<title>Social destination</title>'
        })
      )
      for (const activate of [
        () => link.click({ position: { x: 5, y: 5 } }),
        () => link.press('Enter')
      ]) {
        const popupPromise = page.waitForEvent('popup')
        await activate()
        const popup = await popupPromise
        await expect(popup).toHaveURL(url)
        await popup.close()
      }
      await page.mouse.move(0, 0)
      await page.keyboard.press('ArrowDown')
    }
  }
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('menu-credits')).toBeFocused()
})

test('social hover and activation schedule the existing menu cues without repeated hover clunks', async ({
  page
}) => {
  await page.addInitScript(() => {
    const observed = window as typeof window & {
      menuCueStarts: { frequency: number; state: AudioContextState }[]
    }
    observed.menuCueStarts = []
    const filters = new WeakMap<AudioBufferSourceNode, BiquadFilterNode>()
    // oxlint-disable-next-line typescript/unbound-method -- Reflect.apply preserves the native receiver.
    const connect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (
      this: AudioNode,
      destination: AudioNode | AudioParam,
      ...args: number[]
    ) {
      if (
        this instanceof AudioBufferSourceNode &&
        destination instanceof BiquadFilterNode
      )
        filters.set(this, destination)
      return Reflect.apply(connect, this, [destination, ...args])
    } as typeof connect
    // oxlint-disable-next-line typescript/unbound-method -- Reflect.apply preserves the native receiver.
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<typeof start>
    ) {
      const filter = filters.get(this)
      // Menu impacts use bandpass noise; the background score uses lowpass.
      if (filter?.type === 'bandpass')
        observed.menuCueStarts.push({
          frequency: filter.frequency.value,
          state: this.context.state
        })
      return Reflect.apply(start, this, args)
    }
  })
  const readCues = () =>
    page.evaluate(() =>
      (
        window as typeof window & {
          menuCueStarts: { frequency: number; state: AudioContextState }[]
        }
      ).menuCueStarts.splice(0)
    )
  await page.goto('/')
  // A click unlocks browser audio, then compare against real menu actions.
  await page.getByTestId('new-game').click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('new-game')).toBeFocused()
  await readCues()
  await page.getByTestId('menu-options').hover()
  const move = await readCues()
  expect(move.length).toBeGreaterThan(0)
  expect(move.every(({ state }) => state === 'running')).toBe(true)
  await page.getByTestId('menu-options').click()
  const confirm = await readCues()
  expect(confirm.length).toBeGreaterThan(0)
  expect(confirm).not.toEqual(move)
  await page.keyboard.press('Escape')

  for (const screen of ['title', 'credits'] as const) {
    if (screen === 'credits') {
      await page.getByTestId('menu-credits').click()
      await expect(page.getByTestId('credits-roll')).toBeVisible()
    }
    for (const [id, url] of Object.entries(destinations)) {
      await page.mouse.move(0, 0)
      await page
        .getByTestId(screen === 'title' ? 'new-game' : 'credits-pause')
        .focus()
      await readCues()
      // Respect the shared menu channel's existing short movement debounce.
      await page.waitForTimeout(70)
      const link = page.getByTestId(`${screen}-social-${id}`)
      await link.hover()
      await expect(link).toBeFocused()
      expect(await readCues()).toEqual(move)
      const box = await link.boundingBox()
      await page.mouse.move(box!.x + 8, box!.y + 8)
      await page.mouse.move(box!.x + 20, box!.y + 20)
      expect(await readCues()).toEqual([])
      await page
        .context()
        .route(url, (route) => route.fulfill({ status: 200, body: '' }))
      const popupPromise = page.waitForEvent('popup')
      await link.click()
      const popup = await popupPromise
      expect(await readCues()).toEqual(confirm)
      await popup.close()
    }
  }
})
