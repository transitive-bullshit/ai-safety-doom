import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test('the first visible menu already contains its final labels before hydration', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let releaseScripts!: () => void
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve
  })
  await page.route('**/*', async (route) => {
    if (
      route.request().resourceType() === 'script' &&
      route.request().url().includes('/_next/')
    )
      await scriptsReady
    await route.continue()
  })
  await page.goto('/', { waitUntil: 'commit' })
  const label = page.getByTestId('new-game').locator('.console-text')
  await expect(label).toHaveAttribute('data-ready', 'true')
  await expect
    .poll(() =>
      label
        .locator('img')
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0
        )
    )
    .toBe(true)
  const before = await label.boundingBox()
  const client = await page.context().newCDPSession(page)
  const first = await client.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(
    testInfo.outputPath('before-hydration.png'),
    Buffer.from(first.data, 'base64')
  )
  await testInfo.attach('before-hydration', {
    body: Buffer.from(first.data, 'base64'),
    contentType: 'image/png'
  })
  releaseScripts()
  await expect(page.getByTestId('new-game')).toBeFocused()
  expect(await label.boundingBox()).toEqual(before)
})

test('cold menu labels keep their final appearance while the web font loads', async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let releaseFont!: () => void
  const fontReady = new Promise<void>((resolve) => {
    releaseFont = resolve
  })
  await page.route('**/fonts/goldman-bold.ttf', async (route) => {
    await fontReady
    await route.continue()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('new-game')).toBeFocused()
  const label = page.getByTestId('new-game').locator('.console-text')
  const before = await label.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      width: box.width,
      height: box.height,
      ready: element.getAttribute('data-ready')
    }
  })
  const client = await page.context().newCDPSession(page)
  const first = await client.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(
    testInfo.outputPath('font-delayed-before.png'),
    Buffer.from(first.data, 'base64')
  )
  await testInfo.attach('font-delayed-before', {
    body: Buffer.from(first.data, 'base64'),
    contentType: 'image/png'
  })
  releaseFont()
  await expect(label).toHaveAttribute('data-ready', 'true')
  const after = await label.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return {
      width: box.width,
      height: box.height,
      ready: element.getAttribute('data-ready')
    }
  })
  const final = await client.send('Page.captureScreenshot', { format: 'png' })
  await writeFile(
    testInfo.outputPath('font-delayed-after.png'),
    Buffer.from(final.data, 'base64')
  )
  await testInfo.attach('font-delayed-after', {
    body: Buffer.from(final.data, 'base64'),
    contentType: 'image/png'
  })
  expect(before).toEqual(after)
})

test('unavailable font promises leave dynamic menu text readable and never bake a fallback font', async ({
  page
}) => {
  await page.addInitScript(() => {
    document.fonts.load = () => Promise.reject(new Error('Font unavailable'))
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByTestId('new-game').click()
  const label = page.locator('.console-heading .console-text')
  await expect(label.locator('.console-text-fallback')).toBeVisible()
  await page.waitForTimeout(150)
  await expect(label).not.toHaveAttribute('data-ready', 'true')
  const hasPixels = await label
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) =>
      canvas
        .getContext('2d')!
        .getImageData(0, 0, canvas.width, canvas.height)
        .data.some((value, index) => index % 4 === 3 && value > 0)
    )
  expect(hasPixels).toBe(false)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('input[name="difficulty"]:checked')).toBeFocused()
  await expect(page.getByTestId('start-game')).toBeVisible()
  expect(errors).toEqual([])
})

test('the browser greeting appears once per page load, including menu navigation', async ({
  page
}) => {
  const greetings: { type: string; lines: number }[] = []
  page.on('console', (message) => {
    if (message.text().includes('https://p-doom.transitivebullsh.it'))
      greetings.push({
        type: message.type(),
        lines: message.text().split('\n').length
      })
  })
  await page.goto('/')
  await expect(page.getByTestId('new-game')).toBeFocused()
  expect(greetings).toHaveLength(1)
  expect(greetings[0]!.type).toBe('info')
  expect(greetings[0]!.lines).toBeGreaterThan(5)
  await page.getByTestId('menu-options').click()
  await page.keyboard.press('Escape')
  await page.getByTestId('menu-credits').click()
  await page.keyboard.press('Escape')
  expect(greetings).toHaveLength(1)
  await page.reload()
  await expect(page.getByTestId('new-game')).toBeFocused()
  expect(greetings).toHaveLength(2)
})
