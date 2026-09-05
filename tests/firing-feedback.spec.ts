import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

interface FeedbackEvent {
  shot: number
  frame: number
  at: number
}

interface FeedbackTrace {
  shots: FeedbackEvent[]
  poses: FeedbackEvent[]
  flashes: FeedbackEvent[]
  recoils: FeedbackEvent[]
}

async function observeFeedback(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="game-canvas"]'
    )!
    const weapon = document.querySelector<HTMLElement>('.weapon-position')!
    const trace: FeedbackTrace = {
      shots: [],
      poses: [],
      flashes: [],
      recoils: []
    }
    Object.defineProperty(window, '__firingFeedback', { value: trace })
    let frame = 0
    const nextFrame = () => {
      frame++
      requestAnimationFrame(nextFrame)
    }
    requestAnimationFrame(nextFrame)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName !== 'data-shot') continue
        const target = mutation.target as HTMLElement
        const events = target === canvas ? trace.shots : trace.poses
        const shot = Number(target.dataset.shot)
        if (!shot || events.at(-1)?.shot === shot) continue
        events.push({ shot, frame, at: performance.now() })
      }
    })
    observer.observe(canvas, {
      attributes: true,
      attributeFilter: ['data-shot']
    })
    observer.observe(weapon, {
      attributes: true,
      attributeFilter: ['data-shot']
    })
    weapon.addEventListener('animationstart', (event) => {
      const target = event.target as HTMLElement
      const events = target.classList.contains('muzzle-flash')
        ? trace.flashes
        : target.classList.contains('weapon-sprite')
          ? trace.recoils
          : null
      if (events)
        events.push({
          shot: Number(weapon.dataset.shot),
          frame,
          at: performance.now()
        })
    })
  })
}

async function readFeedback(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __firingFeedback: FeedbackTrace })
        .__firingFeedback
  )
}

test('actual shots promptly animate the weapon while the infinite pistol stays infinite', async ({
  page
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?skill=1')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  const shell = page.getByTestId('game-shell')
  const canvas = page.getByTestId('game-canvas')
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  await expect(canvas).toHaveAttribute('data-shot', '0')
  await expect(page.locator('.weapon-position')).toHaveAttribute(
    'data-shot',
    '0'
  )
  await expect(page.locator('.muzzle-flash')).toHaveCount(0)
  await observeFeedback(page)

  await page.keyboard.down('Space')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-shot')))
    .toBeGreaterThanOrEqual(10)
  await page.keyboard.up('Space')
  await page.waitForTimeout(180)
  const trace = await readFeedback(page)
  const tracePath = testInfo.outputPath('shot-to-animation-timing.json')
  await writeFile(tracePath, JSON.stringify(trace, null, 2))
  await testInfo.attach('shot-to-animation-timing', {
    path: tracePath,
    contentType: 'application/json'
  })

  expect(trace.shots.length).toBeGreaterThanOrEqual(10)
  expect(trace.poses.map(({ shot }) => shot)).toEqual(
    trace.shots.map(({ shot }) => shot)
  )
  for (const shot of trace.shots) {
    const pose = trace.poses.find((event) => event.shot === shot.shot)!
    // React may commit on the following frame; the old HUD polling path could
    // leave the audible shot without a matching pose for six display frames.
    expect(pose.frame - shot.frame).toBeLessThanOrEqual(1)
    expect(trace.flashes.some((event) => event.shot === shot.shot)).toBe(true)
    expect(trace.recoils.some((event) => event.shot === shot.shot)).toBe(true)
  }
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute(
    'data-infinite',
    'true'
  )
  await expect(page.getByTestId('hud-ammo')).toHaveAttribute('data-value', '0')

  const releasedShot = await canvas.getAttribute('data-shot')
  await page.waitForTimeout(650)
  await expect(canvas).toHaveAttribute('data-shot', releasedShot!)
  // Pause while the trigger is still down. Resume must require a fresh press.
  await page.keyboard.down('Space')
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-shot')))
    .toBeGreaterThan(Number(releasedShot))
  await page.keyboard.press('Escape')
  await expect(shell).toHaveAttribute('data-phase', 'paused')
  const pausedShot = await canvas.getAttribute('data-shot')
  expect(
    await page
      .locator('.weapon-sprite')
      .evaluate((element) => getComputedStyle(element).animationPlayState)
  ).toBe('paused')
  await page.keyboard.up('Space')
  await page.keyboard.press('Escape')
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  await page.waitForTimeout(650)
  await expect(canvas).toHaveAttribute('data-shot', pausedShot!)
  await expect(page.locator('.weapon-position')).toHaveAttribute(
    'data-shot',
    pausedShot!
  )
  const afterResume = await readFeedback(page)
  expect(new Set(afterResume.flashes.map(({ shot }) => shot)).size).toBe(
    afterResume.flashes.length
  )
  expect(errors).toEqual([])
})
