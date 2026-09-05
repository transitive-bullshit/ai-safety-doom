import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, KeyboardEventHandler, ReactNode } from 'react'

import {
  SHUTDOWN_FINALE_SECONDS,
  SHUTDOWN_PAYOFF_SECONDS
} from '@/lib/game/types'
import { ConsoleText } from './title-screen'
import './shutdown-transition.css'

const motionQuery = '(prefers-reduced-motion: reduce)'
function subscribeToMotion(onChange: () => void) {
  const preference = window.matchMedia(motionQuery)
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}
const readMotion = () => window.matchMedia(motionQuery).matches

export function ShutdownTransition({
  children,
  onKeyDown
}: {
  children: ReactNode
  onKeyDown: KeyboardEventHandler<HTMLDivElement>
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    readMotion,
    () => false
  )
  const [step, setStep] = useState(0)
  const stage = reducedMotion ? 2 : step
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const start = performance.now()
    const titleAt = SHUTDOWN_FINALE_SECONDS * 1000
    const payoffAt = (SHUTDOWN_FINALE_SECONDS + SHUTDOWN_PAYOFF_SECONDS) * 1000
    const update = () => {
      const elapsed = performance.now() - start
      setStep((previous) =>
        Math.max(previous, elapsed >= payoffAt ? 2 : elapsed >= titleAt ? 1 : 0)
      )
    }
    const titleTimer = window.setTimeout(
      () => setStep((previous) => Math.max(previous, 1)),
      titleAt
    )
    const payoffTimer = window.setTimeout(() => setStep(2), payoffAt)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(titleTimer)
      window.clearTimeout(payoffTimer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  useEffect(() => {
    if (stage === 2)
      menu.current
        ?.querySelector<HTMLButtonElement>('[data-console-action]')
        ?.focus({ preventScroll: true })
  }, [stage])

  return (
    <div
      className='shutdown-transition'
      data-testid='shutdown-transition'
      data-stage={
        stage === 2 ? 'payoff' : stage === 1 ? 'delayed' : 'power-down'
      }
      style={
        {
          '--shutdown-duration': `${SHUTDOWN_FINALE_SECONDS}s`
        } as CSSProperties
      }
      onKeyDownCapture={(event) => {
        if (event.repeat && [' ', 'Enter'].includes(event.key))
          event.preventDefault()
      }}
    >
      <div className='shutdown-veil' aria-hidden='true' />
      <span className='sr-only' role='status'>
        Lab AI training shut down
      </span>
      {stage > 0 ? (
        <div
          className='game-overlay'
          data-menu-phase='won'
          onKeyDown={onKeyDown}
        >
          <div className='overlay-panel console-overlay-panel shutdown-result'>
            <div className='eyebrow'>LAB AI TRAINING SHUT DOWN</div>
            <h2 className='shutdown-title' data-testid='shutdown-title'>
              <ConsoleText>DEPLOYMENT DELAYED</ConsoleText>
            </h2>
            <div className='shutdown-payoff-slot'>
              {stage === 2 ? (
                <p className='victory-payoff' data-testid='shutdown-payoff'>
                  By 48 hours...
                </p>
              ) : null}
            </div>
            <div ref={menu} className='shutdown-actions'>
              {stage === 2 ? children : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
