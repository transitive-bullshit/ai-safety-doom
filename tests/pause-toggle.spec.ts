import { expect, test } from '@playwright/test'

for (const capture of ['native', 'denied'] as const)
  test(`Escape toggles pause with ${capture} capture, ignores repeats and respects nested dialogs`, async ({
    page
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    if (capture === 'denied')
      await page.addInitScript(() => {
        HTMLCanvasElement.prototype.requestPointerLock = () =>
          Promise.reject(new DOMException('Capture denied', 'NotAllowedError'))
      })
    await page.goto('/?skill=1')
    await page.getByTestId('new-game').click()
    await page.getByTestId('start-game').click()
    const shell = page.getByTestId('game-shell')
    await expect(shell).toHaveAttribute('data-phase', 'playing')
    const ammo = await page.getByTestId('hud-ammo').textContent()
    await page.keyboard.press('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'paused')
    await page.keyboard.press('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'playing', {
      timeout: 2000
    })
    await page.keyboard.press('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'paused')
    await page.keyboard.down('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'playing')
    await page.keyboard.down('Escape')
    await page.keyboard.up('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'playing')

    await page.keyboard.press('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'paused')
    await page.getByTestId('pause-controls').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(shell).toHaveAttribute('data-phase', 'paused')
    await page.keyboard.press('Escape')
    await expect(shell).toHaveAttribute('data-phase', 'playing')
    await page.waitForTimeout(700)
    await expect(page.getByTestId('hud-ammo')).toHaveText(ammo!)
    expect(errors).toEqual([])
  })
