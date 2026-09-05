import { expect, test } from '@playwright/test'

test('cold menu labels keep their final appearance while the web font loads', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let releaseFont!: () => void
  const fontReady = new Promise<void>((resolve) => { releaseFont = resolve })
  await page.route('**/fonts/goldman-bold.ttf', async (route) => {
    await fontReady
    await route.continue()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('new-game')).toBeFocused()
  const label = page.getByTestId('new-game').locator('.console-text')
  const before = await label.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, ready: element.getAttribute('data-ready') }
  })
  const client = await page.context().newCDPSession(page)
  const first = await client.send('Page.captureScreenshot', { format: 'png' })
  await testInfo.attach('font-delayed-before', { body: Buffer.from(first.data, 'base64'), contentType: 'image/png' })
  releaseFont()
  await expect(label).toHaveAttribute('data-ready', 'true')
  const after = await label.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return { width: box.width, height: box.height, ready: element.getAttribute('data-ready') }
  })
  const final = await client.send('Page.captureScreenshot', { format: 'png' })
  await testInfo.attach('font-delayed-after', { body: Buffer.from(final.data, 'base64'), contentType: 'image/png' })
  expect(before).toEqual(after)
})
