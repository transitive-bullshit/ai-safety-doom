import { SHUTDOWN_CHARGE_SECONDS, type EnemyKind, type WeaponId } from './types'
import { TrainingScore } from './menu-audio'
import type { PickupKind } from './level'

export interface AudioDetail {
  impact?: number
  distance?: number
  pan?: number
  kind?: EnemyKind
  pickupKind?: PickupKind
  ammoPool?: number
  strength?: number
  source?: 'barrel' | 'shutdown' | 'rocket'
  surface?: 'wall' | 'enemy' | 'barrel' | 'player'
  doorAction?: 'open' | 'close' | 'sealed'
}

export interface GameAudioAssets {
  pistol?: AudioBuffer
  shotgun?: AudioBuffer
  plasma?: AudioBuffer
  plasmaIdle?: AudioBuffer
  monsterGrowl?: AudioBuffer
  playerPain1?: AudioBuffer
  playerPain2?: AudioBuffer
  playerDeath?: AudioBuffer
  doomImpDeath?: AudioBuffer
  doomZombieDeath?: AudioBuffer
  doomDemonDeath?: AudioBuffer
  doomBaronDeath?: AudioBuffer
}

/** Decode in parallel without a live output context; each missing file falls back independently. */
export async function loadGameAudioAssets(): Promise<GameAudioAssets> {
  const assets: GameAudioAssets = {}
  const files = {
    pistol: 'system-prompt-pistol',
    shotgun: 'rlhf-shotgun',
    plasma: 'doom-plasma',
    plasmaIdle: 'doom-plasma-idle',
    monsterGrowl: 'monster-growl',
    playerPain1: 'player-pain-1',
    playerPain2: 'player-pain-2',
    playerDeath: 'player-death',
    doomImpDeath: 'doom-imp-death',
    doomZombieDeath: 'doom-zombie-death',
    doomDemonDeath: 'doom-demon-death',
    doomBaronDeath: 'doom-baron-death'
  } as const
  await Promise.all(
    (Object.keys(files) as (keyof typeof files)[]).map(async (key) => {
      try {
        const response = await fetch(`/game/audio/${files[key]}.wav`, {
          signal: AbortSignal.timeout(3500)
        })
        if (!response.ok) return
        const data = await response.arrayBuffer()
        const decoder = new OfflineAudioContext(1, 1, 44100)
        assets[key] = await decoder.decodeAudioData(data)
      } catch {
        // One unavailable recording must not discard the other prepared sounds.
      }
    })
  )
  return assets
}

type Voice = {
  source: AudioScheduledSourceNode
  nodes: AudioNode[]
  end: number
}
type Sound = {
  pan?: number
  level?: number
  wet?: number
  ambient?: boolean
  attack?: number
  hold?: number
  filterEnd?: number
  rough?: boolean
}
type EnemyCue = 'alert' | 'attack' | 'death'
const finite = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) ? value : fallback
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value))
const shotgunSaturation = Float32Array.from(
  { length: 1025 },
  (_, index) => Math.tanh((index / 512 - 1) * 3.4) / Math.tanh(3.4)
)

const industrialSaturation = Float32Array.from(
  { length: 1025 },
  (_, index) => Math.tanh((index / 512 - 1) * 2.2) / Math.tanh(2.2)
)

// Synthesized machinery, short room reflections and sparse, unmetered accents.
// Suspending audio time freezes envelopes, reflections and weapon pump timings.
export class GameAudio {
  private context: AudioContext | undefined
  private master: GainNode | undefined
  private dry: GainNode | undefined
  private ambience: GainNode | undefined
  private room: GainNode | undefined
  private hum: OscillatorNode | undefined
  private humBeat: OscillatorNode | undefined
  private humGain: GainNode | undefined
  private airGain: GainNode | undefined
  private airFilter: BiquadFilterNode | undefined
  private graph: AudioNode[] = []
  private beds: AudioScheduledSourceNode[] = []
  private voices = new Set<Voice>()
  private timer: ReturnType<typeof setInterval> | undefined
  private finishTimer: ReturnType<typeof setTimeout> | undefined
  private nextAccent = 0
  private seed = 7919
  private sector = 'staging'
  private sky = false
  private muted = false
  private active = false
  private noise: AudioBuffer | undefined
  private weapon: WeaponId = 0
  private plasmaIdleGain: GainNode | undefined
  private score: TrainingScore | undefined
  private painVoices: Voice[] = []
  private nextPainAt = 0
  private painVariant = 0
  private playerDead = false
  private shuttingDown = false

  constructor(private samples: GameAudioAssets = {}) {}

  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0
    return (this.seed >>> 0) / 4294967296
  }

  private initialize() {
    const ctx = new AudioContext()
    this.context = ctx
    const master = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()
    const dry = ctx.createGain()
    const ambience = ctx.createGain()
    const room = ctx.createGain()
    master.gain.value = this.muted ? 0 : 0.72
    dry.gain.value = 0.72
    ambience.gain.value = 0.26
    compressor.threshold.value = -13
    compressor.knee.value = 15
    compressor.ratio.value = 5
    compressor.attack.value = 0.004
    compressor.release.value = 0.17
    dry.connect(compressor)
    ambience.connect(compressor)
    compressor.connect(master)
    master.connect(ctx.destination)
    this.master = master
    this.dry = dry
    this.ambience = ambience
    this.room = room
    this.graph.push(master, compressor, dry, ambience, room)

    // Damped early reflections keep the dry transients of rapid fire readable.
    for (const [delayTime, pan] of [
      [0.053, -0.7],
      [0.089, 0.7]
    ]) {
      const delay = ctx.createDelay(0.3)
      const filter = ctx.createBiquadFilter()
      const feedback = ctx.createGain()
      const output = ctx.createGain()
      const panner = ctx.createStereoPanner()
      delay.delayTime.value = delayTime!
      filter.type = 'lowpass'
      filter.frequency.value = 1800
      feedback.gain.value = 0.19
      output.gain.value = 0.3
      panner.pan.value = pan!
      room.connect(delay)
      delay.connect(filter)
      filter.connect(feedback)
      feedback.connect(delay)
      filter.connect(output)
      output.connect(panner)
      panner.connect(compressor)
      this.graph.push(delay, filter, feedback, output, panner)
    }

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = this.random() * 2 - 1
    this.score = new TrainingScore(ctx, compressor, this.noise, 'game')
    const hum = ctx.createOscillator()
    const humBeat = ctx.createOscillator()
    const humGain = ctx.createGain()
    hum.type = 'sine'
    humBeat.type = 'triangle'
    hum.frequency.value = 37
    humBeat.frequency.value = 37.4
    humGain.gain.value = 0
    hum.connect(humGain)
    humBeat.connect(humGain)
    humGain.connect(ambience)
    const air = ctx.createBufferSource()
    const airFilter = ctx.createBiquadFilter()
    const airGain = ctx.createGain()
    air.buffer = this.noise
    air.loop = true
    airFilter.type = 'lowpass'
    airFilter.frequency.value = 320
    airGain.gain.value = 0
    air.connect(airFilter)
    airFilter.connect(airGain)
    airGain.connect(ambience)
    this.hum = hum
    this.humBeat = humBeat
    this.humGain = humGain
    this.airGain = airGain
    this.airFilter = airFilter
    this.beds.push(hum, humBeat, air)
    this.graph.push(hum, humBeat, humGain, air, airFilter, airGain)
    for (const source of this.beds) source.start()
    this.applyEnvironment()
    this.nextAccent = ctx.currentTime + 1.4
  }

  resume() {
    this.clearFinishTimer()
    if (!this.context) this.initialize()
    const ctx = this.context!
    void ctx.resume().catch(() => {})
    this.ambience?.gain.setTargetAtTime(0.26, ctx.currentTime, 0.25)
    this.active = true
    this.updatePlasmaIdle()
    this.score?.start()
    // Audio time freezes on suspend. Preserve the existing accent schedule.
    if (this.nextAccent < ctx.currentTime)
      this.nextAccent = ctx.currentTime + 0.3
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 100)
  }

  pause() {
    this.clearFinishTimer()
    this.active = false
    // The context suspends immediately; resume fades the selected weapon in.
    this.plasmaIdleGain?.gain.setValueAtTime(0, this.context!.currentTime)
    this.score?.pause()
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    void this.context?.suspend().catch(() => {})
  }

  finish() {
    this.clearFinishTimer()
    this.active = false
    this.updatePlasmaIdle()
    this.score?.pause(true)
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    if (!this.context) return
    this.ambience?.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      this.shuttingDown ? 0.28 : 0.025
    )
    const now = this.context.currentTime
    const lastEnd = Math.max(
      now,
      ...Array.from(this.voices, (voice) => voice.end)
    )
    this.finishTimer = setTimeout(
      () => this.pause(),
      (lastEnd - now + 0.25) * 1000
    )
  }

  private clearFinishTimer() {
    if (this.finishTimer) clearTimeout(this.finishTimer)
    this.finishTimer = undefined
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.master?.gain.setTargetAtTime(
      muted ? 0 : 0.72,
      this.context!.currentTime,
      0.03
    )
  }

  setWeapon(weapon: WeaponId) {
    if (this.weapon === weapon) return
    this.weapon = weapon
    this.updatePlasmaIdle()
  }

  private updatePlasmaIdle() {
    const ctx = this.context
    if (!ctx) return
    const selected =
      this.active && !this.playerDead && !this.shuttingDown && this.weapon === 2
    if (selected && !this.plasmaIdleGain && this.samples.plasmaIdle) {
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      source.buffer = this.samples.plasmaIdle
      source.loop = true
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(this.dry!)
      source.start(ctx.currentTime)
      this.plasmaIdleGain = gain
      this.beds.push(source)
      this.graph.push(source, gain)
    }
    this.plasmaIdleGain?.gain.setTargetAtTime(
      selected ? 0.14 : 0,
      ctx.currentTime,
      selected ? 0.12 : 0.04
    )
  }

  setEnvironment(sectorId: string, sky: boolean) {
    if (sectorId === this.sector && sky === this.sky) return
    this.sector = sectorId
    this.sky = sky
    this.applyEnvironment()
  }

  private get serverRoom() {
    return /computer|gallery|training|deployment|server/.test(this.sector)
  }

  private applyEnvironment() {
    const ctx = this.context
    if (!ctx) return
    const now = ctx.currentTime
    const server = this.serverRoom
    this.hum?.frequency.setTargetAtTime(
      this.sky ? 29 : server ? 58 : 37,
      now,
      0.7
    )
    this.humBeat?.frequency.setTargetAtTime(
      this.sky ? 29.3 : server ? 116.7 : 37.4,
      now,
      0.7
    )
    this.humGain?.gain.setTargetAtTime(
      this.sky ? 0.025 : server ? 0.14 : 0.1,
      now,
      0.8
    )
    this.airGain?.gain.setTargetAtTime(
      this.sky ? 0.11 : server ? 0.055 : 0.035,
      now,
      0.8
    )
    this.airFilter?.frequency.setTargetAtTime(
      this.sky ? 620 : server ? 1050 : 320,
      now,
      0.8
    )
    this.room?.gain.setTargetAtTime(
      this.sky ? 0.18 : server ? 0.7 : 1,
      now,
      0.35
    )
  }

  private release(voice: Voice, stop = false) {
    if (!this.voices.delete(voice)) return
    voice.source.onended = null
    if (stop) voice.source.stop()
    for (const node of voice.nodes) node.disconnect()
  }

  private route(
    source: AudioScheduledSourceNode,
    gain: GainNode,
    nodes: AudioNode[],
    end: number,
    sound: Sound
  ) {
    const ctx = this.context!
    for (const voice of this.voices)
      if (voice.end <= ctx.currentTime) this.release(voice)
    // Bound pathological bursts as well as ordinary overlapping plasma shots.
    while (this.voices.size >= 64)
      this.release(this.voices.values().next().value!, true)
    const panner = ctx.createStereoPanner()
    const send = ctx.createGain()
    panner.pan.value = clamp(finite(sound.pan, 0), -1, 1)
    send.gain.value = sound.wet ?? 0.1
    gain.connect(panner)
    panner.connect(sound.ambient ? this.ambience! : this.dry!)
    panner.connect(send)
    send.connect(this.room!)
    const voice = { source, nodes: [source, ...nodes, gain, panner, send], end }
    this.voices.add(voice)
    source.onended = () => this.release(voice)
    return voice
  }

  private tone(
    frequency: number,
    end: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    when?: number,
    sound: Sound = {}
  ) {
    const ctx = this.context
    if (!ctx || !this.active) return
    const time = when ?? ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, time)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(10, end),
      time + duration
    )
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(
      Math.max(0.0002, volume * (sound.level ?? 1)),
      time + (sound.attack ?? (sound.ambient ? duration * 0.25 : 0.004))
    )
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    osc.connect(gain)
    this.route(osc, gain, [], time + duration + 0.01, sound)
    osc.start(time)
    osc.stop(time + duration + 0.01)
  }

  private burst(
    duration: number,
    volume: number,
    frequency: number,
    when?: number,
    sound: Sound = {},
    filterType: BiquadFilterType = 'lowpass'
  ) {
    const ctx = this.context
    if (!ctx || !this.noise || !this.active) return
    const time = when ?? ctx.currentTime
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = this.noise
    source.loop = true
    filter.type = filterType
    filter.frequency.value = frequency
    if (sound.filterEnd !== undefined) {
      filter.frequency.setValueAtTime(frequency, time)
      filter.frequency.exponentialRampToValueAtTime(
        sound.filterEnd,
        time + duration
      )
    }
    filter.Q.value = filterType === 'bandpass' ? 1.6 : 0.7
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(
      Math.max(0.0002, volume * (sound.level ?? 1)),
      time + (sound.attack ?? (sound.ambient ? duration * 0.2 : 0.003))
    )
    if (sound.hold !== undefined)
      gain.gain.setValueAtTime(
        Math.max(0.0002, volume * (sound.level ?? 1)),
        time + sound.hold
      )
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    source.connect(filter)
    const nodes: AudioNode[] = [filter]
    if (sound.rough) {
      // Local saturation roughens the material without changing the shared mix.
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Standard Web Audio API method.
      const grit = ctx.createWaveShaper()
      const highCut = ctx.createBiquadFilter()
      grit.curve = industrialSaturation
      grit.oversample = '2x'
      highCut.type = 'lowpass'
      highCut.frequency.value = 3800
      filter.connect(grit)
      grit.connect(highCut)
      highCut.connect(gain)
      nodes.push(grit, highCut)
    } else filter.connect(gain)
    this.route(source, gain, nodes, time + duration, sound)
    source.start(time, this.random())
    source.stop(time + duration)
  }

  /** A coarse, band-limited throat/motor excitation; no exposed pure-tone slides. */
  private rasp(
    frequency: number,
    end: number,
    duration: number,
    volume: number,
    time: number,
    sound: Sound = {},
    formant = 700
  ) {
    const ctx = this.context
    if (!ctx || !this.active) return
    const source = ctx.createOscillator()
    const throat = ctx.createBiquadFilter()
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Standard Web Audio API method.
    const grit = ctx.createWaveShaper()
    const highCut = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.type = 'sawtooth'
    source.frequency.setValueAtTime(frequency, time)
    source.frequency.exponentialRampToValueAtTime(end, time + duration)
    throat.type = 'bandpass'
    throat.frequency.value = formant
    throat.Q.value = 0.8
    grit.curve = industrialSaturation
    grit.oversample = '2x'
    highCut.type = 'lowpass'
    highCut.frequency.value = 3000
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(
      Math.max(0.0002, volume * (sound.level ?? 1)),
      time + (sound.attack ?? 0.006)
    )
    if (sound.hold !== undefined)
      gain.gain.setValueAtTime(
        Math.max(0.0002, volume * (sound.level ?? 1)),
        time + sound.hold
      )
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    source.connect(throat)
    throat.connect(grit)
    grit.connect(highCut)
    highCut.connect(gain)
    this.route(source, gain, [throat, grit, highCut], time + duration, sound)
    source.start(time)
    source.stop(time + duration)
  }

  private playerVoice(time: number, death: boolean) {
    if (!death && time < this.nextPainAt) return
    for (const voice of this.painVoices) this.release(voice, true)
    this.painVoices = []
    const before = new Set(this.voices)
    const preferred =
      this.painVariant++ % 2 === 0
        ? this.samples.playerPain1
        : this.samples.playerPain2
    const buffer = death
      ? this.samples.playerDeath
      : (preferred ?? this.samples.playerPain1 ?? this.samples.playerPain2)
    if (buffer) {
      const ctx = this.context!
      const source = ctx.createBufferSource()
      const lowCut = ctx.createBiquadFilter()
      const highCut = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      source.buffer = buffer
      lowCut.type = 'highpass'
      lowCut.frequency.value = 75
      highCut.type = 'lowpass'
      highCut.frequency.value = 5200
      gain.gain.value = death ? 1.1 : 0.95
      source.connect(lowCut)
      lowCut.connect(highCut)
      highCut.connect(gain)
      this.route(source, gain, [lowCut, highCut], time + buffer.duration, {
        wet: 0.14
      })
      source.start(time)
      source.stop(time + buffer.duration)
    } else {
      // A short chest/throat burst remains usable when a recording is unavailable.
      const sound = { wet: 0.16, rough: true }
      this.rasp(
        death ? 119 : 97,
        death ? 67 : 82,
        death ? 1.12 : 0.3,
        0.36,
        time,
        sound,
        600
      )
      this.burst(
        death ? 1.18 : 0.28,
        0.3,
        900,
        time,
        { ...sound, filterEnd: death ? 380 : 650 },
        'bandpass'
      )
    }
    const added = Array.from(this.voices).filter((voice) => !before.has(voice))
    if (death) this.playerDead = true
    else {
      this.painVoices = added
      this.nextPainAt = Math.max(
        time + 0.5,
        ...added.map((voice) => voice.end + 0.035)
      )
    }
  }

  private shotgunBlast(time: number) {
    const ctx = this.context!
    const source = ctx.createBufferSource()
    const lowCut = ctx.createBiquadFilter()
    const body = ctx.createBiquadFilter()
    // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Standard Web Audio API method.
    const grit = ctx.createWaveShaper()
    const highCut = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = this.noise!
    source.loop = true
    lowCut.type = 'highpass'
    lowCut.frequency.value = 85
    body.type = 'lowpass'
    body.Q.value = 0.85
    body.frequency.setValueAtTime(6800, time)
    body.frequency.exponentialRampToValueAtTime(2400, time + 0.055)
    body.frequency.exponentialRampToValueAtTime(550, time + 0.32)
    grit.curve = shotgunSaturation
    grit.oversample = '2x'
    highCut.type = 'lowpass'
    highCut.frequency.value = 5200
    // Hold the report briefly before the ragged body falls away. Saturation
    // adds bite locally; the shared mix compressor still owns output headroom.
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(0.56, time + 0.0015)
    gain.gain.exponentialRampToValueAtTime(0.38, time + 0.027)
    gain.gain.exponentialRampToValueAtTime(0.11, time + 0.11)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32)
    source.connect(lowCut)
    lowCut.connect(body)
    body.connect(grit)
    grit.connect(highCut)
    highCut.connect(gain)
    this.route(source, gain, [lowCut, body, grit, highCut], time + 0.33, {
      wet: 0.16
    })
    source.start(time, this.random())
    source.stop(time + 0.33)

    this.burst(0.036, 0.33, 2800, time, { wet: 0.04 }, 'highpass')
    this.tone(154, 47, 0.28, 0.53, 'sine', time, { wet: 0.06 })
    this.tone(92, 36, 0.24, 0.14, 'triangle', time, { wet: 0.08 })
    this.burst(0.35, 0.16, 500, time + 0.035, { wet: 0.45 }, 'bandpass')

    // A distinct rearward rack and forward steel lock complete each shot.
    this.burst(0.09, 0.34, 1600, time + 0.3, { wet: 0.15 }, 'bandpass')
    this.tone(205, 102, 0.06, 0.15, 'square', time + 0.3)
    this.burst(0.062, 0.36, 3100, time + 0.43, { wet: 0.13 })
    this.tone(260, 90, 0.072, 0.16, 'triangle', time + 0.43)
    this.tone(1680, 1420, 0.035, 0.08, 'sine', time + 0.44)
    this.tone(1380, 1200, 0.044, 0.062, 'sine', time + 0.57, {
      pan: 0.4,
      wet: 0.2
    })
    this.tone(1580, 1320, 0.03, 0.027, 'sine', time + 0.69, {
      pan: 0.55,
      wet: 0.2
    })
  }

  private recordedShotgun(time: number) {
    const buffer = this.samples.shotgun
    if (!buffer) return false
    const ctx = this.context!
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = 1.25
    source.connect(gain)
    this.route(source, gain, [], time + buffer.duration, { wet: 0.12 })
    source.start(time)
    source.stop(time + buffer.duration)
    return true
  }

  private pickupCue(
    time: number,
    weapon: WeaponId | undefined,
    detail: AudioDetail
  ) {
    const sound: Sound = { rough: true, wet: 0.13 }
    if (detail.pickupKind === 'health') {
      // A medical pressure seal: firm engagement, relief, and a settled low hum.
      this.burst(0.045, 0.42, 2300, time, sound, 'bandpass')
      this.burst(
        0.29,
        0.4,
        1350,
        time + 0.025,
        { wet: 0.1, attack: 0.012, hold: 0.1, filterEnd: 550 },
        'bandpass'
      )
      this.tone(94, 94, 0.22, 0.28, 'sine', time + 0.04, {
        attack: 0.018,
        wet: 0.08
      })
      this.burst(0.055, 0.3, 1100, time + 0.2, sound)
    } else if (detail.pickupKind === 'armor') {
      // Weight first, then the unmistakable second steel locking strike.
      this.burst(0.09, 0.38, 1700, time, sound)
      this.rasp(96, 80, 0.2, 0.26, time, sound, 420)
      this.burst(0.12, 0.18, 2900, time + 0.02, sound, 'bandpass')
      this.burst(0.075, 0.34, 2400, time + 0.16, sound, 'bandpass')
      this.rasp(181, 169, 0.085, 0.2, time + 0.16, sound, 980)
    } else if (detail.pickupKind === 'weapon') {
      const shutdown = weapon === 3
      const pitch = shutdown ? 51 : weapon === 2 ? 128 : 103
      this.burst(0.1, 0.4, 1800, time, sound)
      this.rasp(
        pitch,
        pitch * 0.88,
        shutdown ? 0.85 : 0.44,
        shutdown ? 0.34 : 0.26,
        time,
        sound,
        420
      )
      this.burst(
        shutdown ? 0.72 : 0.32,
        0.2,
        shutdown ? 560 : 1300,
        time + 0.03,
        { ...sound, filterEnd: 340 },
        'bandpass'
      )
      this.burst(
        0.09,
        0.37,
        shutdown ? 1400 : 2400,
        time + (shutdown ? 0.49 : 0.22),
        sound
      )
      this.rasp(
        shutdown ? 71 : 213,
        shutdown ? 59 : 201,
        0.13,
        0.21,
        time + (shutdown ? 0.49 : 0.22),
        sound,
        680
      )
    } else {
      // A data cartridge slams home, ratchets, and locks into the receiver.
      const pool = clamp(finite(detail.ammoPool, 0), 0, 2)
      const pitch = 118 + pool * 31
      this.burst(0.06, 0.58, 2100, time, sound, 'bandpass')
      this.rasp(pitch, pitch * 0.92, 0.15, 0.3, time, sound, 800 + pool * 260)
      this.burst(0.045, 0.4, 3900, time + 0.095, sound, 'bandpass')
      this.burst(0.08, 0.38, 740, time + 0.12, sound)
      this.rasp(
        209 + pool * 47,
        198 + pool * 47,
        0.07,
        0.22,
        time + 0.095,
        sound,
        1700
      )
    }
  }

  private schedule() {
    const ctx = this.context
    if (!ctx || !this.active || this.nextAccent > ctx.currentTime + 0.15) return
    const time = Math.max(ctx.currentTime, this.nextAccent)
    const sound: Sound = {
      ambient: true,
      wet: this.sky ? 0.04 : 0.45,
      pan: this.random() * 1.7 - 0.85
    }
    const choice = this.random()
    if (this.sky || choice < 0.35) {
      this.burst(
        2.3 + this.random() * 1.6,
        0.065,
        180 + this.random() * 420,
        time,
        sound,
        'bandpass'
      )
      if (!this.sky) this.tone(52, 36, 2.8, 0.035, 'triangle', time, sound)
    } else if (choice < 0.72) {
      const pitch = 95 + this.random() * (this.serverRoom ? 170 : 85)
      this.tone(pitch, pitch * 0.91, 2.1, 0.05, 'sine', time, sound)
      this.tone(
        pitch * 1.43,
        pitch * 1.37,
        1.7,
        0.025,
        'triangle',
        time + 0.07,
        sound
      )
      this.burst(0.8, 0.035, pitch * 3, time, sound, 'bandpass')
    } else {
      this.burst(0.16, 0.065, 660, time, sound)
      this.tone(81, 49, 1.4, 0.04, 'triangle', time, sound)
      this.burst(0.1, 0.027, 950, time + 0.31, sound)
    }
    this.nextAccent = time + 5.2 + this.random() * 7.8
  }

  private enemyCue(
    kind: EnemyKind,
    cue: EnemyCue,
    time: number,
    spatial: Sound
  ) {
    if (cue === 'death' && this.recordedEnemyDeath(kind, time, spatial)) return
    const sound: Sound = {
      ...spatial,
      rough: true,
      level: (spatial.level ?? 1) * (kind === 'sam' ? 1.15 : 1.55)
    }
    if (kind === 'deception') {
      if (cue === 'alert') {
        // Leaking breath and a dry, almost sub-vocal growl.
        this.rasp(59, 56, 0.42, 0.19, time, sound, 490)
        this.burst(
          0.46,
          0.3,
          1500,
          time,
          { ...sound, attack: 0.035, filterEnd: 800 },
          'bandpass'
        )
        this.burst(0.15, 0.13, 2600, time + 0.17, sound, 'bandpass')
      } else if (cue === 'attack') {
        // Ignition and pressure hit together, followed by a scorched, unpitched roar.
        const ignition: Sound = { ...sound, attack: 0.001, wet: 0.18 }
        this.burst(0.075, 0.64, 2900, time, { ...ignition, filterEnd: 850 })
        this.burst(0.16, 0.48, 260, time, {
          ...ignition,
          hold: 0.035,
          filterEnd: 105
        })
        this.burst(0.42, 0.5, 1300, time + 0.012, {
          ...ignition,
          attack: 0.004,
          hold: 0.13,
          filterEnd: 240
        })
        this.burst(
          0.24,
          0.24,
          2200,
          time + 0.018,
          { ...ignition, hold: 0.04, filterEnd: 600 },
          'bandpass'
        )
      } else {
        this.rasp(91, 62, 0.61, 0.26, time, sound, 520)
        this.burst(
          0.62,
          0.3,
          1200,
          time,
          { ...sound, filterEnd: 320 },
          'bandpass'
        )
        this.burst(0.11, 0.2, 460, time + 0.3, sound)
      }
    } else if (kind === 'sycophant') {
      if (cue === 'alert') {
        // A pair of wet, strangled approvals, voiced in a higher throat register.
        this.rasp(157, 163, 0.16, 0.24, time, sound, 930)
        this.burst(0.12, 0.19, 1200, time, sound, 'bandpass')
        this.rasp(167, 153, 0.21, 0.24, time + 0.19, sound, 1080)
        this.burst(0.19, 0.22, 1700, time + 0.19, sound, 'bandpass')
      } else if (cue === 'attack') {
        this.rasp(193, 167, 0.25, 0.3, time, sound, 1180)
        this.burst(0.08, 0.32, 2100, time, sound, 'bandpass')
        this.burst(0.14, 0.24, 680, time + 0.06, sound)
      } else {
        this.rasp(173, 139, 0.22, 0.25, time, sound, 950)
        this.burst(0.18, 0.24, 1500, time, sound, 'bandpass')
        this.rasp(127, 89, 0.4, 0.19, time + 0.19, sound, 510)
        this.burst(0.28, 0.24, 690, time + 0.24, sound)
      }
    } else if (kind === 'paperclip') {
      if (cue === 'alert') {
        // Tensioned wire scraping a steel housing, followed by an irregular rattle.
        this.rasp(347, 331, 0.16, 0.16, time, sound, 2100)
        this.burst(0.15, 0.32, 3100, time, sound, 'bandpass')
        this.burst(0.065, 0.25, 1800, time + 0.14, sound, 'bandpass')
        this.burst(0.045, 0.17, 2500, time + 0.225, sound, 'bandpass')
      } else if (cue === 'attack') {
        // A dry weapon report, chamber punch and tearing steel; no ringing notes.
        const steel: Sound = { ...sound, attack: 0.001, wet: 0.045 }
        this.burst(
          0.045,
          0.78,
          3400,
          time,
          { ...steel, filterEnd: 1200 },
          'highpass'
        )
        this.burst(0.07, 0.52, 1800, time, { ...steel, filterEnd: 520 })
        this.burst(0.2, 0.65, 240, time, {
          ...steel,
          hold: 0.025,
          filterEnd: 85
        })
        this.burst(
          0.18,
          0.38,
          1100,
          time + 0.005,
          { ...steel, attack: 0.002, hold: 0.045, filterEnd: 380 },
          'bandpass'
        )
      } else {
        this.rasp(239, 223, 0.13, 0.18, time, sound, 1600)
        const delays = [0, 0.055, 0.13, 0.24, 0.39]
        for (const [index, delay] of delays.entries())
          this.burst(
            0.07,
            0.34 - index * 0.045,
            3200 - index * 430,
            time + delay,
            sound,
            'bandpass'
          )
        this.burst(0.22, 0.18, 600, time + 0.14, sound)
      }
    } else {
      if (cue === 'alert') {
        // Loaded server motors and two weighty contactors.
        this.rasp(47, 49, 0.65, 0.36, time, sound, 320)
        this.burst(0.5, 0.28, 430, time, sound)
        this.burst(0.1, 0.35, 1400, time, sound)
        this.burst(0.1, 0.3, 1100, time + 0.24, sound)
      } else if (cue === 'attack') {
        // Ignition breaks the pressure seal; combustion and exhaust carry the weight.
        this.burst(
          0.075,
          0.62,
          2600,
          time,
          { ...sound, filterEnd: 900 },
          'highpass'
        )
        this.rasp(
          77,
          47,
          0.38,
          0.5,
          time,
          { ...sound, attack: 0.003, hold: 0.06 },
          250
        )
        this.burst(0.34, 0.48, 1550, time + 0.018, {
          ...sound,
          attack: 0.012,
          hold: 0.09,
          filterEnd: 340
        })
        this.rasp(119, 86, 0.26, 0.22, time + 0.035, sound, 610)
        this.burst(0.5, 0.25, 720, time + 0.06, {
          ...sound,
          attack: 0.012,
          hold: 0.1,
          filterEnd: 190
        })
      } else {
        this.rasp(93, 57, 1.08, 0.37, time, sound, 360)
        this.burst(0.88, 0.35, 1100, time, { ...sound, filterEnd: 170 })
        this.burst(0.12, 0.37, 900, time + 0.46, sound)
        this.rasp(163, 149, 0.13, 0.23, time + 0.51, sound, 790)
        this.burst(0.22, 0.25, 440, time + 0.83, sound)
      }
    }
  }

  private ambientMonsterGrowl(time: number, spatial: Sound) {
    const buffer = this.samples.monsterGrowl
    // A missing ambient recording stays silent instead of borrowing a chirpy alert.
    if (!buffer) return
    const ctx = this.context!
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = (spatial.level ?? 1) * 1.25
    source.connect(gain)
    this.route(source, gain, [], time + buffer.duration, {
      ...spatial,
      wet: 0.38
    })
    source.start(time)
    source.stop(time + buffer.duration)
  }

  private recordedEnemyDeath(kind: EnemyKind, time: number, spatial: Sound) {
    const buffer = {
      deception: this.samples.doomImpDeath,
      sycophant: this.samples.doomZombieDeath,
      paperclip: this.samples.doomDemonDeath,
      sam: this.samples.doomBaronDeath
    }[kind]
    if (!buffer) return false
    const ctx = this.context!
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    // Play each prepared recording at its authored pitch and complete length.
    source.buffer = buffer
    gain.gain.value = (spatial.level ?? 1) * (kind === 'sam' ? 1.1 : 1)
    source.connect(gain)
    this.route(source, gain, [], time + buffer.duration, {
      ...spatial,
      wet: 0.18
    })
    source.start(time)
    source.stop(time + buffer.duration)
    return true
  }

  private pistolShot(time: number) {
    const buffer = this.samples.pistol
    if (buffer) {
      const ctx = this.context!
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      source.buffer = buffer
      gain.gain.value = 1.05
      source.connect(gain)
      this.route(source, gain, [], time + buffer.duration, { wet: 0.11 })
      source.start(time)
      source.stop(time + buffer.duration)
      return
    }
    // A dry, weighty fallback if the recording is unavailable.
    this.burst(0.07, 0.64, 4400, time, { rough: true, hold: 0.014, wet: 0.08 })
    this.burst(0.23, 0.53, 1200, time, {
      rough: true,
      hold: 0.05,
      filterEnd: 380,
      wet: 0.11
    })
    this.tone(126, 43, 0.2, 0.4, 'triangle', time, { wet: 0.06 })
    this.burst(
      0.04,
      0.2,
      2500,
      time + 0.14,
      { rough: true, pan: 0.18, wet: 0.08 },
      'bandpass'
    )
  }

  private plasmaPulse(time: number) {
    const buffer = this.samples.plasma
    if (!buffer) {
      // A quiet emergency cue only if the recorded asset cannot be decoded.
      this.burst(0.08, 0.3, 1800, time, { rough: true, wet: 0.04 })
      return
    }
    const ctx = this.context!
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = 0.72
    source.connect(gain)
    // Preserve the original recording's complete PCM, native pitch and envelope.
    this.route(source, gain, [], time + buffer.duration, { wet: 0.06 })
    source.start(time)
    source.stop(time + buffer.duration)
  }

  private shutdownCharge(time: number) {
    const duration = SHUTDOWN_CHARGE_SECONDS
    // Rising current stays near its peak until the projectile actually releases.
    this.burst(0.04, 0.4, 2000, time, { rough: true, wet: 0.1 })
    this.rasp(
      63,
      230,
      duration,
      0.58,
      time,
      {
        attack: duration * 0.76,
        hold: duration - 0.015,
        wet: 0.22
      },
      850
    )
    this.burst(
      duration,
      0.58,
      850,
      time,
      {
        rough: true,
        filterEnd: 4200,
        attack: duration * 0.8,
        hold: duration - 0.015,
        wet: 0.22
      },
      'bandpass'
    )
    this.rasp(
      42,
      105,
      duration,
      0.42,
      time,
      {
        attack: duration * 0.86,
        hold: duration - 0.015,
        wet: 0.16
      },
      310
    )
    for (const [fraction, volume, frequency] of [
      [0.22, 0.2, 1700],
      [0.54, 0.3, 2300],
      [0.85, 0.45, 3200]
    ] as const)
      this.burst(
        0.052,
        volume,
        frequency,
        time + duration * fraction,
        { rough: true, wet: 0.13 },
        'bandpass'
      )
  }

  private shutdownBlast(time: number) {
    // A slowed recorded impulse supplies physical weight beneath the reactor blast.
    const buffer = this.samples.pistol
    if (buffer) {
      const ctx = this.context!
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      source.buffer = buffer
      source.playbackRate.value = 0.58
      filter.type = 'lowpass'
      filter.frequency.value = 3200
      gain.gain.value = 1.2
      source.connect(filter)
      filter.connect(gain)
      const end = time + buffer.duration / source.playbackRate.value
      this.route(source, gain, [filter], end, { wet: 0.28 })
      source.start(time)
      source.stop(end)
    }
    this.burst(0.095, 0.9, 6900, time, { hold: 0.018, wet: 0.16 })
    this.burst(1.2, 1.2, 2200, time, {
      rough: true,
      attack: 0.004,
      hold: 0.26,
      filterEnd: 230,
      wet: 0.36
    })
    this.tone(64, 19, 1.05, 0.85, 'sine', time, { wet: 0.25 })
    this.rasp(
      126,
      44,
      1.15,
      0.66,
      time + 0.015,
      {
        hold: 0.2,
        wet: 0.32
      },
      630
    )
    this.burst(0.72, 0.58, 580, time + 0.09, {
      rough: true,
      hold: 0.24,
      filterEnd: 150,
      wet: 0.38
    })
    for (const [delay, volume, frequency] of [
      [0.075, 0.42, 3600],
      [0.21, 0.34, 2900],
      [0.41, 0.27, 2300]
    ] as const)
      this.burst(
        0.14,
        volume,
        frequency,
        time + delay,
        { rough: true, wet: 0.3 },
        'bandpass'
      )
  }

  private pressureDoor(
    time: number,
    action: NonNullable<AudioDetail['doorAction']>,
    spatial: Sound
  ) {
    const sound: Sound = { ...spatial, rough: true, wet: 0.22 }
    if (action === 'open') {
      // The bolts release before compressed air escapes around the seal.
      this.burst(0.045, 0.29, 2100, time, sound, 'bandpass')
      this.tone(136, 66, 0.13, 0.22, 'triangle', time, sound)
      this.burst(0.065, 0.22, 3300, time + 0.035, sound, 'bandpass')
      this.burst(
        0.54,
        0.46,
        4100,
        time + 0.035,
        {
          ...spatial,
          wet: 0.28,
          rough: false,
          attack: 0.023,
          hold: 0.17,
          filterEnd: 750
        },
        'bandpass'
      )
      this.burst(
        0.36,
        0.19,
        950,
        time + 0.1,
        {
          ...spatial,
          wet: 0.17,
          rough: false,
          attack: 0.06,
          filterEnd: 420
        },
        'lowpass'
      )
      this.rasp(89, 73, 0.48, 0.19, time + 0.095, sound, 470)
      this.burst(0.065, 0.15, 850, time + 0.57, sound)
    } else if (action === 'close') {
      // A drawing-in vacuum hiss accompanies the heavy panel's return travel.
      this.burst(
        0.56,
        0.35,
        680,
        time,
        {
          ...spatial,
          wet: 0.24,
          rough: false,
          attack: 0.085,
          hold: 0.33,
          filterEnd: 3100
        },
        'bandpass'
      )
      this.rasp(113, 71, 0.59, 0.23, time, sound, 410)
      this.burst(
        0.42,
        0.2,
        420,
        time + 0.08,
        {
          ...sound,
          attack: 0.08,
          filterEnd: 210
        },
        'lowpass'
      )
    } else {
      // Triggered by the actual closed position, never by a predicted timer.
      this.tone(102, 29, 0.26, 0.31, 'sine', time, sound)
      this.burst(0.11, 0.34, 820, time, sound)
      this.burst(
        0.19,
        0.29,
        3100,
        time + 0.025,
        {
          ...spatial,
          wet: 0.14,
          rough: false,
          filterEnd: 680
        },
        'bandpass'
      )
      this.burst(0.055, 0.28, 1900, time + 0.07, sound, 'bandpass')
      this.rasp(176, 137, 0.105, 0.14, time + 0.07, sound, 770)
    }
  }

  effect(type: string, weapon?: WeaponId, detail: AudioDetail = {}) {
    const ctx = this.context
    if (!ctx || !this.active || this.playerDead) return
    const time = ctx.currentTime
    const distance = clamp(finite(detail.distance, 0), 0, 200)
    const spatial: Sound = {
      pan: detail.pan,
      level: 1 / (1 + (distance / 14) ** 2),
      wet: 0.3,
      rough: true
    }
    if (type === 'charge') {
      this.shutdownCharge(time)
    } else if (type === 'shot') {
      if (weapon === 0) {
        this.pistolShot(time)
      } else if (weapon === 1) {
        if (!this.recordedShotgun(time)) this.shotgunBlast(time)
      } else if (weapon === 2) {
        this.plasmaPulse(time)
      } else {
        this.shutdownBlast(time)
      }
    } else if (type === 'explosion') {
      const strength = clamp(finite(detail.strength, 1), 0.25, 2)
      spatial.level! *= Math.sqrt(strength)
      this.burst(0.68, 0.67, 1150, time, spatial)
      this.tone(92, 23, 0.83, 0.44, 'sine', time, spatial)
      this.burst(0.2, 0.22, 2600, time + 0.13, spatial, 'bandpass')
    } else if (type === 'impact') {
      const flesh = detail.surface === 'enemy' || detail.surface === 'player'
      this.burst(flesh ? 0.13 : 0.065, 0.14, flesh ? 780 : 2600, time, spatial)
      if (!flesh)
        this.rasp(
          detail.surface === 'barrel' ? 179 : 313,
          detail.surface === 'barrel' ? 161 : 301,
          0.065,
          0.09,
          time,
          spatial,
          1500
        )
    } else if (type === 'land') {
      const strength = clamp(finite(detail.impact, 3) / 8, 0, 1)
      this.burst(0.12, 0.17 * strength, 310)
      this.tone(58, 25, 0.15, 0.18 * strength)
    } else if (type === 'enemy-ambient') {
      this.ambientMonsterGrowl(time, spatial)
    } else if (type === 'enemy-alert' || type === 'enemy') {
      this.enemyCue(
        detail.kind ?? 'deception',
        type === 'enemy-alert' ? 'alert' : 'attack',
        time,
        spatial
      )
    } else if (type === 'pickup') {
      this.pickupCue(time, weapon, detail)
    } else if (type === 'hurt') {
      this.playerVoice(time, false)
    } else if (type === 'player-death') {
      this.playerVoice(time, true)
      this.updatePlasmaIdle()
    } else if (type === 'kill') {
      this.enemyCue(detail.kind ?? 'deception', 'death', time, spatial)
    } else if (type === 'hit') {
      this.burst(0.1, 0.16, 900, time, spatial)
    } else if (type === 'door') {
      this.pressureDoor(time, detail.doorAction ?? 'open', spatial)
    } else if (type === 'win') {
      this.shuttingDown = true
      this.updatePlasmaIdle()
      // The switch hits its stop; relay banks drop out while the motors coast down.
      this.burst(0.11, 0.44, 1700, time, { rough: true, wet: 0.08 })
      this.tone(96, 27, 0.25, 0.35, 'sine', time, { wet: 0.08 })
      this.rasp(181, 21, 1.8, 0.2, time + 0.08, { rough: true, wet: 0.08 }, 740)
      this.tone(76, 12, 1.85, 0.18, 'sine', time + 0.04, { wet: 0.06 })
      this.burst(1.7, 0.15, 1300, time + 0.1, {
        rough: true,
        wet: 0.06,
        filterEnd: 90
      })
      for (const [delay, pan] of [
        [0.34, -0.65],
        [0.72, 0.55],
        [1.1, -0.15]
      ]) {
        this.burst(
          0.065,
          0.17,
          1800,
          time + delay!,
          { rough: true, pan, wet: 0.12 },
          'bandpass'
        )
        this.rasp(
          149,
          69,
          0.14,
          0.1,
          time + delay!,
          { rough: true, pan, wet: 0.08 },
          510
        )
      }
    }
  }

  dispose() {
    this.pause()
    this.score?.dispose()
    this.score = undefined
    for (const voice of this.voices) this.release(voice, true)
    for (const source of this.beds) source.stop()
    for (const node of this.graph) node.disconnect()
    this.beds = []
    this.graph = []
    void this.context?.close().catch(() => {})
    this.context = undefined
    this.master = this.dry = this.ambience = this.room = undefined
    this.hum = this.humBeat = undefined
    this.humGain = this.airGain = undefined
    this.airFilter = undefined
    this.noise = undefined
    this.plasmaIdleGain = undefined
    this.samples = {}
    this.painVoices = []
  }
}
