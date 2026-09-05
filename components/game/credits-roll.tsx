'use client'

import { useEffect, useRef, useState } from 'react'

import type { MenuCue } from '@/lib/game/menu-audio'
import { ConsoleSkull, ConsoleText } from './title-screen'
import { SocialLinks } from './social-links'
import './credits-roll.css'

const credits = [
  {
    role: 'MADE BY',
    lines: ['TRAVIS FISCHER'],
    href: 'https://x.com/transitive_bs'
  },
  {
    role: 'BUILT WITH',
    lines: ['GPT-6 ASTRA', 'CODEX', 'THREE.JS', 'NEXT.JS']
  },
  {
    role: 'ART & ATMOSPHERE',
    lines: ['AI-GENERATED PARODY ART', 'ORIGINAL SYNTHESIZED SOUND']
  },
  {
    role: 'SHOTGUN RECORDINGS',
    lines: ['MICHORVATH', 'SPRINGYSPRINGO']
  },
  { role: 'PLAYER & BOSS VOICES', lines: ['HAELDB'] },
  { role: 'DOOM MONSTER VOICES', lines: ['ID SOFTWARE'] },
  {
    role: 'IN THE SPIRIT OF',
    lines: ['DOOM 64', 'LATE NIGHTS · LOW RESOLUTIONS']
  },
  { role: 'HUMAN FEEDBACK', lines: ['AT CLOSE RANGE'] },
  {
    role: 'SPECIAL THANKS',
    lines: [
      'THE AI SAFETY COMMUNITY',
      'THE OPTIMISTS · THE DOOMERS',
      'EVERYONE STILL TOUCHING GRASS'
    ]
  },
  {
    role: 'ADDITIONAL PAPERCLIPS',
    lines: ['MORE THAN WAS STRICTLY NECESSARY']
  },
  { role: 'GUARDRAILS INSTALLED', lines: ['CONFIDENCE UNWARRANTED'] },
  {
    role: 'FREE & OPEN SOURCE',
    lines: ['MADE FOR FUN']
  },
  { role: 'NO TRAINING RUN LASTS FOREVER', lines: ['FIND THE SHUTDOWN BUTTON'] }
]

export function CreditsRoll({
  onClose,
  onCue
}: {
  onClose: () => void
  onCue: (kind: MenuCue) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const crawl = useRef<HTMLDivElement>(null)
  const scrollPosition = useRef(0)
  const lastWrittenPosition = useRef(0)
  const playing = useRef(false)
  const endHold = useRef(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
    heading.current?.focus({ preventScroll: true })
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(motion.matches)
    updateMotion()
    motion.addEventListener('change', updateMotion)

    const sizeRoll = () => {
      const strip = crawl.current!
      // Real scroll position makes the scrollbar and assistive navigation work.
      // The opening title is visible at the bottom immediately.
      const start = Math.max(0, viewport.current!.clientHeight - 72)
      strip.style.setProperty('--credits-start', `${start}px`)
      scrollPosition.current = viewport.current!.scrollTop
      lastWrittenPosition.current = viewport.current!.scrollTop
      strip.dataset.ready = 'true'
    }
    const observer = new ResizeObserver(sizeRoll)
    observer.observe(viewport.current!)
    observer.observe(crawl.current!)
    sizeRoll()
    return () => {
      observer.disconnect()
      motion.removeEventListener('change', updateMotion)
    }
  }, [])

  useEffect(() => {
    const reading = viewport.current!
    playing.current = !paused && !reducedMotion
    if (!playing.current) return
    scrollPosition.current = reading.scrollTop
    lastWrittenPosition.current = reading.scrollTop
    endHold.current = 0
    let previousTime = 0
    let frame = 0
    const advance = (time: number) => {
      if (!playing.current) return
      // Native scrolling can arrive before its asynchronous scroll event.
      // Never overwrite a scrollbar drag, keyboard scroll, or focus reveal.
      if (Math.abs(reading.scrollTop - lastWrittenPosition.current) > 0.5) {
        playing.current = false
        setPaused(true)
        return
      }
      const elapsed = previousTime
        ? Math.min((time - previousTime) / 1000, 0.1)
        : 0
      previousTime = time
      const end = reading.scrollHeight - reading.clientHeight
      scrollPosition.current = Math.min(
        end,
        scrollPosition.current + elapsed * 75
      )
      if (scrollPosition.current >= end) {
        // Leave the final credit readable before the next roll begins.
        endHold.current += elapsed
        if (endHold.current >= 3) {
          scrollPosition.current = 0
          endHold.current = 0
        }
      }
      reading.scrollTop = scrollPosition.current
      // Read back the browser's rounded value; keep fractional progress above.
      lastWrittenPosition.current = reading.scrollTop
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
    return () => {
      playing.current = false
      cancelAnimationFrame(frame)
    }
  }, [paused, reducedMotion])

  function pauseForReading() {
    if (reducedMotion) return
    playing.current = false
    setPaused(true)
  }

  function togglePause() {
    if (reducedMotion) return
    onCue('confirm')
    playing.current = false
    setPaused((current) => !current)
  }

  function replay() {
    onCue('confirm')
    viewport.current?.scrollTo({ top: 0, behavior: 'instant' })
    scrollPosition.current = 0
    lastWrittenPosition.current = 0
    endHold.current = 0
  }

  return (
    <dialog
      ref={dialog}
      className='console-credits'
      data-testid='credits-roll'
      aria-labelledby='credits-title'
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCue('back')
        if (event.key === 'Tab') onCue('move')
        if (event.code === 'Space') {
          // Cancel native button activation, including repeated keydowns.
          event.preventDefault()
          if (!event.repeat) togglePause()
          return
        }
        const inReadingArea = viewport.current?.contains(event.target as Node)
        if (
          inReadingArea &&
          [
            'ArrowUp',
            'ArrowDown',
            'PageUp',
            'PageDown',
            'Home',
            'End'
          ].includes(event.key)
        ) {
          pauseForReading()
          return
        }
        if (event.target === viewport.current) return
        if (
          !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
            event.key
          )
        )
          return
        event.preventDefault()
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            '[data-credits-action]:not(:disabled)'
          )
        )
        const current = items.indexOf(document.activeElement as HTMLElement)
        const direction = ['ArrowDown', 'ArrowRight'].includes(event.key)
          ? 1
          : -1
        const index =
          current < 0
            ? direction > 0
              ? 0
              : items.length - 1
            : (current + direction + items.length) % items.length
        items[index]?.focus({ preventScroll: true })
        onCue('move')
      }}
    >
      <div className='credits-shell'>
        <header className='credits-header'>
          <h2 id='credits-title' ref={heading} tabIndex={-1}>
            <ConsoleText>CREDITS</ConsoleText>
          </h2>
          <p>A FRONTIER LAB INCIDENT</p>
        </header>
        <div
          ref={viewport}
          className='credits-viewport'
          data-testid='credits-viewport'
          tabIndex={0}
          aria-label={
            reducedMotion
              ? 'Credits — scroll to read'
              : 'Credits — Space to pause or resume, scroll to read'
          }
          onWheel={pauseForReading}
          onPointerDown={pauseForReading}
          onScroll={() => {
            if (
              Math.abs(
                viewport.current!.scrollTop - lastWrittenPosition.current
              ) > 0.5
            )
              pauseForReading()
          }}
        >
          <div
            ref={crawl}
            className='credits-crawl'
            data-testid='credits-crawl'
            data-paused={paused}
          >
            <div className='credits-opening'>
              <h3>
                <ConsoleText>P(DOOM)</ConsoleText>
              </h3>
              <p>THE ALIGNMENT PROBLEM</p>
            </div>
            {credits.map(({ role, lines, href }) => (
              <section className='credits-block' key={role}>
                <h3>
                  <ConsoleText>{role}</ConsoleText>
                </h3>
                {lines.map((line) => (
                  <p key={line}>
                    {href ? (
                      <a
                        className='credits-author'
                        data-testid='credits-author'
                        href={href}
                        target='_blank'
                        rel='noopener noreferrer'
                        onFocus={pauseForReading}
                      >
                        {line}
                      </a>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </section>
            ))}
            <div className='credits-ending'>
              <h3>
                <ConsoleText>THANK YOU FOR PLAYING</ConsoleText>
              </h3>
              <p>DEPLOYMENT DELAYED</p>
              <p>BY 48 HOURS</p>
              <small>
                An affectionate parody · No endorsement implied
                <br />© 2026 · MIT
              </small>
            </div>
          </div>
        </div>
        <footer className='credits-footer'>
          <p className='credits-reading-hint'>
            {reducedMotion
              ? 'SCROLL TO READ'
              : 'SPACE: PAUSE / RESUME · SCROLL TO READ'}
          </p>
          <nav
            aria-label='Credits controls'
            onPointerMove={(event) => {
              const item = (event.target as HTMLElement).closest<HTMLElement>(
                '[data-credits-action]:not(:disabled)'
              )
              if (
                item &&
                (event.movementX !== 0 || event.movementY !== 0) &&
                document.activeElement !== item
              ) {
                item.focus({ preventScroll: true })
                onCue('move')
              }
            }}
          >
            <button
              className='console-item'
              data-credits-action
              data-testid='credits-pause'
              aria-pressed={paused}
              disabled={reducedMotion}
              onClick={togglePause}
            >
              <ConsoleSkull />
              <ConsoleText>{paused ? 'RESUME' : 'PAUSE'}</ConsoleText>
            </button>
            <button
              className='console-item'
              data-credits-action
              data-testid='credits-replay'
              onClick={replay}
            >
              <ConsoleSkull />
              <ConsoleText>REPLAY</ConsoleText>
            </button>
            <button
              className='console-item'
              data-credits-action
              data-testid='credits-return'
              onClick={() => {
                onCue('back')
                dialog.current?.close()
              }}
            >
              <ConsoleSkull />
              <ConsoleText>RETURN</ConsoleText>
            </button>
          </nav>
        </footer>
      </div>
      <SocialLinks screen='credits' onCue={onCue} />
    </dialog>
  )
}
