import { expect, test } from '@playwright/test'

type AnalyticsEvent = {
  name: string
  data?: Record<string, string | number | boolean | null>
}

async function captureAnalytics(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const events: unknown[] = []
    Object.assign(window, {
      __gameAnalytics: events,
      va: (command: string, event: unknown) => {
        if (command === 'event') events.push(event)
      }
    })
  })
  await page.route(
    /(?:va\.vercel-scripts\.com\/v1\/script\.debug\.js|\/_vercel\/insights\/script\.js)/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: ''
      })
  )
}

async function events(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __gameAnalytics: AnalyticsEvent[]
        }
      ).__gameAnalytics
  )
}

test('gameplay sends one Vercel lifecycle event for start, death, and replay', async ({
  page
}) => {
  await captureAnalytics(page)
  await page.goto('/')
  await page.getByTestId('new-game').click()
  await page.getByTestId('difficulty-99').check()
  await page.getByTestId('start-game').click()
  const shell = page.getByTestId('game-shell')
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  await expect
    .poll(() => events(page))
    .toEqual([
      {
        name: 'Game Started',
        data: { difficulty: 99, totalRisks: 57 }
      }
    ])

  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.down('w')
  await page.waitForTimeout(450)
  await page.keyboard.up('w')
  await expect(shell).toHaveAttribute('data-phase', 'dead', { timeout: 45_000 })
  await expect
    .poll(async () => (await events(page)).map(({ name }) => name))
    .toEqual(['Game Started', 'Player Died'])
  const death = (await events(page))[1]!
  expect(death.data).toEqual({
    difficulty: 99,
    elapsedSeconds: expect.any(Number),
    risksMitigated: expect.any(Number),
    totalRisks: 57,
    secretsFound: expect.any(Number)
  })
  expect(death.data!.elapsedSeconds).toBeGreaterThan(0)

  await page.getByTestId('restart-game').click()
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  await expect
    .poll(async () => (await events(page)).map(({ name }) => name))
    .toEqual(['Game Started', 'Player Died', 'Game Started'])
})
