import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const canvas = 'canvas[data-testid="game-canvas"]'
const readShots = async (page: Page) =>
  Number(await page.locator(canvas).getAttribute('data-shot'))
const isLocked = (page: Page) =>
  page.evaluate(() => document.pointerLockElement?.tagName === 'CANVAS')

async function begin(page: Page) {
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.getByTestId('difficulty-1').check()
}

async function expectReleased(page: Page) {
  // Allow the next simulation frame to consume the release before sampling.
  await page.waitForTimeout(150)
  const afterRelease = await readShots(page)
  await page.waitForTimeout(850)
  expect(await readShots(page)).toBe(afterRelease)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const events: object[] = []
    Object.defineProperty(window, '__pointerEvents', { value: events })
    const fault = { swallowNextMouseup: false }
    Object.defineProperty(window, '__pointerFault', { value: fault })
    window.addEventListener(
      'mouseup',
      (event) => {
        if (!fault.swallowNextMouseup) return
        fault.swallowNextMouseup = false
        events.push({
          type: 'swallowed-mouseup',
          buttons: event.buttons,
          locked: document.pointerLockElement?.tagName ?? null
        })
        event.stopImmediatePropagation()
      },
      { capture: true }
    )
    for (const type of [
      'mousedown',
      'mouseup',
      'pointerdown',
      'pointerup',
      'pointercancel',
      'mousemove',
      'pointerlockchange',
      'pointerlockerror',
      'blur'
    ]) {
      document.addEventListener(
        type,
        (event) => {
          const mouse = event as MouseEvent
          const target = event.target as HTMLElement | null
          if (
            !type.startsWith('pointerlock') &&
            target?.getAttribute?.('data-testid') !== 'game-canvas'
          )
            return
          events.push({
            type,
            at: Math.round(performance.now()),
            button: mouse.button,
            buttons: mouse.buttons,
            target: target?.tagName,
            testid: target?.getAttribute?.('data-testid'),
            locked: document.pointerLockElement?.tagName ?? null
          })
        },
        true
      )
    }
  })
})

test.afterEach(async ({ page }, testInfo) => {
  const events = await page.evaluate(
    () => (window as unknown as { __pointerEvents: object[] }).__pointerEvents
  )
  await testInfo.attach('pointer-event-sequence', {
    body: JSON.stringify(events, null, 2),
    contentType: 'application/json'
  })
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(JSON.stringify(events))
})

test('capturing on entry and resume does not fire; held mouse fire stops after release', async ({
  page
}) => {
  await begin(page)
  const initialShots = 0
  await page.getByTestId('start-game').click()
  await expect.poll(() => isLocked(page)).toBe(true)
  await expectReleased(page)
  expect(await readShots(page)).toBe(initialShots)

  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await readShots(page)
    await page.mouse.down()
    await expect.poll(() => readShots(page)).toBeGreaterThan(before)
    if (attempt === 0) {
      const whileHeld = await readShots(page)
      const box = await page.locator(canvas).boundingBox()
      expect(box).not.toBeNull()
      await page.mouse.move(
        box!.x + box!.width / 2 + 12,
        box!.y + box!.height / 2
      )
      await expect.poll(() => readShots(page)).toBeGreaterThan(whileHeld)
    }
    await page.mouse.up()
    await expectReleased(page)
  }

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'paused'
  )
  const pausedShots = await readShots(page)
  await page.getByTestId('resume-game').click()
  await expect.poll(() => isLocked(page)).toBe(true)
  await expectReleased(page)
  expect(await readShots(page)).toBe(pausedShots)
  const before = await readShots(page)
  await page.mouse.down()
  await expect.poll(() => readShots(page)).toBeGreaterThan(before)
  await page.mouse.up()
  await expectReleased(page)
})

test('a released capture click does not leave firing latched when initial capture was denied', async ({
  page
}) => {
  await begin(page)
  // Exercise the browser-denied initial capture fallback, then allow the genuine
  // canvas click to request pointer lock using the untouched native browser API.
  await page.evaluate(() => {
    const original = Reflect.get(
      HTMLCanvasElement.prototype,
      'requestPointerLock'
    ) as HTMLCanvasElement['requestPointerLock']
    HTMLCanvasElement.prototype.requestPointerLock = function () {
      HTMLCanvasElement.prototype.requestPointerLock = original
      return Promise.reject(
        new DOMException('Initial capture denied', 'NotAllowedError')
      )
    }
  })
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  expect(await isLocked(page)).toBe(false)
  const box = await page.locator(canvas).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const beforeCapture = await readShots(page)
  await page.mouse.down()
  await expect.poll(() => isLocked(page)).toBe(true)
  await page.waitForTimeout(650)
  expect(await readShots(page)).toBe(beforeCapture)
  await page.mouse.up()
  await expectReleased(page)
})

test('a buttonless mouse move clears firing when capture swallowed the release event', async ({
  page
}) => {
  await begin(page)
  await page.evaluate(() => {
    const original = Reflect.get(
      HTMLCanvasElement.prototype,
      'requestPointerLock'
    ) as HTMLCanvasElement['requestPointerLock']
    HTMLCanvasElement.prototype.requestPointerLock = function () {
      HTMLCanvasElement.prototype.requestPointerLock = original
      return Promise.reject(
        new DOMException('Initial capture denied', 'NotAllowedError')
      )
    }
  })
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  expect(await isLocked(page)).toBe(false)
  const box = await page.locator(canvas).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await expect.poll(() => isLocked(page)).toBe(true)
  await page.mouse.up()
  await expectReleased(page)
  // Fault injection models a release event swallowed during mouse capture. The
  // browser button is genuinely released; the next native movement has buttons=0.
  await page.evaluate(() => {
    const fault = (
      window as unknown as { __pointerFault: { swallowNextMouseup: boolean } }
    ).__pointerFault
    fault.swallowNextMouseup = true
  })
  const before = await readShots(page)
  await page.mouse.down()
  await expect.poll(() => readShots(page)).toBeGreaterThan(before)
  await page.mouse.up()
  await page.mouse.move(box!.x + box!.width / 2 + 3, box!.y + box!.height / 2)
  await expectReleased(page)
})

test('permanently denied pointer capture retains hold-to-fire and release fallback', async ({
  page
}) => {
  await begin(page)
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () =>
      Promise.reject(
        new DOMException('Capture denied by embedding', 'NotAllowedError')
      )
  })
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('game-shell')).toHaveAttribute(
    'data-phase',
    'playing'
  )
  expect(await isLocked(page)).toBe(false)
  const box = await page.locator(canvas).boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const before = await readShots(page)
  await page.mouse.down()
  await expect.poll(() => readShots(page)).toBeGreaterThan(before)
  expect(await isLocked(page)).toBe(false)
  await page.mouse.up()
  await expectReleased(page)
})
