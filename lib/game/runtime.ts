import { GameAudio, loadGameAudioAssets } from './audio'
import { sectorAt } from './level'
import { GameWorld } from './model'
import type {
  Difficulty,
  GameRuntime,
  GameSnapshot,
  Phase,
  WeaponId
} from './types'
import { GameView, loadGameAssets } from './view'

async function loadRuntimeAssets() {
  const [images, audio] = await Promise.all([
    loadGameAssets(),
    loadGameAudioAssets()
  ])
  return { images, audio }
}

let preparedAssets: ReturnType<typeof loadRuntimeAssets> | null = null

/** Begin loading while the player chooses a difficulty; transfer ownership once. */
export function prepareGameRuntime() {
  if (preparedAssets) return
  const pending = loadRuntimeAssets()
  preparedAssets = pending
  void pending.catch(() => {
    if (preparedAssets === pending) preparedAssets = null
  })
}

export function releasePreparedRuntime() {
  const pending = preparedAssets
  preparedAssets = null
  void pending?.then(
    ({ images: assets }) => {
      for (const texture of Object.values(assets.enemies)) texture.dispose()
      assets.sky.dispose()
      for (const texture of Object.values(assets.surfaces)) texture.dispose()
    },
    () => {}
  )
}

export async function createGameRuntime(
  container: HTMLElement,
  difficulty: Difficulty,
  onSnapshot: (snapshot: GameSnapshot) => void
): Promise<GameRuntime> {
  const pending = preparedAssets ?? loadRuntimeAssets()
  preparedAssets = null
  const { images: assets, audio: audioAssets } = await pending
  const world = new GameWorld(difficulty)
  let view: GameView
  try {
    view = new GameView(container, world, assets)
  } catch (err) {
    for (const texture of Object.values(assets.enemies)) texture.dispose()
    assets.sky.dispose()
    for (const texture of Object.values(assets.surfaces)) texture.dispose()
    throw err
  }
  const audio = new GameAudio(audioAssets)
  const canvas = view.canvas
  const controller = new AbortController()
  const { signal } = controller
  const keys = new Set<string>()
  let phase: Phase = 'paused'
  let disposed = false
  let firing = false
  let pointerLockPending = false
  let mouseTurn = 0
  let wasLocked = false
  let previous = performance.now()
  let nextSnapshot = 0
  let frame = 0
  let frameCount = 0
  let frameStart = previous
  let fps = 60
  const arrivalCueAt = 1.3 + Math.random() * 0.5
  let arrivalCuePlayed = false

  const emit = () => {
    if (disposed) return
    const snapshot = { ...world.snapshot(), phase, fps }
    canvas.dataset.phase = phase
    canvas.dataset.difficulty = String(difficulty)
    canvas.dataset.fps = String(fps)
    canvas.dataset.shot = String(world.shotCounter)
    canvas.dataset.bossDefeated = String(world.bossDefeated)
    canvas.dataset.barrels = JSON.stringify(world.barrels)
    canvas.dataset.enemies = JSON.stringify(
      world.enemies.map(({ id, x, z, health, kind }) => ({
        id,
        x,
        z,
        health,
        kind
      }))
    )
    canvas.dataset.doors = JSON.stringify(
      world.doors.map(({ id, open, x, z }) => ({ id, open, x, z }))
    )
    canvas.dataset.pickups = JSON.stringify(
      world.pickups
        .filter((pickup) => !pickup.collected)
        .map(({ id, kind, x, z }) => ({ id, kind, x, z }))
    )
    onSnapshot(snapshot)
  }

  const clearInput = () => {
    keys.clear()
    firing = false
    mouseTurn = 0
  }
  const releasePointer = () => {
    if (document.pointerLockElement === canvas) document.exitPointerLock()
  }
  const pause = () => {
    if (disposed || phase !== 'playing') return
    phase = 'paused'
    clearInput()
    audio.pause()
    releasePointer()
    emit()
  }
  const requestPointer = () => {
    pointerLockPending = true
    try {
      const request = canvas.requestPointerLock()
      void request?.catch(() => {
        pointerLockPending = false
        // Keyboard turning and click-drag remain usable when embedding blocks capture.
      })
    } catch {
      pointerLockPending = false
      /* Keyboard input remains available. */
    }
  }
  const resume = () => {
    if (disposed || world.phase !== 'playing') return
    clearInput()
    phase = 'playing'
    previous = performance.now()
    canvas.focus({ preventScroll: true })
    try {
      audio.setWeapon(world.player.weapon)
      audio.resume()
    } catch {
      /* A browser audio failure must not block play. */
    }
    requestPointer()
    emit()
  }
  const keyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      // A nested native dialog owns Escape, and holding the key must not toggle
      // repeatedly as focus moves between the viewport and pause controls.
      if (
        event.repeat ||
        event.defaultPrevented ||
        document.querySelector('dialog[open]') ||
        (phase !== 'playing' && phase !== 'paused')
      )
        return
      event.preventDefault()
      if (phase === 'paused') resume()
      else pause()
      return
    }
    if (phase !== 'playing') return
    const handled = [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'ControlLeft',
      'KeyE',
      'Tab',
      'ShiftLeft',
      'ShiftRight',
      'Digit1',
      'Digit2',
      'Digit3',
      'Digit4'
    ]
    if (!handled.includes(event.code)) return
    event.preventDefault()
    keys.add(event.code)
    if (event.repeat) return
    if (event.code === 'KeyE') world.interact()
    if (event.code === 'Tab') view.toggleMap()
    if (/^Digit[1-4]$/.test(event.code))
      world.selectWeapon((Number(event.code.slice(-1)) - 1) as WeaponId)
    emit()
  }
  window.addEventListener('keydown', keyDown, { signal })
  window.addEventListener('keyup', (event) => keys.delete(event.code), {
    signal
  })
  window.addEventListener('blur', pause, { signal })
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) pause()
    },
    { signal }
  )
  document.addEventListener(
    'pointerlockchange',
    () => {
      const locked = document.pointerLockElement === canvas
      pointerLockPending = false
      // The click that captures the pointer must not remain a held trigger.
      firing = false
      mouseTurn = 0
      if (wasLocked && !locked) pause()
      wasLocked = locked
    },
    { signal }
  )
  document.addEventListener(
    'pointerlockerror',
    () => {
      pointerLockPending = false
    },
    { signal }
  )
  canvas.addEventListener(
    'mousedown',
    (event) => {
      if (phase !== 'playing' || event.button !== 0) return
      firing = true
      if (document.pointerLockElement !== canvas) requestPointer()
    },
    { signal }
  )
  window.addEventListener(
    'mouseup',
    (event) => {
      if ((event.buttons & 1) === 0) firing = false
    },
    { signal, capture: true }
  )
  window.addEventListener(
    'pointercancel',
    () => {
      firing = false
    },
    { signal, capture: true }
  )
  document.addEventListener(
    'mousemove',
    (event) => {
      // Recover if a browser or embedding swallowed mouseup during capture.
      if ((event.buttons & 1) === 0) firing = false
      if (
        phase === 'playing' &&
        (document.pointerLockElement === canvas || firing)
      )
        mouseTurn -= event.movementX * 0.0022
    },
    { signal }
  )
  canvas.addEventListener('contextmenu', (event) => event.preventDefault(), {
    signal
  })
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault()
      pause()
      phase = 'error'
      world.message =
        'The viewport stopped responding. Restart the run to reconnect.'
      emit()
    },
    { signal }
  )

  const loop = (now: number) => {
    if (disposed) return
    const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000))
    previous = now
    if (phase === 'playing') {
      world.step(dt, {
        forward:
          Number(keys.has('KeyW') || keys.has('ArrowUp')) -
          Number(keys.has('KeyS') || keys.has('ArrowDown')),
        strafe: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
        turn:
          mouseTurn +
          (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) *
            dt *
            1.9,
        fire:
          (firing && !pointerLockPending) ||
          keys.has('Space') ||
          keys.has('ControlLeft'),
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight')
      })
      mouseTurn = 0
      let weaponFeedbackChanged = false
      const sector = sectorAt(world.player.x, world.player.z)
      audio.setEnvironment(sector.id, sector.sky)
      audio.setWeapon(world.player.weapon)
      if (
        !arrivalCuePlayed &&
        world.phase === 'playing' &&
        world.time >= arrivalCueAt
      ) {
        arrivalCuePlayed = true
        const nearby = world.enemies
          .filter((enemy) => enemy.health > 0 && enemy.kind !== 'sam')
          .sort(
            (a, b) =>
              Math.hypot(a.x - world.player.x, a.z - world.player.z) -
              Math.hypot(b.x - world.player.x, b.z - world.player.z)
          )
          .slice(0, 3)
        const monster = nearby[Math.floor(Math.random() * nearby.length)]
        if (monster) {
          const dx = monster.x - world.player.x
          const dz = monster.z - world.player.z
          const distance = Math.hypot(dx, dz)
          // A distant vocal establishes the threat without changing awareness
          // or ending the opening grace period. Simulation time respects pause.
          audio.effect('enemy-alert', undefined, {
            kind: monster.kind,
            distance,
            pan:
              distance > 0.01
                ? (dx * Math.cos(world.player.angle) -
                    dz * Math.sin(world.player.angle)) /
                  distance
                : 0
          })
          canvas.dataset.arrivalCue = JSON.stringify({
            kind: monster.kind,
            at: world.time
          })
        }
      }
      for (const event of world.drainEvents()) {
        view.handleEvent(event)
        const dx = event.x === undefined ? 0 : event.x - world.player.x
        const dz = event.z === undefined ? 0 : event.z - world.player.z
        const distance = Math.hypot(dx, dz)
        const pan =
          distance > 0.01
            ? (dx * Math.cos(world.player.angle) -
                dz * Math.sin(world.player.angle)) /
              distance
            : 0
        if (event.type !== 'hit')
          audio.effect(event.type, event.weapon, { ...event, pan, distance })
        if (event.type === 'shot')
          canvas.dataset.shot = String(world.shotCounter)
        if (event.type === 'shot' || event.type === 'charge')
          weaponFeedbackChanged = true
      }
      if (world.phase !== 'playing') {
        phase = world.phase
        clearInput()
        releasePointer()
        audio.finish()
        emit()
      } else if (weaponFeedbackChanged) {
        // Recoil and muzzle flash belong to the shot that just sounded. Keep
        // the ordinary HUD refresh throttled, but never delay a weapon event.
        nextSnapshot = now + 100
        emit()
      }
    }
    view.render(
      phase === 'playing' || phase === 'dead' || phase === 'won' ? dt : 0
    )
    frameCount++
    if (now - frameStart >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - frameStart))
      frameStart = now
      frameCount = 0
    }
    if (now >= nextSnapshot) {
      nextSnapshot = now + 100
      emit()
    }
    frame = requestAnimationFrame(loop)
  }
  view.render(1 / 60)
  emit()
  frame = requestAnimationFrame(loop)
  return {
    resume,
    pause,
    setMuted: (muted) => audio.setMuted(muted),
    dispose: () => {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      controller.abort()
      releasePointer()
      clearInput()
      audio.dispose()
      view.dispose()
    }
  }
}
