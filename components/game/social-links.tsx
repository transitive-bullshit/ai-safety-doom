import type { MenuCue } from '@/lib/game/menu-audio'
import './social-links.css'

const destinations = [
  {
    id: 'x',
    label: 'Travis Fischer on X (opens in a new tab)',
    href: 'https://x.com/transitive_bs',
    path: 'M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l8.2-9.4L.8 2h6.5l4.5 6.8L18.9 2ZM17.8 20h1.7L6.4 3.9H4.6L17.8 20Z'
  },
  {
    id: 'github',
    label: 'P(DOOM) on GitHub (opens in a new tab)',
    href: 'https://github.com/transitive-bullshit/ai-safety-doom',
    path: 'M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.28-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.52 11.52 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.02 12.02 0 0 0 24 12C24 5.37 18.63 0 12 0Z'
  }
]

/** Small embossed marks use the same focus and sound channel as menu actions. */
export function SocialLinks({
  screen,
  onCue
}: {
  screen: 'title' | 'credits'
  onCue: (kind: MenuCue) => void
}) {
  return (
    <nav
      className='console-social-links'
      aria-label='Social links'
      data-testid={`${screen}-social-links`}
    >
      {destinations.map(({ id, label, href, path }) => (
        <a
          key={id}
          className='console-social-link'
          data-menu-item={screen === 'title' ? true : undefined}
          data-credits-action={screen === 'credits' ? true : undefined}
          data-testid={`${screen}-social-${id}`}
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          aria-label={label}
          onPointerMove={(event) => {
            if (
              (event.movementX !== 0 || event.movementY !== 0) &&
              document.activeElement !== event.currentTarget
            ) {
              event.currentTarget.focus({ preventScroll: true })
              onCue('move')
            }
          }}
          onClick={() => onCue('confirm')}
        >
          <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
            <path d={path} />
          </svg>
        </a>
      ))}
    </nav>
  )
}
