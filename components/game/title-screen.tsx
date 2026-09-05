'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Image from 'next/image'

import { DIFFICULTIES, type Difficulty } from '@/lib/game/types'
import type { MenuCue } from '@/lib/game/menu-audio'
import { SocialLinks } from './social-links'
import titleBitmaps from './title-bitmaps.json'
import './title-screen.css'

/** A small source bitmap, including its bevel, scales like a console texture. */
export function ConsoleText({ children }: { children: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const titleBitmap = titleBitmaps[children as keyof typeof titleBitmaps]
  useEffect(() => {
    // The first screen ships its final pixels; it never waits for hydration.
    if (titleBitmap) return
    let disposed = false
    const draw = () => {
      if (disposed || !canvas.current) return
      const target = canvas.current
      const ctx = target.getContext('2d')!
      const font = '700 22px "Console Display"'
      ctx.font = font
      const width = Math.ceil(ctx.measureText(children).width) + 8
      target.width = width
      target.height = 32
      ctx.font = font
      ctx.fillStyle = '#fff'
      ctx.fillText(children, 4, 24)
      const mask = ctx.getImageData(0, 0, width, 32)
      const pixels = ctx.createImageData(width, 32)
      const alpha = (x: number, y: number) =>
        x < 0 || x >= width || y < 0 || y >= 32
          ? 0
          : mask.data[(y * width + x) * 4 + 3]!
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          if (alpha(x, y) < 90) {
            // A one-pixel hard extrusion beneath and to the right.
            if (alpha(x - 1, y - 2) > 90) {
              pixels.data.set([32, 12, 10, 255], i)
            }
            continue
          }
          const grain = ((x * 31 + y * 17 + x * y * 3) % 17) - 8
          const light =
            alpha(x, y - 1) < 90 ? 62 : alpha(x, y + 1) < 90 ? -53 : 0
          pixels.data.set(
            [
              Math.max(0, Math.min(255, 186 - y * 2 + light + grain)),
              Math.max(0, 76 - y + light * 0.65 + grain),
              Math.max(0, 53 - y * 0.6 + light * 0.45 + grain),
              255
            ],
            i
          )
        }
      }
      ctx.putImageData(pixels, 0, 0)
      target.style.width = `${width / 24}em`
      target.parentElement!.dataset.ready = 'true'
    }
    void document.fonts.load('700 22px "Console Display"').then(
      (faces) => {
        // A rejected/empty load must leave readable text, not bake a wrong font.
        if (faces.some((face) => face.status === 'loaded')) draw()
      },
      () => {}
    )
    return () => {
      disposed = true
    }
  }, [children, titleBitmap])
  return (
    <span
      className='console-text'
      data-ready={titleBitmap ? 'true' : undefined}
    >
      <span className='sr-only'>{children}</span>
      <span className='console-text-fallback' aria-hidden='true'>
        {children}
      </span>
      {titleBitmap ? (
        <Image
          className='console-text-bitmap'
          src={titleBitmap.uri}
          alt=''
          width={titleBitmap.width}
          height={titleBitmap.height}
          style={{ width: `${titleBitmap.width / 24}em` }}
          loading='eager'
          unoptimized
          draggable={false}
        />
      ) : (
        <canvas ref={canvas} aria-hidden='true' />
      )}
    </span>
  )
}

function TitleAtmosphere() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    const width = 160,
      height = 72
    const heat = new Float32Array(width * height)
    const frame = ctx.createImageData(width, height)
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0,
      last = 0
    const step = () => {
      for (let x = 0; x < width; x++)
        heat[(height - 1) * width + x] = 44 + Math.random() * 18
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width; x++) {
          const below = (y + 1) * width
          heat[y * width + x] = Math.max(
            0,
            (heat[below + ((x + width - 1) % width)]! +
              heat[below + x]! * 2 +
              heat[below + ((x + 1) % width)]!) /
              4 -
              0.4 -
              Math.random() * 1.2
          )
        }
      }
    }
    const paint = () => {
      for (let i = 0; i < heat.length; i++) {
        const value = heat[i]!
        frame.data.set(
          [
            Math.min(180, value * 3),
            Math.max(0, (value - 30) * 2.8),
            Math.max(0, value - 45),
            255
          ],
          i * 4
        )
      }
      ctx.putImageData(frame, 0, 0)
    }
    for (let i = 0; i < 100; i++) step()
    paint()
    const tick = (time: number) => {
      if (time - last > 80) {
        step()
        paint()
        last = time
      }
      if (!motion.matches) request = requestAnimationFrame(tick)
    }
    const updateMotion = () => {
      cancelAnimationFrame(request)
      if (!motion.matches) request = requestAnimationFrame(tick)
    }
    updateMotion()
    motion.addEventListener('change', updateMotion)
    return () => {
      cancelAnimationFrame(request)
      motion.removeEventListener('change', updateMotion)
    }
  }, [])
  return (
    <div className='console-atmosphere' aria-hidden='true'>
      <div className='console-clouds' />
      <canvas ref={canvas} width={160} height={72} />
    </div>
  )
}

export function ConsoleSkull() {
  return (
    <Image
      className='console-skull'
      src='/game/menu-skull-n64.png'
      alt=''
      width={44}
      height={44}
      sizes='48px'
      loading='eager'
      draggable={false}
    />
  )
}

interface TitleScreenProps {
  screen: 'title' | 'difficulty'
  difficulty: Difficulty
  muted: boolean
  fullscreen: boolean
  onScreen: (screen: 'title' | 'difficulty') => void
  onDifficulty: (difficulty: Difficulty) => void
  onStart: (difficulty?: Difficulty) => void
  onMute: () => void
  onFullscreen: () => void
  onInformation: (kind: 'controls' | 'credits') => void
  informationOpen: boolean
  onCue: (kind: MenuCue) => void
}

export function TitleScreen(props: TitleScreenProps) {
  const [options, setOptions] = useState(false)
  const [previewDifficulty, setPreviewDifficulty] = useState(props.difficulty)
  const container = useRef<HTMLElement>(null)
  const previousPage = useRef<string | null>(null)
  const page =
    props.screen === 'difficulty' ? 'difficulty' : options ? 'options' : 'title'

  useEffect(() => {
    if (props.informationOpen) return
    // A closing native dialog restores its opener; keep that selection.
    if (
      previousPage.current === page &&
      container.current?.contains(document.activeElement)
    )
      return
    previousPage.current = page
    const selected = container.current?.querySelector<HTMLElement>(
      '[data-menu-item]:checked'
    )
    const first =
      container.current?.querySelector<HTMLElement>('[data-menu-item]')
    ;(selected ?? first)?.focus({ preventScroll: true })
  }, [page, props.informationOpen])

  function back() {
    if (page === 'difficulty') props.onScreen('title')
    else setOptions(false)
  }

  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (props.informationOpen) return
    if (event.key === 'Escape') {
      event.preventDefault()
      props.onCue('back')
      back()
      return
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      const difficulty = Number(event.target.value) as Difficulty
      props.onDifficulty(difficulty)
      props.onCue('confirm')
      return
    }
    if (event.key === 'Tab') props.onCue('move')
    const direction = ['ArrowDown', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.key)
        ? -1
        : 0
    if (!direction) return
    event.preventDefault()
    const items = Array.from(
      container.current!.querySelectorAll<HTMLElement>('[data-menu-item]')
    )
    const current = items.indexOf(document.activeElement as HTMLElement)
    const index =
      current === -1
        ? direction > 0
          ? 0
          : items.length - 1
        : (current + direction + items.length) % items.length
    const next = items[index]!
    next.focus({ preventScroll: true })
    props.onCue('move')
  }

  function item(
    text: string,
    action: () => void,
    testId?: string,
    pressed?: boolean
  ) {
    return (
      <button
        className='console-item'
        data-menu-item
        data-testid={testId}
        aria-pressed={pressed}
        onFocus={() => {
          if (page === 'difficulty') setPreviewDifficulty(props.difficulty)
        }}
        onPointerMove={(event) => {
          if (
            (event.movementX !== 0 || event.movementY !== 0) &&
            document.activeElement !== event.currentTarget
          ) {
            event.currentTarget.focus({ preventScroll: true })
            props.onCue('move')
          }
        }}
        onClick={() => {
          props.onCue('confirm')
          action()
        }}
      >
        {page !== 'difficulty' ? <ConsoleSkull /> : null}
        <ConsoleText>{text}</ConsoleText>
      </button>
    )
  }

  return (
    <section
      ref={container}
      className='console-screen'
      data-menu-page={page}
      aria-label={
        page === 'title'
          ? 'Main menu'
          : page === 'difficulty'
            ? 'Choose difficulty'
            : 'Options'
      }
      onKeyDown={navigate}
    >
      <TitleAtmosphere />
      <div className='console-safe-area'>
        <header className='console-page-header'>
          <h1 className='console-logo' data-testid='title-logo'>
            <Image
              src='/game/pdoom-logo-n64.png'
              alt='P(DOOM)'
              width={2172}
              height={724}
              sizes='(min-aspect-ratio: 4/3) 110vh, 90vw'
              loading='eager'
              fetchPriority='high'
              draggable={false}
            />
          </h1>
          {page === 'title' ? (
            <p className='console-subtitle'>THE ALIGNMENT PROBLEM</p>
          ) : (
            <h2 className='console-heading'>
              <ConsoleText>
                {page === 'options' ? 'OPTIONS' : 'CHOOSE YOUR P(DOOM)'}
              </ConsoleText>
            </h2>
          )}
        </header>
        <div className='console-page-content'>
          <div className='console-content-stack'>
            {page === 'title' ? (
              <nav className='console-menu' aria-label='Main menu'>
                {item(
                  'START TRAINING RUN',
                  () => props.onScreen('difficulty'),
                  'new-game'
                )}
                {item('OPTIONS', () => setOptions(true), 'menu-options')}
                {item(
                  'CREDITS',
                  () => props.onInformation('credits'),
                  'menu-credits'
                )}
              </nav>
            ) : page === 'options' ? (
              <nav
                className='console-menu console-options'
                aria-label='Options'
              >
                {item(
                  props.muted ? 'SOUND: OFF' : 'SOUND: ON',
                  props.onMute,
                  'menu-mute',
                  props.muted
                )}
                {item(
                  props.fullscreen ? 'FULLSCREEN: ON' : 'FULLSCREEN: OFF',
                  props.onFullscreen,
                  'menu-fullscreen',
                  props.fullscreen
                )}
                {item(
                  'CONTROLS',
                  () => props.onInformation('controls'),
                  'menu-controls'
                )}
                {item('RETURN', back, 'menu-back')}
              </nav>
            ) : (
              <>
                <fieldset className='console-difficulties'>
                  <legend className='sr-only'>Probability of doom</legend>
                  {DIFFICULTIES.map((difficulty) => (
                    <label
                      key={difficulty.value}
                      className='console-difficulty'
                      data-selected={props.difficulty === difficulty.value}
                      onPointerMove={(event) => {
                        const input =
                          event.currentTarget.querySelector('input')!
                        if (
                          (event.movementX !== 0 || event.movementY !== 0) &&
                          document.activeElement !== input
                        ) {
                          input.focus({ preventScroll: true })
                          props.onCue('move')
                        }
                      }}
                    >
                      <input
                        type='radio'
                        name='difficulty'
                        value={difficulty.value}
                        data-menu-item
                        data-testid={`difficulty-${difficulty.value}`}
                        checked={props.difficulty === difficulty.value}
                        onFocus={() => setPreviewDifficulty(difficulty.value)}
                        onClick={() => props.onCue('confirm')}
                        onChange={() => props.onDifficulty(difficulty.value)}
                      />
                      <ConsoleSkull />
                      <span className='console-probability'>
                        <ConsoleText>{`${difficulty.value}%`}</ConsoleText>
                      </span>
                      <ConsoleText>{difficulty.title}</ConsoleText>
                    </label>
                  ))}
                </fieldset>
                <p className='console-difficulty-description'>
                  {
                    DIFFICULTIES.find(
                      (item) => item.value === previewDifficulty
                    )!.description
                  }
                </p>
                <nav
                  className='console-menu console-start'
                  aria-label='Start training run'
                >
                  {item(
                    'START TRAINING RUN',
                    () => props.onStart(),
                    'start-game'
                  )}
                </nav>
              </>
            )}
          </div>
        </div>
        <footer className='console-page-footer'>
          {page === 'title' ? (
            <p className='console-tagline'>
              THEY BUILT A GOD. YOU BROUGHT A SHOTGUN.
            </p>
          ) : null}
          <div className='console-instructions'>
            <span>↑ ↓ BROWSE</span>
            <span>ENTER CONFIRM</span>
            {page !== 'title' ? (
              <button
                onClick={() => {
                  props.onCue('back')
                  back()
                }}
              >
                ESC BACK
              </button>
            ) : (
              <span>KEYBOARD + MOUSE</span>
            )}
          </div>
          <div className='console-edition'>
            A FRONTIER LAB INCIDENT <span>© 2026</span>
          </div>
        </footer>
      </div>
      {page === 'title' ? (
        <SocialLinks screen='title' onCue={props.onCue} />
      ) : null}
    </section>
  )
}
