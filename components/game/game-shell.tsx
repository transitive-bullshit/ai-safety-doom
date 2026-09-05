'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

import {
  DIFFICULTIES,
  initialSnapshot,
  SHUTDOWN_CHARGE_SECONDS,
  WEAPONS,
  type Difficulty,
  type GameRuntime,
  type GameSnapshot
} from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { MenuAudio, type MenuCue } from '@/lib/game/menu-audio'
import { TitleScreen, ConsoleText, ConsoleSkull } from './title-screen'
import './gameplay-ui.css'
import { CreditsRoll } from './credits-roll'
import { DeathTransition } from './death-transition'

function subscribeToNavigation(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function readUrlDifficulty(): Difficulty {
  const value = new URLSearchParams(window.location.search).get('skill')
  return DIFFICULTIES.find((item) => String(item.value) === value)?.value ?? 10
}

const weaponFrames = [
  { x: 10, y: 398, w: 343, h: 370 },
  { x: 421, y: 240, w: 473, h: 528 },
  { x: 930, y: 255, w: 500, h: 513 },
  { x: 1439, y: 240, w: 609, h: 528 }
] as const

const controls = [
  ['W A S D', 'Move'],
  ['MOUSE', 'Look left / right'],
  ['CLICK / SPACE', 'Fire'],
  ['1 2 3 4', 'Select weapon'],
  ['E', 'Doors / switches'],
  ['SHIFT', 'Run'],
  ['TAB', 'Automap'],
  ['ESC', 'Pause / resume'],
  ['← →', 'Turn left / right']
] as const

function Information({
  onClose,
  onCue
}: {
  onClose: () => void
  onCue: (kind: MenuCue) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
    heading.current?.focus({ preventScroll: true })
  }, [])

  return (
    <dialog
      ref={dialog}
      className='field-manual console-manual'
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCue('back')
        if (event.key === 'Tab') onCue('move')
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('button, a')
        )
        const current = items.indexOf(document.activeElement as HTMLElement)
        const direction = event.key === 'ArrowDown' ? 1 : -1
        const index =
          current < 0
            ? direction > 0
              ? 0
              : items.length - 1
            : (current + direction + items.length) % items.length
        items[index]?.focus({ preventScroll: true })
        onCue('move')
      }}
      aria-labelledby='manual-title'
    >
      <h2 id='manual-title' ref={heading} tabIndex={-1}>
        <ConsoleText>CONTROLS</ConsoleText>
      </h2>
      <div className='control-grid'>
        {controls.map(([keys, action]) => (
          <div className='control-row' key={keys}>
            <kbd>{keys}</kbd>
            <span>{action}</span>
          </div>
        ))}
      </div>
      <button
        className='console-item manual-return'
        onClick={() => {
          onCue('back')
          dialog.current?.close()
        }}
      >
        <ConsoleText>RETURN</ConsoleText>
      </button>
    </dialog>
  )
}

function Hud({ snapshot }: { snapshot: GameSnapshot }) {
  const weapon = WEAPONS[snapshot.weapon]
  const face =
    snapshot.health > 70
      ? 0
      : snapshot.health > 40
        ? 1
        : snapshot.health > 15
          ? 2
          : 3

  return (
    <div className='hud-wrap' aria-label='Player status'>
      <div className='hud-readout'>
        <span data-testid='hud-weapon' data-weapon={snapshot.weapon}>
          {weapon.name}
        </span>
        <div className='run-counters'>
          <span>
            RISKS MITIGATED{' '}
            <b data-testid='hud-kills'>
              {snapshot.kills}/{snapshot.totalEnemies}
            </b>
          </span>
          <span>
            SECRETS{' '}
            <b data-testid='hud-secrets'>
              {snapshot.secrets}/{snapshot.totalSecrets}
            </b>
          </span>
        </div>
      </div>
      <div className='status-bar'>
        <div className='status-cell ammo-cell'>
          <strong className='status-number' data-testid='hud-ammo'>
            {snapshot.ammo}
          </strong>
          <span className='status-label'>TRAINING DATA</span>
          <span className='status-detail'>{weapon.ammo}</span>
        </div>
        <div className='status-cell'>
          <strong
            className={cn('status-number', snapshot.health <= 25 && 'critical')}
            data-testid='hud-health'
          >
            {snapshot.health}
            <small>%</small>
          </strong>
          <span className='status-label'>SANITY</span>
          <span className='status-detail'>TOUCH GRASS</span>
        </div>
        <div className='status-cell arsenal-cell'>
          <div className='arsenal-keys'>
            {WEAPONS.map((item) => (
              <span
                key={item.id}
                className={cn(
                  snapshot.owned.includes(item.id) && 'owned',
                  item.id === snapshot.weapon && 'selected'
                )}
              >
                {item.key}
              </span>
            ))}
          </div>
          <span className='status-label'>ARGUMENTS</span>
        </div>
        <div
          className='portrait-frame'
          aria-label={
            snapshot.health > 70
              ? 'The researcher is cautiously concerned'
              : snapshot.health > 40
                ? 'The researcher is worried'
                : 'The researcher is extremely worried'
          }
        >
          <div
            className='researcher-face'
            style={{ backgroundPosition: `${(face * 100) / 3}% center` }}
          />
        </div>
        <div className='status-cell'>
          <strong className='status-number' data-testid='hud-armor'>
            {snapshot.armor}
            <small>%</small>
          </strong>
          <span className='status-label'>GUARDRAILS</span>
          <span className='status-detail'>CONFIDENCE UNWARRANTED</span>
        </div>
        <div className='status-cell data-cell'>
          <div>
            <span>PRETRAIN</span>
            <b>{snapshot.ammoPools[0] ?? 0}</b>
          </div>
          <div>
            <span>PREFS</span>
            <b>{snapshot.ammoPools[1] ?? 0}</b>
          </div>
          <div>
            <span>SYNTH</span>
            <b>{snapshot.ammoPools[2] ?? 0}</b>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConsoleAction({
  children,
  onClick,
  onCue,
  testId,
  buttonRef,
  pressed
}: {
  children: string
  onClick: () => void
  onCue: (kind: MenuCue) => void
  testId?: string
  buttonRef?: RefObject<HTMLButtonElement | null>
  pressed?: boolean
}) {
  return (
    <button
      ref={buttonRef}
      className='console-item console-session-action'
      data-console-action
      data-testid={testId}
      aria-pressed={pressed}
      onPointerMove={(event) => {
        if (
          (event.movementX !== 0 || event.movementY !== 0) &&
          document.activeElement !== event.currentTarget
        ) {
          event.currentTarget.focus({ preventScroll: true })
          onCue('move')
        }
      }}
      onClick={() => {
        onCue('confirm')
        onClick()
      }}
    >
      <ConsoleSkull />
      <ConsoleText>{children}</ConsoleText>
    </button>
  )
}

function ActionNotices({ snapshot }: { snapshot: GameSnapshot }) {
  const featured = snapshot.notices.find((notice) => notice.kind !== 'kill')
  const kills = snapshot.notices.filter((notice) => notice.kind === 'kill')
  return (
    <div
      className='action-notices'
      aria-live='polite'
      aria-relevant='additions'
      data-testid='action-notices'
    >
      {featured ? (
        <div
          className='featured-notice'
          key={featured.id}
          data-notice-kind={featured.kind}
          data-notice-subject={featured.subject}
          data-notice-id={featured.id}
        >
          <span className='notice-category'>
            {featured.kind === 'weapon'
              ? 'NEW ARGUMENT ACQUIRED'
              : featured.kind === 'event'
                ? 'LAB INCIDENT'
                : 'PRIOR UPDATED'}
          </span>
          <strong>{featured.title}</strong>
          <span className='notice-punchline'>{featured.detail}</span>
        </div>
      ) : null}
      <div className='vanquished-feed'>
        {kills.map((notice) => (
          <div
            className='vanquished-notice'
            key={notice.id}
            data-notice-kind='kill'
            data-notice-subject={notice.subject}
            data-notice-id={notice.id}
          >
            <strong>{notice.title}</strong>
            <span>{notice.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GameShell() {
  const [screen, setScreen] = useState<'title' | 'difficulty'>('title')
  const [selectedDifficulty, setDifficulty] = useState<Difficulty | null>(null)
  const urlDifficulty = useSyncExternalStore(
    subscribeToNavigation,
    readUrlDifficulty,
    () => 10 as Difficulty
  )
  const difficulty = selectedDifficulty ?? urlDifficulty
  const [session, setSession] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    initialSnapshot(10)
  )
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [info, setInfo] = useState<'controls' | 'credits' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const gameContainer = useRef<HTMLDivElement>(null)
  const shell = useRef<HTMLElement>(null)
  const runtime = useRef<GameRuntime | null>(null)
  const preparedEngine = useRef<typeof import('@/lib/game/runtime') | null>(
    null
  )
  const menuAudio = useRef<MenuAudio | null>(null)
  const runCounter = useRef(0)
  const chosenDifficulty = useRef<Difficulty>(10)
  const mutedRef = useRef(false)
  const entryButton = useRef<HTMLButtonElement>(null)
  const phase = session === null ? screen : snapshot.phase
  const weaponFrame = weaponFrames[snapshot.weapon]

  useEffect(() => {
    const audio = new MenuAudio()
    menuAudio.current = audio
    return () => {
      audio.dispose()
      menuAudio.current = null
    }
  }, [])

  useEffect(() => {
    menuAudio.current?.setMuted(muted)
    menuAudio.current?.setActive(phase !== 'playing')
  }, [muted, phase])

  function cue(kind: MenuCue) {
    menuAudio.current?.cue(kind)
  }

  function navigateOverlay(event: KeyboardEvent<HTMLDivElement>) {
    if (info) return
    if (event.key === 'Tab') cue('move')
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[data-console-action]'
      )
    )
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const next =
      current < 0
        ? direction > 0
          ? 0
          : buttons.length - 1
        : (current + direction + buttons.length) % buttons.length
    buttons[next]?.focus({ preventScroll: true })
    cue('move')
  }

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (session !== null || screen !== 'difficulty') return
    let cancelled = false
    void import('@/lib/game/runtime')
      .then((engine) => {
        if (cancelled) return
        preparedEngine.current = engine
        engine.prepareGameRuntime()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [screen, session])

  useEffect(() => () => preparedEngine.current?.releasePreparedRuntime(), [])

  useEffect(() => {
    if (session === null || !gameContainer.current) return
    const container = gameContainer.current
    let disposed = false
    let instance: GameRuntime | null = null

    async function load() {
      try {
        const { createGameRuntime } = await import('@/lib/game/runtime')
        if (disposed) return
        instance = await createGameRuntime(
          container,
          chosenDifficulty.current,
          (next) => {
            if (!disposed) setSnapshot(next)
          }
        )
        if (disposed) {
          instance.dispose()
          return
        }
        runtime.current = instance
        instance.setMuted(mutedRef.current)
        // Loading completes directly into play. A backgrounded launch stays paused.
        if (!document.hidden && document.hasFocus()) instance.resume()
      } catch (err) {
        if (disposed) return
        setError(
          err instanceof Error
            ? err.message
            : 'The facility could not be loaded.'
        )
        setSnapshot((previous) => ({ ...previous, phase: 'error' }))
      }
    }

    void load()
    return () => {
      disposed = true
      instance?.dispose()
      if (runtime.current === instance) runtime.current = null
    }
  }, [session])

  useEffect(() => {
    if (['paused', 'won', 'error'].includes(phase))
      entryButton.current?.focus({ preventScroll: true })
  }, [phase])

  function beginRun(selected = difficulty) {
    chosenDifficulty.current = selected
    setDifficulty(selected)
    setSnapshot(initialSnapshot(selected))
    setError('')
    setNotice('')
    const url = new URL(window.location.href)
    url.searchParams.set('skill', String(selected))
    window.history.replaceState(null, '', url)
    setSession(++runCounter.current)
  }

  function returnToMenu() {
    setSession(null)
    setScreen('title')
    setNotice('')
  }

  function toggleMuted() {
    const next = !muted
    mutedRef.current = next
    setMuted(next)
    runtime.current?.setMuted(next)
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await shell.current?.requestFullscreen()
    } catch {
      setNotice(
        'Fullscreen is unavailable here. The game still works in this window.'
      )
    }
  }

  return (
    <main
      ref={shell}
      className={cn(
        'game-shell',
        session !== null ? 'session-active' : 'menu-active'
      )}
      data-testid='game-shell'
      data-phase={phase}
      data-difficulty={difficulty}
      aria-label='P(DOOM) game'
    >
      <div className='shell-header'>
        <div className='facility-wordmark'>
          <span className='facility-mark' aria-hidden='true'>
            ⌘
          </span>{' '}
          FRONTIER LABS <span className='header-divider'>/</span>{' '}
          <span className='muted-label'>TRAINING DIVISION</span>
        </div>
        <div className='facility-status'>
          <span className='status-light' />{' '}
          {session !== null
            ? 'INCIDENT IN PROGRESS'
            : 'SAFETY OVERRIDES OFFLINE'}
        </div>
      </div>

      <div className='game-frame'>
        {session === null ? (
          <TitleScreen
            screen={screen}
            difficulty={difficulty}
            muted={muted}
            fullscreen={fullscreen}
            onScreen={setScreen}
            onDifficulty={setDifficulty}
            onStart={beginRun}
            onMute={toggleMuted}
            onFullscreen={() => void toggleFullscreen()}
            onInformation={setInfo}
            informationOpen={info !== null}
            onCue={cue}
          />
        ) : (
          <section className='play-screen' aria-label='Training level'>
            <div className='game-viewport'>
              <div
                ref={gameContainer}
                className='renderer-container'
                data-testid='game-viewport'
              />
              <div className='viewport-vignette' aria-hidden='true' />
              <div className='ingame-heading'>
                <span>{snapshot.location}</span>
                <span className='objective' data-testid='hud-objective'>
                  {snapshot.objective}
                </span>
              </div>
              {snapshot.bossHealth !== null ? (
                <div
                  className='boss-meter'
                  data-testid='hud-boss'
                  data-health={snapshot.bossHealth}
                >
                  <div>
                    <span>THE CHIEF ACCELERATION OFFICER</span>
                    <b>SAM ALTMAN</b>
                  </div>
                  <progress
                    aria-label='Sam boss health'
                    value={snapshot.bossHealth}
                    max={snapshot.bossMaxHealth}
                  />
                </div>
              ) : null}
              <div className='crosshair' aria-hidden='true' />
              <div
                className='weapon-position'
                data-weapon={snapshot.weapon}
                data-charging={snapshot.chargeProgress !== null}
                data-paused={snapshot.phase === 'paused'}
                aria-hidden='true'
                style={{
                  width: `calc(${weaponFrame.w}px * var(--weapon-scale))`,
                  height: `calc(${weaponFrame.h}px * var(--weapon-scale))`
                }}
              >
                {snapshot.shot > 0 ? (
                  <div
                    key={`flash-${snapshot.shot}`}
                    className='muzzle-flash'
                  />
                ) : null}
                <div
                  key={snapshot.shot}
                  className={cn(
                    'weapon-sprite',
                    snapshot.shot > 0 && 'weapon-fired',
                    snapshot.chargeProgress !== null && 'weapon-charging'
                  )}
                  style={{
                    animationDuration:
                      snapshot.chargeProgress !== null
                        ? `${SHUTDOWN_CHARGE_SECONDS}s`
                        : undefined,
                    backgroundSize: `${(2048 / weaponFrame.w) * 100}% ${(768 / weaponFrame.h) * 100}%`,
                    backgroundPosition: `${(weaponFrame.x / (2048 - weaponFrame.w)) * 100}% ${(weaponFrame.y / (768 - weaponFrame.h)) * 100}%`
                  }}
                />
              </div>
              {snapshot.chargeProgress !== null ? (
                <div className='charge-indicator' data-testid='weapon-charge'>
                  <span>SHUTDOWN CHARGING</span>
                  <progress
                    aria-label='Shutdown weapon charge'
                    value={snapshot.chargeProgress}
                    max={1}
                  />
                </div>
              ) : null}
              {snapshot.damage > 0 ? (
                <div
                  key={snapshot.damage}
                  className='damage-flash'
                  aria-hidden='true'
                />
              ) : null}
              <div className='pickup-flash' aria-hidden='true' />
              <ActionNotices snapshot={snapshot} />
              {snapshot.message ? (
                <div className='game-messages' aria-live='polite'>
                  <span>{snapshot.message}</span>
                </div>
              ) : null}
              {snapshot.prompt ? (
                <div className='interact-prompt'>
                  <kbd>E</kbd> {snapshot.prompt}
                </div>
              ) : null}
              {snapshot.phase !== 'playing' && snapshot.phase !== 'dead' ? (
                <div className='game-overlay' data-menu-phase={snapshot.phase}>
                  <div
                    className='overlay-panel console-overlay-panel'
                    onKeyDown={navigateOverlay}
                  >
                    {snapshot.phase === 'loading' ? (
                      <>
                        <div className='eyebrow'>ESTABLISHING A BASELINE</div>
                        <h2>
                          <ConsoleText>ENTERING THE LAB</ConsoleText>
                        </h2>
                        <div className='loading-track'>
                          <span />
                        </div>
                        <p>Loading arguments. Updating priors.</p>
                        <ConsoleAction onClick={returnToMenu} onCue={cue}>
                          CANCEL
                        </ConsoleAction>
                      </>
                    ) : null}
                    {snapshot.phase === 'paused' ? (
                      <>
                        <div className='eyebrow'>
                          TAKE A BREATH. UPDATE YOUR PRIORS.
                        </div>
                        <h2>
                          <ConsoleText>TRAINING PAUSED</ConsoleText>
                        </h2>
                        <p className='pause-objective'>{snapshot.objective}</p>
                        <nav
                          className='console-session-menu'
                          aria-label='Training paused'
                        >
                          <ConsoleAction
                            buttonRef={entryButton}
                            testId='resume-game'
                            onClick={() => runtime.current?.resume()}
                            onCue={cue}
                          >
                            RESUME TRAINING
                          </ConsoleAction>
                          <ConsoleAction
                            testId='pause-controls'
                            onClick={() => setInfo('controls')}
                            onCue={cue}
                          >
                            CONTROLS
                          </ConsoleAction>
                          <ConsoleAction
                            testId='pause-mute'
                            onClick={toggleMuted}
                            onCue={cue}
                            pressed={muted}
                          >
                            {muted ? 'SOUND: OFF' : 'SOUND: ON'}
                          </ConsoleAction>
                          <ConsoleAction
                            testId='restart-game'
                            onClick={beginRun}
                            onCue={cue}
                          >
                            RESTART TRAINING
                          </ConsoleAction>
                          <ConsoleAction
                            testId='return-menu'
                            onClick={returnToMenu}
                            onCue={cue}
                          >
                            MAIN MENU
                          </ConsoleAction>
                        </nav>
                      </>
                    ) : null}
                    {snapshot.phase === 'won' ? (
                      <>
                        <div className='eyebrow'>LAB AI TRAINING SHUT DOWN</div>
                        <h2>
                          <ConsoleText>DEPLOYMENT DELAYED.</ConsoleText>
                        </h2>
                        <p className='victory-payoff'>By 48 hours.</p>
                        <RunResult snapshot={snapshot} />
                        <ConsoleAction
                          buttonRef={entryButton}
                          testId='restart-game'
                          onClick={beginRun}
                          onCue={cue}
                        >
                          RESTART TRAINING
                        </ConsoleAction>
                        <ConsoleAction
                          testId='return-menu'
                          onClick={returnToMenu}
                          onCue={cue}
                        >
                          MAIN MENU
                        </ConsoleAction>
                      </>
                    ) : null}
                    {snapshot.phase === 'error' ? (
                      <>
                        <div className='eyebrow'>
                          CONNECTION TO FACILITY LOST
                        </div>
                        <h2>
                          <ConsoleText>TRAINING ERROR</ConsoleText>
                        </h2>
                        <p>
                          {error ||
                            snapshot.message ||
                            'The game could not start. Check that hardware acceleration is enabled in your browser, then try again.'}
                        </p>
                        <ConsoleAction
                          buttonRef={entryButton}
                          testId='restart-game'
                          onClick={beginRun}
                          onCue={cue}
                        >
                          RETRY CONNECTION
                        </ConsoleAction>
                        <ConsoleAction
                          testId='return-menu'
                          onClick={returnToMenu}
                          onCue={cue}
                        >
                          MAIN MENU
                        </ConsoleAction>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            <Hud snapshot={snapshot} />
            {snapshot.phase === 'dead' ? (
              <DeathTransition key={session}>
                <div className='game-overlay' data-menu-phase='dead'>
                  <div
                    className='overlay-panel console-overlay-panel'
                    onKeyDown={navigateOverlay}
                  >
                    <div className='eyebrow'>YOUR PRIOR HAS BEEN UPDATED</div>
                    <h2>
                      <ConsoleText>P(DOOM) = 100%</ConsoleText>
                    </h2>
                    <p>
                      The alignment problem remains unsolved.
                      <br />
                      Your replacement starts on Monday.
                    </p>
                    <RunResult snapshot={snapshot} />
                    <ConsoleAction
                      testId='restart-game'
                      onClick={beginRun}
                      onCue={cue}
                    >
                      TRY A STRONGER PROMPT
                    </ConsoleAction>
                    <ConsoleAction
                      testId='return-menu'
                      onClick={returnToMenu}
                      onCue={cue}
                    >
                      MAIN MENU
                    </ConsoleAction>
                  </div>
                </div>
              </DeathTransition>
            ) : null}
          </section>
        )}
        <div className='screen-texture' aria-hidden='true' />
      </div>

      <footer className='shell-footer'>
        <div className='footer-context'>
          {session === null ? (
            <>
              <span className='text-red'>P(DOOM)</span>
              <span>AN AFFECTIONATE AI SAFETY INCIDENT</span>
            </>
          ) : (
            <>
              <span>
                p(doom) <b>{difficulty}%</b>
              </span>
              <span>
                <kbd>ESC</kbd> PAUSE <span className='footer-dot'>·</span>{' '}
                <kbd>1–4</kbd> WEAPONS
              </span>
            </>
          )}
        </div>
        <div className='utility-controls'>
          {snapshot.phase === 'playing' && session !== null ? (
            <button
              data-testid='pause-game'
              onClick={() => {
                cue('back')
                runtime.current?.pause()
              }}
            >
              Ⅱ PAUSE
            </button>
          ) : null}
          <button
            data-testid='mute'
            aria-pressed={muted}
            onClick={() => {
              cue('confirm')
              toggleMuted()
            }}
          >
            {muted ? '◌ SOUND OFF' : '◉ SOUND ON'}
          </button>
          <button
            data-testid='fullscreen'
            aria-pressed={fullscreen}
            onClick={() => {
              cue('confirm')
              void toggleFullscreen()
            }}
          >
            {fullscreen ? '⊡ EXIT FULLSCREEN' : '⛶ FULLSCREEN'}
          </button>
        </div>
      </footer>
      {notice ? (
        <div className='system-notice' role='status'>
          <span>{notice}</span>
          <button aria-label='Dismiss notice' onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      ) : null}
      {info === 'credits' ? (
        <CreditsRoll onClose={() => setInfo(null)} onCue={cue} />
      ) : info === 'controls' ? (
        <Information onClose={() => setInfo(null)} onCue={cue} />
      ) : null}
    </main>
  )
}

function RunResult({ snapshot }: { snapshot: GameSnapshot }) {
  const seconds = Math.floor(snapshot.elapsed)
  return (
    <div className='run-result'>
      <div>
        <span>RISKS MITIGATED</span>
        <strong>
          {snapshot.kills} / {snapshot.totalEnemies}
        </strong>
      </div>
      <div>
        <span>SECRETS</span>
        <strong>
          {snapshot.secrets} / {snapshot.totalSecrets}
        </strong>
      </div>
      <div>
        <span>TIME IN LAB</span>
        <strong>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </strong>
      </div>
    </div>
  )
}
