export type MenuCue = 'move' | 'confirm' | 'back'

type Voice = {
  source: AudioScheduledSourceNode
  nodes: AudioNode[]
}

/** Original, deliberately sparse industrial score shared by the title and lab. */
export class TrainingScore {
  private output: GainNode
  private echo: GainNode
  private graph: AudioNode[] = []
  private voices = new Set<Voice>()
  private timer: ReturnType<typeof setInterval> | undefined
  private nextStep = 0
  private step = 0

  constructor(
    private context: AudioContext,
    destination: AudioNode,
    private noise: AudioBuffer,
    private mode: 'menu' | 'game'
  ) {
    const output = context.createGain()
    output.gain.value = 0
    output.connect(destination)
    const echo = context.createGain()
    echo.gain.value = 0.24
    for (const [seconds, pan] of [
      [0.223, -0.65],
      [0.381, 0.65]
    ]) {
      const delay = context.createDelay(0.5)
      const filter = context.createBiquadFilter()
      const panner = context.createStereoPanner()
      delay.delayTime.value = seconds!
      filter.type = 'lowpass'
      filter.frequency.value = 1050
      panner.pan.value = pan!
      echo.connect(delay)
      delay.connect(filter)
      filter.connect(panner)
      panner.connect(output)
      this.graph.push(delay, filter, panner)
    }
    this.output = output
    this.echo = echo
    this.graph.push(output, echo)
  }

  start() {
    if (this.timer) return
    this.output.gain.setTargetAtTime(
      this.mode === 'menu' ? 0.74 : 0.48,
      this.context.currentTime,
      0.18
    )
    // Do not catch up missed beats after a throttled tab or a paused run.
    if (this.nextStep <= this.context.currentTime)
      this.nextStep = this.context.currentTime + 0.24
    this.timer = setInterval(() => this.schedule(), 80)
  }

  pause(fade = false) {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    if (fade)
      this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.025)
  }

  private release(voice: Voice, stop = false) {
    if (!this.voices.delete(voice)) return
    voice.source.onended = null
    if (stop) voice.source.stop()
    for (const node of voice.nodes) node.disconnect()
  }

  private voice(
    frequency: number,
    duration: number,
    volume: number,
    when: number,
    waveform: OscillatorType | 'noise' = 'triangle',
    end = frequency,
    pan = 0,
    attack = 0.012
  ) {
    const ctx = this.context
    while (this.voices.size >= 28)
      this.release(this.voices.values().next().value!, true)
    const source =
      waveform === 'noise' ? ctx.createBufferSource() : ctx.createOscillator()
    if (waveform === 'noise') {
      const noiseSource = source as AudioBufferSourceNode
      noiseSource.buffer = this.noise
      noiseSource.loop = true
    } else {
      const oscillator = source as OscillatorNode
      oscillator.type = waveform
      oscillator.frequency.setValueAtTime(frequency, when)
      oscillator.frequency.exponentialRampToValueAtTime(end, when + duration)
    }
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const panner = ctx.createStereoPanner()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(
      waveform === 'noise' ? frequency : 1500,
      when
    )
    if (waveform !== 'noise')
      filter.frequency.exponentialRampToValueAtTime(360, when + duration)
    filter.Q.value = 0.7
    panner.pan.value = pan
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.linearRampToValueAtTime(volume, when + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(panner)
    panner.connect(this.output)
    panner.connect(this.echo)
    const voice = { source, nodes: [source, filter, gain, panner] }
    this.voices.add(voice)
    source.onended = () => this.release(voice)
    source.start(when)
    source.stop(when + duration + 0.01)
  }

  private schedule() {
    const now = this.context.currentTime
    const interval = 60 / (this.mode === 'menu' ? 72 : 88) / 2
    if (this.nextStep < now - interval) this.nextStep = now + 0.02
    while (this.nextStep <= now + 0.14) {
      const time = Math.max(now, this.nextStep)
      const position = this.step % 16
      const phrase = Math.floor(this.step / 16) % 4
      // A pedal tone, flattened second and tritone form an original uneasy motif.
      const pattern = [
        0,
        null,
        0,
        null,
        1,
        null,
        0,
        6,
        0,
        null,
        3,
        2,
        null,
        1,
        null,
        null
      ]
      const note = pattern[position]!
      const root = 55 * 2 ** ((phrase === 3 ? -2 : 0) / 12)
      if (
        note !== null &&
        (this.mode === 'game' || position % 4 === 0 || position === 7)
      ) {
        const frequency = root * 2 ** (note / 12)
        this.voice(frequency, interval * 1.6, 0.15, time, 'triangle')
        this.voice(frequency * 2, interval * 0.9, 0.025, time, 'sawtooth')
      }
      if (position === 0 || position === 8) {
        this.voice(
          78,
          0.29,
          this.mode === 'game' ? 0.17 : 0.11,
          time,
          'sine',
          31
        )
        this.voice(540, 0.075, 0.06, time, 'noise')
      }
      if (position === 6 || position === 14) {
        this.voice(
          1200,
          0.12,
          0.065,
          time,
          'noise',
          1200,
          position === 6 ? -0.3 : 0.3
        )
        this.voice(294, 0.22, 0.036, time, 'sine', 287)
      }
      if (position === 0) {
        const chord = phrase % 2 === 0 ? [0, 7, 13] : [0, 6, 12]
        for (const [index, semitone] of chord.entries()) {
          const pitch = root * 2 * 2 ** (semitone / 12)
          this.voice(
            pitch,
            interval * 14,
            0.035,
            time,
            'sine',
            pitch * 0.998,
            (index - 1) * 0.5,
            interval * 3
          )
        }
      }
      if (this.mode === 'game' && position === 12 && phrase % 2 === 1) {
        this.voice(
          root * 8,
          interval * 2.8,
          0.035,
          time,
          'triangle',
          root * 8.02,
          0.4
        )
        this.voice(
          root * 2 ** (31 / 12),
          interval * 2,
          0.021,
          time + interval,
          'triangle',
          root * 2 ** (31 / 12),
          -0.4
        )
      }
      this.nextStep += interval
      this.step++
    }
  }

  dispose() {
    this.pause()
    for (const voice of this.voices) this.release(voice, true)
    for (const node of this.graph) node.disconnect()
    this.graph = []
  }
}

/** One shell-owned menu channel. Creating it never starts browser audio. */
export class MenuAudio {
  private context: AudioContext | undefined
  private master: GainNode | undefined
  private effects: GainNode | undefined
  private noise: AudioBuffer | undefined
  private score: TrainingScore | undefined
  private graph: AudioNode[] = []
  private voices = new Set<Voice>()
  private muted = false
  private active = true
  private disposed = false
  private lastMove = -Infinity
  private visibility = () => this.syncState()

  private initialize() {
    const ctx = new AudioContext()
    this.context = ctx
    const master = ctx.createGain()
    const effects = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()
    master.gain.value = this.muted ? 0 : 0.72
    effects.gain.value = 0.65
    compressor.threshold.value = -15
    compressor.knee.value = 12
    compressor.ratio.value = 5
    compressor.attack.value = 0.003
    compressor.release.value = 0.18
    effects.connect(compressor)
    compressor.connect(master)
    master.connect(ctx.destination)
    this.master = master
    this.effects = effects
    this.graph.push(master, effects, compressor)
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    let seed = 91573
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0
      samples[i] = (seed >>> 0) / 2147483648 - 1
    }
    this.score = new TrainingScore(ctx, compressor, this.noise, 'menu')
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', this.visibility)
  }

  private syncState() {
    const ctx = this.context
    if (!ctx) return
    if (this.active && (typeof document === 'undefined' || !document.hidden)) {
      void ctx.resume().catch(() => {})
      this.score?.start()
    } else {
      this.score?.pause()
      // Menu impacts should not resume halfway through a clunk after a run.
      for (const voice of this.voices) this.release(voice, true)
      this.lastMove = -Infinity
      void ctx.suspend().catch(() => {})
    }
  }

  setActive(active: boolean) {
    this.active = active
    this.syncState()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.context)
      this.master?.gain.setTargetAtTime(
        muted ? 0 : 0.72,
        this.context.currentTime,
        0.02
      )
  }

  private release(voice: Voice, stop = false) {
    if (!this.voices.delete(voice)) return
    voice.source.onended = null
    if (stop) voice.source.stop()
    for (const node of voice.nodes) node.disconnect()
  }

  private strike(
    frequency: number,
    duration: number,
    volume: number,
    delay = 0,
    noise = false,
    end = frequency
  ) {
    const ctx = this.context!
    while (this.voices.size >= 32)
      this.release(this.voices.values().next().value!, true)
    const time = ctx.currentTime + delay
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator()
    if (noise) (source as AudioBufferSourceNode).buffer = this.noise!
    else {
      const oscillator = source as OscillatorNode
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, time)
      oscillator.frequency.exponentialRampToValueAtTime(end, time + duration)
    }
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    filter.type = noise ? 'bandpass' : 'lowpass'
    filter.frequency.value = noise ? frequency : 2400
    filter.Q.value = noise ? 0.9 : 0.7
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.linearRampToValueAtTime(volume, time + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.effects!)
    const voice = { source, nodes: [source, filter, gain] }
    this.voices.add(voice)
    source.onended = () => this.release(voice)
    source.start(time)
    source.stop(time + duration + 0.01)
  }

  /** Call from a pointer or keyboard gesture, never a render/focus effect. */
  cue(kind: MenuCue = 'move') {
    if (
      this.disposed ||
      !this.active ||
      (typeof document !== 'undefined' && document.hidden)
    )
      return
    try {
      if (!this.context) this.initialize()
      this.syncState()
      const now = this.context!.currentTime
      if (kind === 'move' && now - this.lastMove < 0.055) return
      if (kind === 'move') this.lastMove = now
      const pitch = kind === 'confirm' ? 0.78 : kind === 'back' ? 0.63 : 1
      const weight = kind === 'confirm' ? 1.3 : 1
      // Dry steel impact, two inharmonic resonances and a heavy low strike.
      this.strike(1850 * pitch, 0.065, 0.34 * weight, 0, true)
      this.strike(112 * pitch, 0.18, 0.35 * weight, 0, false, 42 * pitch)
      this.strike(510 * pitch, 0.17, 0.1, 0.003, false, 498 * pitch)
      this.strike(817 * pitch, 0.105, 0.055, 0.004, false, 799 * pitch)
      this.strike(
        760 * pitch,
        0.046,
        0.19,
        kind === 'move' ? 0.045 : 0.085,
        true
      )
      if (kind !== 'move') {
        this.strike(67 * pitch, 0.3, 0.19, 0.04, false, 29)
        this.strike(1300 * pitch, 0.08, 0.17, 0.12, true)
      }
    } catch {
      // A disabled or unavailable audio device must not block a menu action.
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', this.visibility)
    this.score?.dispose()
    for (const voice of this.voices) this.release(voice, true)
    for (const node of this.graph) node.disconnect()
    this.graph = []
    void this.context?.close().catch(() => {})
    this.context = undefined
    this.master = this.effects = undefined
    this.noise = undefined
    this.score = undefined
  }
}
