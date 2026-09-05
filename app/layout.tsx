import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: 'P(DOOM) — A reasonable prior. An unreasonable amount of demons.',
  description:
    'They built a god. You brought a shotgun. A Doom-inspired AI safety parody.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>{children}</body>
    </html>
  )
}
