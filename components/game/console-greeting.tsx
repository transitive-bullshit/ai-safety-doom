'use client'

import { useEffect } from 'react'

let greeted = false

/** A page-local guard also handles React's development effect replay. */
export function ConsoleGreeting() {
  useEffect(() => {
    if (greeted) return
    greeted = true
    console.info(String.raw`
██████╗  ██╗██████╗  ██████╗  ██████╗ ███╗   ███╗██╗
██╔══██╗██╔╝██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║╚██╗
██████╔╝██║ ██║  ██║██║   ██║██║   ██║██╔████╔██║ ██║
██╔═══╝ ██║ ██║  ██║██║   ██║██║   ██║██║╚██╔╝██║ ██║
██║     ╚██╗██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║██╔╝
╚═╝      ╚═╝╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═╝

THEY BUILT A GOD. YOU BROUGHT A SHOTGUN.
https://p-doom.transitivebullsh.it
`)
  }, [])
  return null
}
