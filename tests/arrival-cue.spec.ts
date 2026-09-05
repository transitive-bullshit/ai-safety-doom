import { expect, test } from '@playwright/test'

test('one nearby monster vocal follows active entry, respects pause, and resets on retry', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    const encoded = new WeakSet<ArrayBuffer>()
    const decoded = new WeakSet<AudioBuffer>()
    const plays: { duration: number; rate: number; state: string }[] = []
    Object.assign(window, { __arrivalGrowls: plays })
    const fetchAudio = window.fetch
    window.fetch = async (...args) => {
      const response = await fetchAudio(...args)
      if (new URL(response.url).pathname === '/game/audio/monster-growl.wav') {
        const read = response.arrayBuffer.bind(response)
        response.arrayBuffer = async () => {
          const data = await read()
          encoded.add(data)
          return data
        }
      }
      return response
    }
    // oxlint-disable-next-line typescript/unbound-method -- The wrapper restores the receiver with call.
    const decode = OfflineAudioContext.prototype.decodeAudioData
    OfflineAudioContext.prototype.decodeAudioData = async function (data) {
      const isGrowl = encoded.has(data)
      const buffer = await decode.call(this, data)
      if (isGrowl) decoded.add(buffer)
      return buffer
    }
    // oxlint-disable-next-line typescript/unbound-method -- The wrapper restores the receiver with apply.
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer && decoded.has(this.buffer))
        plays.push({
          duration: this.buffer.duration,
          rate: this.playbackRate.value,
          state: this.context.state
        })
      return start.apply(this, args)
    }
  })
  const growls = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __arrivalGrowls: { duration: number; rate: number; state: string }[]
          }
        ).__arrivalGrowls
    )
  await page.route('**/_vercel/insights/script.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: ''
    })
  )
  await page.goto('/?skill=1')
  await page.getByTestId('new-game').click()
  await page.getByTestId('start-game').click()
  const shell = page.getByTestId('game-shell')
  const canvas = page.getByTestId('game-canvas')
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  await page.keyboard.press('Escape')
  await expect(shell).toHaveAttribute('data-phase', 'paused')
  expect(await canvas.getAttribute('data-arrival-cue')).toBeNull()
  expect(await growls()).toHaveLength(0)
  const enemies = JSON.parse((await canvas.getAttribute('data-enemies'))!) as {
    kind: string
  }[]
  await page.waitForTimeout(1900)
  expect(await canvas.getAttribute('data-arrival-cue')).toBeNull()
  await page.keyboard.press('Escape')
  await expect(canvas).toHaveAttribute('data-arrival-cue', /.+/)
  const first = (await canvas.getAttribute('data-arrival-cue'))!
  const cue = JSON.parse(first) as { kind: string; at: number }
  expect(enemies.some((enemy) => enemy.kind === cue.kind)).toBe(true)
  expect(cue.kind).not.toBe('sam')
  expect(cue.at).toBeGreaterThanOrEqual(1)
  expect(cue.at).toBeLessThanOrEqual(2)
  const played = await growls()
  expect(played).toHaveLength(1)
  expect(played[0]!.duration).toBeGreaterThan(1)
  expect(played[0]!.rate).toBe(1)
  expect(played[0]!.state).toBe('running')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1900)
  expect(await canvas.getAttribute('data-arrival-cue')).toBe(first)
  expect(await growls()).toHaveLength(1)
  await page.keyboard.press('Escape')
  await page.getByTestId('restart-game').click()
  await expect(shell).toHaveAttribute('data-phase', 'playing')
  expect(await canvas.getAttribute('data-arrival-cue')).toBeNull()
  await expect(canvas).toHaveAttribute('data-arrival-cue', /.+/)
  const restarted = JSON.parse(
    (await canvas.getAttribute('data-arrival-cue'))!
  ) as { at: number }
  expect(restarted.at).toBeGreaterThanOrEqual(1)
  expect(restarted.at).toBeLessThanOrEqual(2)
  expect(await growls()).toHaveLength(2)
  expect(errors).toEqual([])
})
