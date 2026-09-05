import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'

import {
  GameAudio,
  loadGameAudioAssets,
  type GameAudioAssets
} from '../lib/game/audio'
import { MenuAudio } from '../lib/game/menu-audio'
import { SHUTDOWN_CHARGE_SECONDS } from '../lib/game/types'
import type { EnemyKind } from '../lib/game/types'
import type { PickupKind } from '../lib/game/level'

class AudioParameter {
  value = 0
  events: { type: string; value: number; time: number }[] = []

  private record(type: string, value: number, time: number) {
    assert.ok(Number.isFinite(value), 'audio automation must be finite')
    this.value = value
    this.events.push({ type, value, time })
  }

  setValueAtTime(value: number, time: number) {
    this.record('set', value, time)
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.record('exponential', value, time)
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.record('linear', value, time)
  }
  setTargetAtTime(value: number, time: number) {
    this.record('target', value, time)
  }
}

class AudioNodeStub {
  connections = new Set<AudioNodeStub>()
  connect(node: AudioNodeStub) {
    this.connections.add(node)
  }
  disconnect() {
    this.connections.clear()
  }
}

class SourceStub extends AudioNodeStub {
  buffer: AudioBuffer | null = null
  playbackRate = Object.assign(new AudioParameter(), { value: 1 })
  frequency = new AudioParameter()
  type = 'square'
  started = 0
  stopped = Infinity
  stopCalls = 0
  onended: (() => void) | null = null
  start(time = 0) {
    this.started = time
  }
  stop(time = 0) {
    this.stopped = time
    this.stopCalls++
  }
}

class FilterStub extends AudioNodeStub {
  frequency = new AudioParameter()
  Q = new AudioParameter()
  type = 'lowpass'
}

class AudioContextStub {
  static instances: AudioContextStub[] = []
  currentTime = 0
  sampleRate = 1000
  destination = new AudioNodeStub()
  state = 'suspended'
  nodes: AudioNodeStub[] = []
  oscillators: SourceStub[] = []
  sources: SourceStub[] = []
  panners: (AudioNodeStub & { pan: AudioParameter })[] = []
  gains: (AudioNodeStub & { gain: AudioParameter })[] = []
  filters: FilterStub[] = []
  compressors: AudioNodeStub[] = []

  constructor() {
    AudioContextStub.instances.push(this)
  }
  private track<T extends AudioNodeStub>(node: T) {
    this.nodes.push(node)
    return node
  }
  createGain() {
    const gain = this.track(
      Object.assign(new AudioNodeStub(), { gain: new AudioParameter() })
    )
    this.gains.push(gain)
    return gain
  }
  createOscillator() {
    const source = this.track(new SourceStub())
    this.oscillators.push(source)
    this.sources.push(source)
    return source
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    const source = this.track(new SourceStub())
    this.sources.push(source)
    return source
  }
  createBiquadFilter() {
    const filter = this.track(new FilterStub())
    this.filters.push(filter)
    return filter
  }
  createWaveShaper() {
    return this.track(
      Object.assign(new AudioNodeStub(), {
        curve: null as Float32Array | null,
        oversample: 'none'
      })
    )
  }
  createStereoPanner() {
    const panner = this.track(
      Object.assign(new AudioNodeStub(), { pan: new AudioParameter() })
    )
    this.panners.push(panner)
    return panner
  }
  createDelay() {
    return this.track(
      Object.assign(new AudioNodeStub(), { delayTime: new AudioParameter() })
    )
  }
  createDynamicsCompressor() {
    const compressor = this.track(
      Object.assign(new AudioNodeStub(), {
        threshold: new AudioParameter(),
        knee: new AudioParameter(),
        ratio: new AudioParameter(),
        attack: new AudioParameter(),
        release: new AudioParameter()
      })
    )
    this.compressors.push(compressor)
    return compressor
  }
  resume() {
    this.state = 'running'
    return Promise.resolve()
  }
  suspend() {
    this.state = 'suspended'
    return Promise.resolve()
  }
  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
}

function setup(
  context: TestContext,
  start = true,
  samples: GameAudioAssets = {}
) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: AudioContextStub
  })
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const audio = new GameAudio(samples)
  context.after(() => {
    audio.dispose()
    if (original) Object.defineProperty(globalThis, 'AudioContext', original)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
  })
  if (start) audio.resume()
  return {
    audio,
    get output() {
      return AudioContextStub.instances.at(-1)!
    }
  }
}

void test('recorded audio preloads with an offline decoder and no live sound context', async (context) => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    'OfflineAudioContext'
  )
  const sample = { duration: 0.87 } as AudioBuffer
  let decoded = 0
  const instances = AudioContextStub.instances.length
  class Decoder {
    async decodeAudioData(data: ArrayBuffer) {
      assert.ok(data.byteLength > 0)
      decoded++
      return sample
    }
  }
  Object.defineProperty(globalThis, 'OfflineAudioContext', {
    configurable: true,
    value: Decoder
  })
  context.after(() => {
    if (original)
      Object.defineProperty(globalThis, 'OfflineAudioContext', original)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  })
  context.mock.method(
    globalThis,
    'fetch',
    async (_url: RequestInfo | URL, options?: RequestInit) => {
      assert.ok(options?.signal instanceof AbortSignal)
      return new Response(new Uint8Array([82, 73, 70, 70]))
    }
  )
  const assets = await loadGameAudioAssets()
  for (const key of [
    'pistol',
    'shotgun',
    'playerPain1',
    'playerPain2',
    'playerDeath',
    ...deathRecordings.map((recording) => recording.key)
  ] as const)
    assert.equal(assets[key], sample)
  assert.equal(decoded, Object.keys(assets).length)
  assert.ok(Object.values(assets).every((buffer) => buffer === sample))
  assert.equal(AudioContextStub.instances.length, instances)
})

void test('audio download and decoding failures retain fallback and do not poison retries', async (context) => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    'OfflineAudioContext'
  )
  const sample = { duration: 0.87 } as AudioBuffer
  let failure: 'network' | 'status' | 'decode' | null = 'network'
  Object.defineProperty(globalThis, 'OfflineAudioContext', {
    configurable: true,
    value: class {
      async decodeAudioData() {
        if (failure === 'decode') throw new Error('Invalid audio')
        return sample
      }
    }
  })
  context.after(() => {
    if (original)
      Object.defineProperty(globalThis, 'OfflineAudioContext', original)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  })
  context.mock.method(globalThis, 'fetch', async () => {
    if (failure === 'network') throw new Error('Download unavailable')
    return new Response(new Uint8Array([1]), {
      status: failure === 'status' ? 404 : 200
    })
  })
  for (failure of ['network', 'status', 'decode'] as const)
    assert.equal((await loadGameAudioAssets()).shotgun, undefined)
  failure = null
  assert.equal((await loadGameAudioAssets()).shotgun, sample)
})

void test('concurrent audio files fail independently and all missing files can retry', async (context) => {
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    'OfflineAudioContext'
  )
  const sample = { duration: 0.43 } as AudioBuffer
  let fail = true
  let inFlight = 0
  let peakConcurrency = 0
  Object.defineProperty(globalThis, 'OfflineAudioContext', {
    configurable: true,
    value: class {
      async decodeAudioData(data: ArrayBuffer) {
        if (fail && new Uint8Array(data)[0] === 2)
          throw new Error('Invalid vocal')
        return sample
      }
    }
  })
  context.after(() => {
    if (original)
      Object.defineProperty(globalThis, 'OfflineAudioContext', original)
    else Reflect.deleteProperty(globalThis, 'OfflineAudioContext')
  })
  context.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => {
    peakConcurrency = Math.max(peakConcurrency, ++inFlight)
    await Promise.resolve()
    inFlight--
    const path =
      typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
    if (fail && /pain-1|system-prompt-pistol/.test(path))
      throw new Error('Missing recording')
    return new Response(
      new Uint8Array([/player-death|doom-demon-death/.test(path) ? 2 : 1]),
      { status: fail && path.includes('pain-2') ? 404 : 200 }
    )
  })
  const partial = await loadGameAudioAssets()
  assert.equal(partial.pistol, undefined)
  assert.equal(partial.shotgun, sample)
  assert.equal(partial.playerPain1, undefined)
  assert.equal(partial.playerPain2, undefined)
  assert.equal(partial.playerDeath, undefined)
  assert.equal(partial.doomDemonDeath, undefined)
  for (const key of [
    'doomImpDeath',
    'doomZombieDeath',
    'doomBaronDeath'
  ] as const)
    assert.equal(partial[key], sample)
  fail = false
  const retried = await loadGameAudioAssets()
  assert.equal(retried.pistol, sample)
  assert.equal(retried.shotgun, sample)
  assert.equal(retried.playerPain1, sample)
  assert.equal(retried.playerPain2, sample)
  assert.equal(retried.playerDeath, sample)
  for (const { key } of deathRecordings) assert.equal(retried[key], sample)
  assert.equal(peakConcurrency, Object.keys(retried).length)
})

void test('the first injury plays a prepared human grunt, alternates variants and rate limits overlap', (context) => {
  const first = { duration: 0.43 } as AudioBuffer
  const second = { duration: 0.465 } as AudioBuffer
  const { audio, output } = setup(context, true, {
    playerPain1: first,
    playerPain2: second
  })
  const start = output.sources.length
  audio.effect('hurt', undefined, { impact: 7 })
  const grunt = output.sources.at(-1)!
  assert.equal(output.sources.length, start + 1)
  assert.equal(grunt.buffer, first)
  assert.equal(grunt.started, 0)
  assert.equal(grunt.stopped, first.duration)
  assert.ok(reaches(grunt, output.destination))
  assert.equal(reaches(grunt, output.destination, output.compressors[0]), false)
  output.currentTime = 0.25
  for (let hit = 0; hit < 30; hit++) audio.effect('hurt')
  assert.equal(output.sources.length, start + 1)
  output.currentTime = 0.5
  audio.effect('hurt')
  assert.equal(output.sources.at(-1)!.buffer, second)
  assert.equal(grunt.connections.size, 0)
  output.currentTime = 1
  audio.effect('hurt')
  assert.equal(output.sources.at(-1)!.buffer, first)
})

void test('fatal damage stops the grunt, plays one complete scream, rejects later world cues and preserves the tail', (context) => {
  const pain = { duration: 0.43 } as AudioBuffer
  const death = { duration: 1.471 } as AudioBuffer
  const { audio, output } = setup(context, true, {
    playerPain1: pain,
    playerDeath: death
  })
  audio.effect('hurt')
  const grunt = output.sources.at(-1)!
  output.currentTime = 0.1
  audio.effect('player-death')
  const scream = output.sources.at(-1)!
  assert.equal(grunt.connections.size, 0)
  assert.equal(grunt.stopCalls, 2)
  assert.equal(scream.buffer, death)
  assert.equal(scream.stopped, output.currentTime + death.duration)
  const count = output.sources.length
  for (const event of [
    'player-death',
    'hurt',
    'impact',
    'enemy',
    'shot',
    'explosion',
    'pickup'
  ])
    audio.effect(event, 1)
  assert.equal(output.sources.length, count)
  audio.finish()
  context.mock.timers.tick(death.duration * 1000)
  assert.equal(output.state, 'running')
  assert.equal(output.sources.length, count)
  context.mock.timers.tick(251)
  assert.equal(output.state, 'suspended')
  audio.dispose()
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('recorded player voices remain muted, freeze on pause, and cannot duplicate across resume', (context) => {
  const sample = { duration: 0.465 } as AudioBuffer
  const { audio, output } = setup(context, true, {
    playerPain2: sample,
    playerDeath: sample
  })
  audio.setMuted(true)
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  audio.effect('hurt')
  assert.equal(output.sources.at(-1)!.buffer, sample)
  assert.equal(master.gain.value, 0)
  const count = output.sources.length
  audio.pause()
  audio.effect('hurt')
  audio.effect('player-death')
  context.mock.timers.tick(3000)
  assert.equal(output.sources.length, count)
  assert.equal(output.state, 'suspended')
  audio.resume()
  audio.effect('hurt')
  assert.equal(output.sources.length, count)
  output.currentTime = 0.6
  audio.effect('hurt')
  assert.equal(output.sources.at(-1)!.buffer, sample)
  assert.equal(output.sources.length, count + 1)
  audio.effect('player-death')
  assert.equal(master.gain.value, 0)
  audio.dispose()
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('missing vocal recordings use bounded throat and breath fallbacks with a distinct fatal tail', (context) => {
  const { audio, output } = setup(context)
  const start = output.sources.length
  audio.effect('hurt')
  const pain = output.sources.slice(start)
  assert.ok(pain.length > 0)
  const painEnd = Math.max(...pain.map((source) => source.stopped))
  const fatalStart = output.sources.length
  audio.effect('player-death')
  const death = output.sources.slice(fatalStart)
  assert.ok(death.length > 0)
  assert.ok(Math.max(...death.map((source) => source.stopped)) > painEnd)
  assert.ok(pain.every((source) => source.connections.size === 0))
  for (const source of death) {
    assert.ok(reaches(source, output.destination))
    assert.equal(
      reaches(source, output.destination, output.compressors[0]),
      false
    )
  }
  const count = output.sources.length
  for (let hit = 0; hit < 150; hit++) audio.effect('player-death')
  assert.equal(output.sources.length, count)
  for (const source of death) source.onended?.()
  assert.ok(death.every((source) => source.connections.size === 0))
})

void test('the first shotgun shot uses its prepared recording; sampled voices remain bounded, pause and dispose', (context) => {
  const sample = { duration: 0.87 } as AudioBuffer
  const { audio, output } = setup(context, true, { shotgun: sample })
  const before = output.sources.length
  audio.effect('shot', 1)
  const shot = output.sources.slice(before)
  assert.equal(shot.length, 1)
  assert.equal(shot[0]!.buffer, sample)
  assert.equal(shot[0]!.started, output.currentTime)
  assert.equal(shot[0]!.stopped, output.currentTime + sample.duration)
  assert.equal(
    reaches(shot[0]!, output.destination, output.compressors[0]),
    false
  )
  assert.ok(reaches(shot[0]!, output.destination))
  for (let i = 0; i < 200; i++) audio.effect('shot', 1)
  assert.ok(
    output.sources.filter(
      (source) => source.buffer === sample && source.connections.size > 0
    ).length <= 64
  )
  audio.pause()
  const pausedCount = output.sources.length
  audio.effect('shot', 1)
  context.mock.timers.tick(2000)
  assert.equal(output.sources.length, pausedCount)
  assert.equal(output.state, 'suspended')
  audio.resume()
  audio.effect('shot', 1)
  assert.equal(output.sources.at(-1)!.buffer, sample)
  audio.dispose()
  assert.equal(output.state, 'closed')
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('the first pistol shot plays its prepared report at native pitch, routes its tail through the compressor and releases its nodes', (context) => {
  const sample = { duration: 0.31 } as AudioBuffer
  const { audio, output } = setup(context, true, { pistol: sample })
  output.currentTime = 2
  const before = output.sources.length
  const beforeNodes = output.nodes.length
  const beforeOscillators = output.oscillators.length
  audio.effect('shot', 0)
  const sources = output.sources.slice(before)
  assert.equal(sources.length, 1)
  const shot = sources[0]!
  assert.equal(shot.buffer, sample)
  assert.equal(shot.playbackRate.value, 1)
  assert.equal(shot.started, output.currentTime)
  assert.equal(shot.stopped, shot.started + sample.duration)
  assert.equal(output.oscillators.length, beforeOscillators)
  assert.ok(reaches(shot, output.destination))
  assert.equal(reaches(shot, output.destination, output.compressors[0]), false)
  shot.onended?.()
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
})

void test('missing pistol audio falls back locally while the shotgun, player voice and monster recordings remain prepared', (context) => {
  const shotgun = { duration: 0.87 } as AudioBuffer
  const pain = { duration: 0.43 } as AudioBuffer
  const death = { duration: 1.471 } as AudioBuffer
  const assets = {
    ...deathAssets(),
    shotgun,
    playerPain1: pain,
    playerDeath: death
  }
  const { audio, output } = setup(context, true, assets)
  const before = output.sources.length
  audio.effect('shot', 0)
  const fallback = output.sources.slice(before)
  assert.ok(fallback.length > 1)
  assert.ok(fallback.some((source) => source.frequency.events.length > 0))
  for (const source of fallback) {
    assert.ok(!Object.values(assets).includes(source.buffer!))
    assert.ok(source.stopped > source.started)
    assert.ok(source.stopped - output.currentTime < 0.35)
    assert.ok(reaches(source, output.destination))
    assert.equal(
      reaches(source, output.destination, output.compressors[0]),
      false
    )
  }
  audio.effect('shot', 1)
  assert.equal(output.sources.at(-1)!.buffer, shotgun)
  for (const { kind, key } of deathRecordings) {
    audio.effect('kill', undefined, { kind })
    assert.equal(output.sources.at(-1)!.buffer, assets[key])
  }
  audio.effect('hurt')
  assert.equal(output.sources.at(-1)!.buffer, pain)
  audio.effect('player-death')
  assert.equal(output.sources.at(-1)!.buffer, death)
})

void test('rapid pistol reports stay bounded, remain muted through pause and resume, and disconnect on disposal', (context) => {
  const sample = { duration: 0.31 } as AudioBuffer
  const { audio, output } = setup(context, true, { pistol: sample })
  const beforeNodes = output.nodes.length
  audio.setMuted(true)
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  for (let shot = 0; shot < 60; shot++) {
    output.currentTime = shot * 0.28
    audio.effect('shot', 0)
    assert.ok(
      output.sources.filter(
        (source) => source.buffer === sample && source.connections.size > 0
      ).length <= 2,
      'the fading tail may overlap only the following pistol report'
    )
  }
  for (let shot = 0; shot < 150; shot++) audio.effect('shot', 0)
  assert.ok(
    output.sources.filter(
      (source) => source.buffer === sample && source.connections.size > 0
    ).length <= 64
  )
  assert.equal(master.gain.value, 0)
  audio.pause()
  const pausedCount = output.sources.length
  audio.effect('shot', 0)
  context.mock.timers.tick(2000)
  assert.equal(output.sources.length, pausedCount)
  assert.equal(output.state, 'suspended')
  audio.resume()
  assert.equal(output.sources.length, pausedCount)
  assert.equal(master.gain.value, 0)
  audio.effect('shot', 0)
  assert.equal(output.sources.length, pausedCount + 1)
  for (const source of output.sources) {
    if (source.buffer === sample) source.onended?.()
  }
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
  audio.dispose()
  assert.equal(output.state, 'closed')
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('plasma has an immediate crack, a held pulse body and a short delayed arc that settles before the next shot', (context) => {
  const { audio, output } = setup(context)
  output.currentTime = 2
  const before = output.sources.length
  const gainStart = output.gains.length
  audio.effect('shot', 2)
  const pulse = output.sources.slice(before)
  assert.ok(pulse.length > 1)
  assert.ok(pulse.some((source) => source.started === output.currentTime))
  assert.ok(
    pulse.some((source) => source.started - output.currentTime >= 0.01),
    'the electrical tail should follow the first impact'
  )
  const heldBody = pulse.find((source) => {
    if (!source.buffer || source.stopped - source.started < 0.06) return false
    const envelope = output.gains
      .slice(gainStart)
      .find((gain) => gain.gain.events.length && reaches(source, gain))
      ?.gain.events
    if (!envelope) return false
    const peak = Math.max(...envelope.map((event) => event.value))
    return envelope.some(
      (event) =>
        event.value >= peak * 0.8 && event.time - source.started >= 0.015
    )
  })
  assert.ok(heldBody, 'rapid fire still needs body beyond the first transient')
  for (const source of pulse) {
    assert.ok(source.stopped > source.started)
    assert.ok(source.stopped - output.currentTime <= 0.115)
    assert.ok(reaches(source, output.destination))
    assert.equal(
      reaches(source, output.destination, output.compressors[0]),
      false
    )
  }
})

void test('sustained plasma releases each previous pulse, bounds pathological overlap, and preserves mute through pause and resume', (context) => {
  const { audio, output } = setup(context)
  const before = output.sources.length
  const beforeNodes = output.nodes.length
  audio.setMuted(true)
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  let previous: SourceStub[] = []
  for (let shot = 0; shot < 80; shot++) {
    output.currentTime = shot * 0.11
    const current = output.sources.length
    audio.effect('shot', 2)
    assert.ok(previous.every((source) => source.connections.size === 0))
    previous = output.sources.slice(current)
  }
  for (let shot = 0; shot < 100; shot++) audio.effect('shot', 2)
  const pulses = output.sources.slice(before)
  assert.ok(pulses.filter((source) => source.connections.size > 0).length <= 64)
  assert.ok(pulses.some((source) => source.stopCalls > 1))
  assert.equal(master.gain.value, 0)
  audio.pause()
  const pausedCount = output.sources.length
  audio.effect('shot', 2)
  context.mock.timers.tick(2000)
  assert.equal(output.state, 'suspended')
  assert.equal(output.sources.length, pausedCount)
  audio.resume()
  assert.equal(output.sources.length, pausedCount)
  assert.equal(master.gain.value, 0)
  for (const source of pulses) source.onended?.()
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
  audio.dispose()
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('pickup categories have distinct pitch, envelope and rhythm, and shutdown has a heavier weapon cue', (context) => {
  const { audio, output } = setup(context)
  const capture = (pickupKind: PickupKind, weapon?: 1 | 3, ammoPool = 0) => {
    const before = output.sources.length
    const gainStart = output.gains.length
    audio.effect('pickup', weapon, { pickupKind, ammoPool })
    const sources = output.sources.slice(before)
    for (const source of sources) {
      assert.ok(reaches(source, output.destination))
      assert.equal(
        reaches(source, output.destination, output.compressors[0]),
        false
      )
    }
    return {
      sources,
      fingerprint: JSON.stringify(
        sources.map((source) => ({
          frequency: source.frequency.events,
          type: source.type,
          started: source.started,
          stopped: source.stopped
        }))
      ),
      attacks: output.gains
        .slice(gainStart)
        .flatMap((gain) => gain.gain.events)
        .filter((event) => event.type === 'linear')
        .map((event) => event.time)
    }
  }
  const health = capture('health')
  const armor = capture('armor')
  const ammo = capture('ammo')
  const weapon = capture('weapon', 1)
  assert.equal(
    new Set([health, armor, ammo, weapon].map((cue) => cue.fingerprint)).size,
    4
  )
  assert.ok(health.attacks.some((attack) => attack > 0.03))
  assert.ok(
    armor.sources
      .filter((source) => source.frequency.events.length)
      .every(
        (source) =>
          source.frequency.events.at(-1)!.value <
          source.frequency.events[0]!.value
      )
  )
  assert.ok(new Set(ammo.sources.map((source) => source.started)).size >= 3)
  assert.notEqual(capture('ammo', undefined, 2).fingerprint, ammo.fingerprint)
  const shutdown = capture('weapon', 3)
  assert.ok(
    Math.max(...shutdown.sources.map((source) => source.stopped)) >
      Math.max(...weapon.sources.map((source) => source.stopped))
  )
  const lowestPitch = (sources: SourceStub[]) =>
    Math.min(
      ...sources
        .filter((source) => source.frequency.events.length)
        .map((source) => source.frequency.events[0]!.value)
    )
  assert.ok(lowestPitch(shutdown.sources) < lowestPitch(weapon.sources))
})

void test('pickup cues respect mute and pause, bound overlapping voices and disconnect after completion', (context) => {
  const { audio, output } = setup(context)
  audio.setMuted(true)
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  const kinds: PickupKind[] = ['health', 'armor', 'ammo', 'weapon']
  const before = output.nodes.length
  const sources = output.sources.length
  for (let i = 0; i < 150; i++)
    audio.effect('pickup', 3, {
      pickupKind: kinds[i % kinds.length]!,
      ammoPool: i % 3
    })
  assert.equal(master.gain.value, 0)
  assert.ok(
    output.sources
      .slice(sources)
      .filter((source) => source.connections.size > 0).length <= 64
  )
  audio.pause()
  const pausedCount = output.sources.length
  for (const pickupKind of kinds) audio.effect('pickup', 1, { pickupKind })
  context.mock.timers.tick(2000)
  assert.equal(output.sources.length, pausedCount)
  for (const source of output.sources.slice(sources)) source.onended?.()
  assert.ok(
    output.nodes.slice(before).every((node) => node.connections.size === 0)
  )
})

const enemyKinds: EnemyKind[] = ['deception', 'sycophant', 'paperclip', 'sam']
const enemyEvents = ['enemy-alert', 'enemy', 'kill'] as const
const deathRecordings = [
  { kind: 'deception', key: 'doomImpDeath', duration: 0.643 },
  { kind: 'sycophant', key: 'doomZombieDeath', duration: 1.173 },
  { kind: 'paperclip', key: 'doomDemonDeath', duration: 1.108 },
  { kind: 'sam', key: 'doomBaronDeath', duration: 1.78 }
] as const

function deathAssets(): GameAudioAssets {
  return Object.fromEntries(
    deathRecordings.map(({ key, duration }) => [
      key,
      { duration } as AudioBuffer
    ])
  )
}

void test('each enemy death plays only its matching recording, at authored pitch and full length', (context) => {
  const assets = deathAssets()
  const { audio, output } = setup(context, true, assets)
  output.currentTime = 2
  for (const { kind, key } of deathRecordings) {
    for (const event of ['enemy-alert', 'enemy'] as const) {
      const before = output.sources.length
      audio.effect(event, undefined, { kind })
      const sources = output.sources.slice(before)
      assert.ok(sources.length > 0)
      assert.ok(
        sources.every(
          (source) => !Object.values(assets).includes(source.buffer!)
        )
      )
    }
    const before = output.sources.length
    const beforeOscillators = output.oscillators.length
    audio.effect('kill', undefined, { kind })
    const sources = output.sources.slice(before)
    assert.equal(sources.length, 1)
    const source = sources[0]!
    assert.equal(source.buffer, assets[key])
    assert.equal(source.playbackRate.value, 1)
    assert.equal(source.started, output.currentTime)
    assert.equal(source.stopped, source.started + assets[key]!.duration)
    assert.equal(output.oscillators.length, beforeOscillators)
    source.onended?.()
    assert.equal(source.connections.size, 0)
  }
})

void test('recorded death cries retain distance, stereo position and compressed reflections', (context) => {
  const { audio, output } = setup(context, true, deathAssets())
  for (const { kind } of deathRecordings) {
    const render = (pan: number, distance: number) => {
      const gainStart = output.gains.length
      const panStart = output.panners.length
      audio.effect('kill', undefined, { kind, pan, distance })
      const source = output.sources.at(-1)!
      assert.ok(reaches(source, output.destination))
      assert.equal(
        reaches(source, output.destination, output.compressors[0]),
        false
      )
      const gain = output.gains
        .slice(gainStart)
        .find((node) => source.connections.has(node))!
      const panner = output.panners[panStart]!
      const reflection = output.gains
        .slice(gainStart)
        .find((node) => panner.connections.has(node) && node !== gain)!
      assert.ok(reflection.gain.value > 0 && reflection.gain.value < 0.25)
      assert.ok(reaches(reflection, output.destination))
      return { gain: gain.gain.value, pan: panner.pan.value }
    }
    const near = render(-4, 0)
    const far = render(4, 60)
    assert.equal(near.pan, -1)
    assert.equal(far.pan, 1)
    assert.ok(far.gain < near.gain / 5)
    const invalid = render(NaN, Infinity)
    assert.equal(invalid.pan, 0)
    assert.equal(invalid.gain, near.gain)
  }
})

void test('a missing enemy recording falls back only for that enemy and keeps prepared player voices', (context) => {
  const assets = deathAssets()
  delete assets.doomDemonDeath
  const pain = { duration: 0.43 } as AudioBuffer
  const death = { duration: 1.471 } as AudioBuffer
  const { audio, output } = setup(context, true, {
    ...assets,
    playerPain1: pain,
    playerDeath: death
  })
  for (const { kind, key } of deathRecordings) {
    const before = output.sources.length
    audio.effect('kill', undefined, { kind })
    const sources = output.sources.slice(before)
    if (assets[key]) {
      assert.equal(sources.length, 1)
      assert.equal(sources[0]!.buffer, assets[key])
    } else {
      assert.ok(sources.length > 1)
      assert.ok(sources.some((source) => source.frequency.events.length > 0))
      assert.ok(
        sources.every(
          (source) => !Object.values(assets).includes(source.buffer!)
        )
      )
    }
  }
  audio.effect('hurt')
  assert.equal(output.sources.at(-1)!.buffer, pain)
  audio.effect('player-death')
  const scream = output.sources.at(-1)!
  assert.equal(scream.buffer, death)
  assert.equal(scream.playbackRate.value, 1)
  assert.equal(scream.stopped, output.currentTime + death.duration)
  const before = output.sources.length
  for (const { kind } of deathRecordings)
    audio.effect('kill', undefined, { kind })
  assert.equal(output.sources.length, before)
})

void test('crowded recorded deaths stay bounded and muted, freeze on pause and release all voice nodes', (context) => {
  const { audio, output } = setup(context, true, deathAssets())
  audio.setMuted(true)
  const before = output.sources.length
  const beforeNodes = output.nodes.length
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  for (let wave = 0; wave < 40; wave++)
    for (const { kind } of deathRecordings)
      audio.effect('kill', undefined, {
        kind,
        distance: wave,
        pan: wave % 2 ? -0.8 : 0.8
      })
  const cries = output.sources.slice(before)
  assert.equal(master.gain.value, 0)
  assert.ok(cries.filter((source) => source.connections.size > 0).length <= 64)
  assert.ok(cries.some((source) => source.stopCalls > 1))
  audio.pause()
  const pausedCount = output.sources.length
  for (const { kind } of deathRecordings)
    audio.effect('kill', undefined, { kind })
  context.mock.timers.tick(3000)
  assert.equal(output.sources.length, pausedCount)
  assert.equal(output.state, 'suspended')
  for (const source of cries) source.onended?.()
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
  audio.resume()
  assert.equal(master.gain.value, 0)
  audio.effect('kill', undefined, { kind: 'sam' })
  assert.equal(output.sources.length, pausedCount + 1)
  audio.dispose()
  assert.equal(output.state, 'closed')
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('every enemy has distinct awareness, attack and death profiles with a consistent material voice', (context) => {
  const { audio, output } = setup(context)
  const profiles = new Set<string>()
  const durations = new Map<string, number>()
  for (const kind of enemyKinds) {
    for (const event of enemyEvents) {
      const before = output.sources.length
      audio.effect(event, undefined, { kind })
      const sources = output.sources.slice(before)
      assert.ok(sources.length > 0)
      for (const source of sources) {
        assert.ok(reaches(source, output.destination))
        assert.equal(
          reaches(source, output.destination, output.compressors[0]),
          false
        )
      }
      const oscillators = sources.filter(
        (source) => source.frequency.events.length > 0
      )
      assert.ok(oscillators.length > 0)
      // Every tonal excitation is rough and filtered, with restrained pitch travel.
      assert.ok(oscillators.every((source) => source.type === 'sawtooth'))
      for (const source of oscillators) {
        const first = source.frequency.events[0]!.value
        const last = source.frequency.events.at(-1)!.value
        assert.ok(last / first >= 0.55 && last / first <= 1.25)
        const throat = [...source.connections][0]!
        assert.ok(
          'Q' in throat,
          'the oscillator must enter a resonant filter, not a raw gain'
        )
      }
      if (kind === 'paperclip')
        assert.ok(sources.filter((source) => source.buffer).length >= 3)
      if (kind === 'sycophant' && event === 'enemy-alert')
        assert.ok(
          new Set(oscillators.map((source) => source.started)).size >= 2
        )
      profiles.add(
        JSON.stringify(
          sources.map((source) => ({
            frequency: source.frequency.events,
            type: source.type,
            started: source.started,
            stopped: source.stopped
          }))
        )
      )
      durations.set(
        `${kind}/${event}`,
        Math.max(...sources.map((source) => source.stopped))
      )
    }
  }
  assert.equal(profiles.size, enemyKinds.length * enemyEvents.length)
  const shutdown = durations.get('sam/kill')!
  assert.ok(
    [...durations].every(
      ([key, duration]) => key === 'sam/kill' || duration < shutdown
    )
  )
})

void test('all enemy lifecycle layers retain bounded pan and distance attenuation', (context) => {
  const { audio, output } = setup(context)
  for (const kind of enemyKinds) {
    for (const event of enemyEvents) {
      const render = (pan: number, distance: number) => {
        const panStart = output.panners.length
        const gainStart = output.gains.length
        audio.effect(event, undefined, { kind, pan, distance })
        return {
          pans: output.panners.slice(panStart),
          peak: Math.max(
            ...output.gains
              .slice(gainStart)
              .flatMap((gain) => gain.gain.events)
              .filter((automation) => automation.type === 'linear')
              .map((automation) => automation.value)
          )
        }
      }
      const near = render(-4, 1)
      const far = render(4, 60)
      assert.ok(near.pans.length > 0)
      assert.ok(near.pans.every((panner) => panner.pan.value === -1))
      assert.ok(far.pans.every((panner) => panner.pan.value === 1))
      assert.ok(far.peak < near.peak / 5)
    }
  }
})

void test('crowded enemy lifecycles stay muted, pause without new sources, and release every voice node', (context) => {
  const { audio, output } = setup(context)
  audio.setMuted(true)
  const before = output.sources.length
  const beforeNodes = output.nodes.length
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  for (let repeat = 0; repeat < 15; repeat++)
    for (const kind of enemyKinds)
      for (const event of enemyEvents)
        audio.effect(event, undefined, {
          kind,
          distance: repeat,
          pan: repeat % 2 ? -0.7 : 0.7
        })
  assert.equal(master.gain.value, 0)
  assert.ok(
    output.sources.slice(before).filter((source) => source.connections.size > 0)
      .length <= 64
  )
  audio.pause()
  const count = output.sources.length
  for (const kind of enemyKinds)
    for (const event of enemyEvents) audio.effect(event, undefined, { kind })
  context.mock.timers.tick(3000)
  assert.equal(output.sources.length, count)
  assert.equal(output.state, 'suspended')
  for (const source of output.sources.slice(before)) source.onended?.()
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
  audio.resume()
  assert.equal(master.gain.value, 0)
  audio.effect('enemy-alert', undefined, { kind: 'sam' })
  audio.dispose()
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

const doorActions = ['open', 'close', 'sealed'] as const

void test('pressure doors release falling air on opening and draw rising air on closing before a separate seal', (context) => {
  const { audio, output } = setup(context)
  const profiles = new Set<string>()
  const capture = (action?: (typeof doorActions)[number]) => {
    const before = output.sources.length
    const gainStart = output.gains.length
    audio.effect('door', undefined, { doorAction: action })
    const sources = output.sources.slice(before)
    const signature = JSON.stringify(
      sources.map((source) => ({
        frequency: source.frequency.events,
        started: source.started,
        stopped: source.stopped,
        filter: output.filters.find((filter) => source.connections.has(filter))
          ?.frequency.events
      }))
    )
    return { sources, signature, gains: output.gains.slice(gainStart) }
  }
  const opening = capture('open')
  assert.equal(capture().signature, opening.signature)
  const closing = capture('close')
  for (const [index, cue] of [opening, closing].entries()) {
    profiles.add(cue.signature)
    const air = cue.sources.find((source) => {
      const filter = output.filters.find((node) => source.connections.has(node))
      return (
        source.buffer &&
        filter?.type === 'bandpass' &&
        source.stopped - source.started >= 0.5
      )
    })!
    assert.ok(air, 'panel travel needs a sustained pressure-air component')
    const filter = output.filters.find((node) => air.connections.has(node))!
    const first = filter.frequency.events[0]!.value
    const last = filter.frequency.events.at(-1)!.value
    assert.ok(index === 0 ? last < first : last > first)
    const envelope = cue.gains.find(
      (gain) => gain.gain.events.length && reaches(air, gain)
    )!.gain.events
    const peak = Math.max(...envelope.map((event) => event.value))
    assert.ok(
      envelope.some(
        (event) => event.value >= peak * 0.8 && event.time - air.started > 0.15
      ),
      'the hiss must hold its body through panel travel'
    )
  }
  const seal = capture('sealed')
  profiles.add(seal.signature)
  assert.equal(profiles.size, doorActions.length)
  assert.ok(
    Math.max(...seal.sources.map((source) => source.stopped)) <
      Math.max(...closing.sources.map((source) => source.stopped))
  )
})

void test('closing audio schedules panel travel only and waits for an explicit sealed event to latch', (context) => {
  const { audio, output } = setup(context)
  output.currentTime = 3
  const before = output.sources.length
  audio.effect('door', undefined, { doorAction: 'close' })
  const travel = output.sources.slice(before)
  assert.ok(travel.length > 0)
  assert.ok(
    travel.every((source) => source.started - output.currentTime < 0.15),
    'closing must not pre-schedule a later latch that can fire after reversal'
  )
  output.currentTime += 2
  const sealStart = output.sources.length
  audio.effect('door', undefined, { doorAction: 'sealed' })
  const seal = output.sources.slice(sealStart)
  assert.ok(seal.length > 0)
  assert.ok(seal.every((source) => source.started >= output.currentTime))
  assert.ok(
    seal.every((source) => source.stopped - output.currentTime < 0.4),
    'the confirmed seal is a short latch and pressure chuff'
  )
})

void test('all pressure door layers retain distance, bounded pan and compressed room reflections', (context) => {
  const { audio, output } = setup(context)
  for (const doorAction of doorActions) {
    const render = (pan: number, distance: number) => {
      const sourceStart = output.sources.length
      const gainStart = output.gains.length
      const panStart = output.panners.length
      audio.effect('door', undefined, { doorAction, pan, distance })
      for (const source of output.sources.slice(sourceStart)) {
        assert.ok(reaches(source, output.destination))
        assert.equal(
          reaches(source, output.destination, output.compressors[0]),
          false
        )
      }
      return {
        pans: output.panners.slice(panStart),
        peaks: output.gains
          .slice(gainStart)
          .filter((gain) => gain.gain.events.length)
          .map((gain) =>
            Math.max(...gain.gain.events.map((event) => event.value))
          )
      }
    }
    const near = render(-4, 0)
    const far = render(4, 60)
    const invalid = render(NaN, Infinity)
    assert.ok(near.pans.length > 0)
    assert.ok(near.pans.every((panner) => panner.pan.value === -1))
    assert.ok(far.pans.every((panner) => panner.pan.value === 1))
    assert.ok(invalid.pans.every((panner) => panner.pan.value === 0))
    assert.equal(far.peaks.length, near.peaks.length)
    assert.ok(far.peaks.every((peak, index) => peak < near.peaks[index]! / 5))
    assert.deepEqual(invalid.peaks, near.peaks)
  }
})

void test('overlapping door phases stay bounded and muted, freeze on pause and release every voice node', (context) => {
  const { audio, output } = setup(context)
  audio.setMuted(true)
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  const before = output.sources.length
  const beforeNodes = output.nodes.length
  for (let cycle = 0; cycle < 40; cycle++)
    for (const doorAction of doorActions)
      audio.effect('door', undefined, { doorAction })
  const sources = output.sources.slice(before)
  assert.equal(master.gain.value, 0)
  assert.ok(
    sources.filter((source) => source.connections.size > 0).length <= 64
  )
  assert.ok(sources.some((source) => source.stopCalls > 1))
  audio.pause()
  const pausedCount = output.sources.length
  for (const doorAction of doorActions)
    audio.effect('door', undefined, { doorAction })
  context.mock.timers.tick(2000)
  assert.equal(output.sources.length, pausedCount)
  assert.equal(output.state, 'suspended')
  for (const source of sources) source.onended?.()
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
  audio.resume()
  assert.equal(master.gain.value, 0)
  audio.effect('door', undefined, { doorAction: 'open' })
  assert.ok(output.sources.length > pausedCount)
  audio.dispose()
  assert.equal(output.state, 'closed')
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

function reaches(
  from: AudioNodeStub,
  target: AudioNodeStub,
  blocked?: AudioNodeStub
) {
  const seen = new Set<AudioNodeStub>()
  const queue = [from]
  while (queue.length) {
    const node = queue.pop()!
    if (node === blocked || seen.has(node)) continue
    if (node === target) return true
    seen.add(node)
    queue.push(...node.connections)
  }
  return false
}

void test('terminal cues decay before suspension, and finishing does not schedule more ambience', (context) => {
  const { audio, output } = setup(context)
  audio.effect('win')
  const lastEnd = Math.max(
    ...output.oscillators
      .filter((osc) => Number.isFinite(osc.stopped))
      .map((osc) => osc.stopped)
  )
  const sounds = output.sources.length
  audio.finish()
  context.mock.timers.tick(lastEnd * 1000)
  assert.equal(output.state, 'running')
  assert.equal(output.sources.length, sounds)
  context.mock.timers.tick(2000)
  assert.equal(output.state, 'suspended')
})

void test('resume cancels terminal suspension; disposal disconnects every live graph node', (context) => {
  const { audio, output } = setup(context)
  audio.effect('shot', 1)
  audio.finish()
  context.mock.timers.tick(100)
  audio.resume()
  context.mock.timers.tick(2000)
  assert.equal(output.state, 'running')
  audio.finish()
  audio.dispose()
  context.mock.timers.tick(2000)
  assert.equal(output.state, 'closed')
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
  assert.ok(output.sources.every((source) => source.stopCalls > 0))
})

void test('shutdown has a sustained rising charge and a separate low descending launch', (context) => {
  const { audio, output } = setup(context)
  const before = output.oscillators.length
  const gainStart = output.gains.length
  audio.effect('charge', 3)
  const charges = output.oscillators.slice(before)
  assert.ok(
    charges.some(
      (osc) =>
        osc.frequency.events.at(-1)!.value > osc.frequency.events[0]!.value &&
        osc.stopped - osc.started >= SHUTDOWN_CHARGE_SECONDS
    )
  )
  assert.ok(
    charges.some((source) => {
      const envelope = output.gains
        .slice(gainStart)
        .find((gain) => gain.gain.events.length && reaches(source, gain))
        ?.gain.events
      if (!envelope) return false
      const peak = Math.max(...envelope.map((event) => event.value))
      return envelope.some(
        (event) =>
          event.value >= peak * 0.8 &&
          event.time - source.started >= SHUTDOWN_CHARGE_SECONDS * 0.9
      )
    }),
    'the rising charge must stay audible through the end of the windup'
  )
  const launchStart = output.oscillators.length
  audio.effect('shot', 3)
  assert.ok(
    output.oscillators
      .slice(launchStart)
      .some(
        (osc) =>
          osc.frequency.events.at(-1)!.value < osc.frequency.events[0]!.value
      )
  )
})

void test('shutdown discharge holds its blast body before decaying and sends every impact and delayed arc through the shared compressor', (context) => {
  const report = { duration: 0.31 } as AudioBuffer
  const { audio, output } = setup(context, true, { pistol: report })
  output.currentTime = 2
  const before = output.sources.length
  const gainStart = output.gains.length
  audio.effect('shot', 3)
  const launch = output.sources.slice(before)
  const recordedImpact = launch.find((source) => source.buffer === report)!
  assert.ok(recordedImpact)
  assert.ok(recordedImpact.playbackRate.value < 1)
  assert.ok(recordedImpact.playbackRate.value > 0)
  assert.equal(
    recordedImpact.stopped,
    recordedImpact.started + report.duration / recordedImpact.playbackRate.value
  )
  assert.ok(launch.length > 1)
  assert.ok(launch.some((source) => source.started === output.currentTime))
  assert.ok(
    launch.some((source) => source.started - output.currentTime >= 0.1),
    'electrical aftershocks should follow the initial impact'
  )
  const longBody = launch.find((source) => {
    if (!source.buffer || source.stopped - source.started < 0.7) return false
    const envelope = output.gains
      .slice(gainStart)
      .find((gain) => gain.gain.events.length && reaches(source, gain))
      ?.gain.events
    if (!envelope) return false
    const peak = Math.max(...envelope.map((event) => event.value))
    return envelope.some(
      (event) => event.value >= peak * 0.8 && event.time - source.started >= 0.1
    )
  })
  assert.ok(longBody, 'the discharge must retain weight beyond its first crack')
  for (const source of launch) {
    assert.ok(reaches(source, output.destination))
    assert.equal(
      reaches(source, output.destination, output.compressors[0]),
      false
    )
    assert.ok(source.stopped > source.started)
    assert.ok(source.stopped - output.currentTime < 1.65)
  }
  output.currentTime += 1.65
  audio.effect('shot', 3)
  assert.ok(launch.every((source) => source.connections.size === 0))
})

void test('overlapping shutdown discharges stay bounded and muted, freeze on pause, and release their saturation and reflection nodes', (context) => {
  const { audio, output } = setup(context)
  const before = output.sources.length
  const beforeNodes = output.nodes.length
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  audio.setMuted(true)
  for (let shot = 0; shot < 40; shot++) audio.effect('shot', 3)
  const sources = output.sources.slice(before)
  assert.equal(master.gain.value, 0)
  assert.ok(
    sources.filter((source) => source.connections.size > 0).length <= 64
  )
  assert.ok(sources.some((source) => source.stopCalls > 1))
  audio.pause()
  const pausedCount = output.sources.length
  audio.effect('shot', 3)
  context.mock.timers.tick(2000)
  assert.equal(output.sources.length, pausedCount)
  assert.equal(output.state, 'suspended')
  audio.resume()
  assert.equal(output.sources.length, pausedCount)
  assert.equal(master.gain.value, 0)
  for (const source of sources) source.onended?.()
  assert.ok(
    output.nodes.slice(beforeNodes).every((node) => node.connections.size === 0)
  )
  audio.dispose()
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
})

void test('world sounds use bounded stereo pan and distance attenuation, while shots stay centered', (context) => {
  const { audio, output } = setup(context)
  const firstGain = output.gains.length
  const firstPan = output.panners.length
  audio.effect('enemy', undefined, {
    pan: -0.8,
    distance: 2,
    kind: 'paperclip'
  })
  const near = output.gains
    .slice(firstGain)
    .flatMap((gain) => gain.gain.events)
    .filter((event) => event.type === 'linear')
    .map((event) => event.value)
  assert.ok(
    output.panners.slice(firstPan).every((panner) => panner.pan.value < 0)
  )
  const farGain = output.gains.length
  const farPan = output.panners.length
  audio.effect('enemy', undefined, { pan: 5, distance: 35, kind: 'paperclip' })
  const far = output.gains
    .slice(farGain)
    .flatMap((gain) => gain.gain.events)
    .filter((event) => event.type === 'linear')
    .map((event) => event.value)
  assert.ok(Math.max(...far) < Math.max(...near) / 2)
  assert.ok(
    output.panners.slice(farPan).every((panner) => panner.pan.value === 1)
  )
  audio.effect('shot', 2, { pan: -1, distance: 100 })
  assert.equal(output.panners.at(-1)!.pan.value, 0)
  audio.effect('explosion', undefined, {
    pan: NaN,
    distance: Infinity,
    strength: NaN
  })
  assert.equal(output.panners.at(-1)!.pan.value, 0)
})

void test('all audible paths cross the headroom compressor, even reflections', (context) => {
  const { audio, output } = setup(context)
  audio.effect('explosion', undefined, { strength: 2 })
  audio.effect('shot', 1)
  audio.effect('shot', 2)
  const compressor = output.compressors[0]!
  for (const source of output.sources) {
    assert.ok(reaches(source, output.destination))
    assert.equal(reaches(source, output.destination, compressor), false)
  }
})

void test('rapid overlapping effects keep bounded live sources and ended voices disconnect', (context) => {
  const { audio, output } = setup(context)
  const bedCount = output.sources.length
  const bedNodes = output.nodes.length
  for (let i = 0; i < 250; i++) audio.effect('shot', i % 2 === 0 ? 1 : 2)
  assert.ok(
    output.sources.filter((source) => source.connections.size > 0).length < 100
  )
  for (const source of output.sources.slice(bedCount)) source.onended?.()
  assert.equal(
    output.sources.filter((source) => source.connections.size > 0).length,
    bedCount
  )
  assert.ok(
    output.nodes.slice(bedNodes).every((node) => node.connections.size === 0),
    'ending or stealing a voice must also release its filters and distortion'
  )
})

void test('pause freezes delayed cues and ambience schedules without creating duplicate beds', (context) => {
  const { audio, output } = setup(context)
  audio.effect('shot', 1)
  const pumpTimes = output.sources.map((source) => source.started)
  const sounds = output.sources.length
  audio.pause()
  audio.effect('shot', 2)
  context.mock.timers.tick(10000)
  assert.equal(output.sources.length, sounds)
  assert.equal(output.state, 'suspended')
  audio.resume()
  context.mock.timers.tick(100)
  assert.deepEqual(
    output.sources.map((source) => source.started),
    pumpTimes
  )
  assert.equal(output.state, 'running')
})

void test('sector changes crossfade existing beds; repeated sector updates allocate nothing', (context) => {
  const { audio, output } = setup(context)
  const hum = output.oscillators[0]!
  const indoor = hum.frequency.value
  const nodeCount = output.nodes.length
  audio.setEnvironment('computer', false)
  const server = hum.frequency.value
  audio.setEnvironment('court', true)
  const outdoor = hum.frequency.value
  assert.notEqual(indoor, server)
  assert.notEqual(server, outdoor)
  const automationCount = hum.frequency.events.length
  for (let i = 0; i < 60; i++) audio.setEnvironment('court', true)
  assert.equal(output.nodes.length, nodeCount)
  assert.equal(hum.frequency.events.length, automationCount)
})

void test('preselected mute applies on first graph creation and stays through resume', (context) => {
  const state = setup(context, false)
  state.audio.setMuted(true)
  state.audio.resume()
  const master = state.output.gains.find((gain) =>
    gain.connections.has(state.output.destination)
  )!
  assert.equal(master.gain.value, 0)
  state.audio.pause()
  state.audio.resume()
  assert.equal(master.gain.value, 0)
  state.audio.setMuted(false)
  assert.ok(master.gain.value > 0 && master.gain.value < 1)
})

function setupMenu(context: TestContext) {
  const originalAudio = Object.getOwnPropertyDescriptor(
    globalThis,
    'AudioContext'
  )
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document'
  )
  const document = Object.assign(new EventTarget(), { hidden: false })
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: AudioContextStub
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: document
  })
  context.mock.timers.enable({ apis: ['setInterval'] })
  const audio = new MenuAudio()
  context.after(() => {
    audio.dispose()
    if (originalAudio)
      Object.defineProperty(globalThis, 'AudioContext', originalAudio)
    else Reflect.deleteProperty(globalThis, 'AudioContext')
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  return {
    audio,
    document,
    get output() {
      return AudioContextStub.instances.at(-1)!
    }
  }
}

void test('menu audio waits for a gesture, preserves preselected mute and compresses every strike', (context) => {
  const before = AudioContextStub.instances.length
  const state = setupMenu(context)
  state.audio.setMuted(true)
  state.audio.setActive(false)
  state.audio.cue('move')
  state.audio.setActive(true)
  context.mock.timers.tick(5000)
  assert.equal(AudioContextStub.instances.length, before)
  state.audio.cue('confirm')
  const output = state.output
  const master = output.gains.find((gain) =>
    gain.connections.has(output.destination)
  )!
  assert.equal(output.state, 'running')
  assert.equal(master.gain.value, 0)
  assert.ok(
    output.sources.some(
      (source) =>
        source.frequency.events.at(-1)?.value !==
        source.frequency.events[0]?.value
    )
  )
  for (const source of output.sources) {
    assert.ok(reaches(source, output.destination))
    assert.equal(
      reaches(source, output.destination, output.compressors[0]),
      false
    )
  }
  state.audio.setMuted(false)
  assert.ok(master.gain.value > 0 && master.gain.value < 1)
})

void test('menu music suspends for gameplay and hidden tabs; returning never starts another graph', (context) => {
  const state = setupMenu(context)
  state.audio.cue('move')
  const output = state.output
  const instances = AudioContextStub.instances.length
  const initial = output.sources.length
  output.currentTime = 0.3
  context.mock.timers.tick(80)
  assert.ok(
    output.sources.length > initial,
    'the musical motif begins after the menu strike'
  )
  state.audio.setActive(false)
  const paused = output.sources.length
  context.mock.timers.tick(5000)
  assert.equal(output.sources.length, paused)
  assert.equal(output.state, 'suspended')
  state.document.hidden = true
  state.audio.setActive(true)
  assert.equal(output.state, 'suspended')
  state.document.hidden = false
  state.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(output.state, 'running')
  assert.equal(AudioContextStub.instances.length, instances)
  state.document.hidden = true
  state.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(output.state, 'suspended')
  state.audio.dispose()
  state.document.hidden = false
  state.document.dispatchEvent(new Event('visibilitychange'))
  context.mock.timers.tick(5000)
  assert.equal(output.state, 'closed')
  assert.ok(output.nodes.every((node) => node.connections.size === 0))
  assert.ok(output.sources.every((source) => source.stopCalls > 0))
})

void test('throttled music skips missed beats and rapid menu switches keep a bounded voice pool', (context) => {
  const { audio, output } = (() => {
    const state = setupMenu(context)
    state.audio.cue('move')
    return state
  })()
  output.currentTime = 3600
  const before = output.sources.length
  context.mock.timers.tick(80)
  const resumed = output.sources.slice(before)
  assert.ok(resumed.length > 0 && resumed.length < 15)
  assert.ok(resumed.every((source) => source.started >= output.currentTime))
  for (let i = 0; i < 100; i++) {
    output.currentTime += 0.06
    audio.cue(i % 2 === 0 ? 'confirm' : 'back')
    context.mock.timers.tick(80)
  }
  assert.ok(
    output.sources.filter((source) => source.connections.size > 0).length <= 60
  )
  for (const source of output.sources) source.onended?.()
  assert.ok(output.sources.every((source) => source.connections.size === 0))
})
