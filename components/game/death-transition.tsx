import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import './death-transition.css'

const revealAfter = 1400
const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

// Overlapping sheets form one heavy mass, with an uneven leading edge.
// Left/width are viewport percentages; only the vertical transform animates.
const bloodColumns = [
  [-5, 17, 0, 980],
  [6, 15, 70, 1020],
  [16, 18, 30, 940],
  [27, 15, 140, 1090],
  [36, 18, 60, 1000],
  [48, 15, 0, 920],
  [57, 18, 110, 1080],
  [69, 16, 40, 970],
  [80, 17, 90, 1030],
  [91, 15, 20, 940]
] as const

function subscribeToReducedMotion(onChange: () => void) {
  const preference = window.matchMedia(reducedMotionQuery)
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}

function readReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches
}

export function DeathTransition({ children }: { children: ReactNode }) {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    readReducedMotion,
    () => false
  )
  const [complete, setComplete] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const revealed = complete || reducedMotion

  useEffect(() => {
    const deadline = performance.now() + revealAfter
    const finish = () => setComplete(true)
    const finishIfElapsed = () => {
      if (performance.now() >= deadline) finish()
    }
    // A deadline, rather than animationend alone, also completes backgrounded runs.
    const timer = window.setTimeout(finish, revealAfter)
    document.addEventListener('visibilitychange', finishIfElapsed)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', finishIfElapsed)
    }
  }, [])

  useEffect(() => {
    if (revealed)
      menu.current
        ?.querySelector<HTMLButtonElement>('[data-console-action]')
        ?.focus({ preventScroll: true })
  }, [revealed])

  return (
    <div
      className='death-transition'
      data-testid='death-transition'
      data-stage={revealed ? 'covered' : 'falling'}
      style={{ '--death-reveal-time': `${revealAfter}ms` } as CSSProperties}
      onKeyDownCapture={(event) => {
        // Holding Fire through the fatal hit must not activate the new Retry button.
        if (event.repeat && [' ', 'Enter'].includes(event.key))
          event.preventDefault()
      }}
    >
      <div className='death-blood' aria-hidden='true'>
        <div className='death-blood-columns'>
          {bloodColumns.map(([left, width, delay, duration], index) => (
            <div
              className='death-blood-column'
              key={index}
              style={
                {
                  left: `${left}%`,
                  width: `${width}%`,
                  '--blood-delay': `${delay}ms`,
                  '--blood-duration': `${duration}ms`,
                  '--blood-grain-offset': `${index * 73}px`
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className='death-blood-shadow' />
      </div>
      <span className='sr-only' role='status'>
        Training run ended
      </span>
      {revealed ? (
        <div ref={menu} className='death-menu'>
          {children}
        </div>
      ) : null}
    </div>
  )
}
