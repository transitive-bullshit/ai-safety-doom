import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { ConsoleGreeting } from '@/components/game/console-greeting'

import './console-font.css'
import './globals.css'

const title = 'P(DOOM) — The Alignment Problem'
const description =
  'They built a god. You brought a shotgun. A free, Doom 64-inspired AI safety parody. Fight deceptive alignment and shut down the training run.'

export const metadata: Metadata = {
  metadataBase: new URL('https://p-doom.transitivebullsh.it'),
  title,
  description,
  alternates: { canonical: '/' },
  openGraph: {
    title,
    description,
    url: '/',
    siteName: 'P(DOOM)',
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    creator: '@transitive_bs'
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <ConsoleGreeting />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
