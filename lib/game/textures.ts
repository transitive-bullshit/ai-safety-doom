import {
  CanvasTexture,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace
} from 'three'

export type Surface =
  | 'stone'
  | 'panel'
  | 'server'
  | 'floor'
  | 'ceiling'
  | 'door'
  | 'tread'

function canvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const context = element.getContext('2d')
  if (!context)
    throw new Error('This browser could not create the game textures.')
  context.imageSmoothingEnabled = false
  return { element, context }
}

function texture(element: HTMLCanvasElement) {
  const result = new CanvasTexture(element)
  result.magFilter = NearestFilter
  result.minFilter = NearestFilter
  result.colorSpace = SRGBColorSpace
  result.wrapS = result.wrapT = RepeatWrapping
  return result
}

export function surfaceTexture(kind: Surface) {
  const { element, context: ctx } = canvas(128, 128)
  const palettes = {
    stone: [67, 65, 48],
    panel: [71, 77, 65],
    server: [27, 33, 31],
    floor: [67, 65, 56],
    ceiling: [45, 47, 39],
    door: [89, 83, 61],
    tread: [141, 140, 131]
  } satisfies Record<Surface, number[]>
  const base = palettes[kind]
  const pixels = ctx.createImageData(128, 128)
  let seed = 91231
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const n = ((seed >>> 16) % 27) - 13
    pixels.data[i] = base[0]! + n
    pixels.data[i + 1] = base[1]! + n
    pixels.data[i + 2] = base[2]! + n
    pixels.data[i + 3] = 255
  }
  ctx.putImageData(pixels, 0, 0)
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  rect(0, 0, 128, 2, '#92907a')
  rect(0, 126, 128, 2, '#181d18')
  rect(0, 0, 2, 128, '#737967')
  rect(126, 0, 2, 128, '#171d18')
  if (kind === 'stone') {
    for (let y = 32; y < 128; y += 32) {
      rect(0, y, 128, 2, '#25291f')
      rect(0, y + 2, 128, 1, '#87866b')
    }
    for (let row = 0; row < 4; row++) {
      rect(row % 2 ? 31 : 63, row * 32, 2, 32, '#292c20')
    }
    rect(0, 112, 128, 11, '#272d25')
    rect(0, 111, 128, 2, '#85856a')
  } else if (kind === 'server') {
    rect(4, 4, 120, 120, '#101816')
    for (let y = 9; y < 116; y += 13) {
      rect(9, y, 110, 10, '#37433a')
      rect(12, y + 2, 68, 6, '#171e1a')
      for (let x = 16; x < 76; x += 5) rect(x, y + 3, 2, 4, '#465147')
      rect(96, y + 3, 4, 3, y % 3 ? '#75af81' : '#d39a55')
      rect(106, y + 3, 4, 3, '#548e9b')
      rect(113, y + 3, 2, 3, '#aad4b7')
    }
  } else if (kind === 'panel' || kind === 'door') {
    rect(9, 8, 110, 111, '#262e29')
    rect(12, 11, 104, 104, kind === 'door' ? '#655f48' : '#535c4e')
    for (const x of [14, 111])
      for (const y of [13, 110]) rect(x, y, 3, 3, '#a2a188')
    if (kind === 'door') {
      for (let x = -10; x < 140; x += 20) {
        ctx.fillStyle = '#b2944a'
        ctx.beginPath()
        ctx.moveTo(x, 10)
        ctx.lineTo(x + 10, 10)
        ctx.lineTo(x + 28, 24)
        ctx.lineTo(x + 18, 24)
        ctx.fill()
      }
      rect(59, 25, 8, 91, '#303a32')
      rect(57, 25, 2, 91, '#aaa182')
      rect(45, 62, 34, 25, '#18211c')
      rect(50, 67, 24, 4, '#87aa75')
      rect(50, 76, 24, 3, '#759568')
    } else {
      rect(18, 18, 92, 3, '#79826b')
      for (let y = 90; y < 106; y += 4) rect(24, y, 79, 2, '#26332a')
      rect(96, 27, 7, 5, '#92b383')
    }
  } else if (kind === 'tread') {
    for (let x = 4; x < 128; x += 8) {
      rect(x, 0, 2, 128, '#585955')
      rect(x + 2, 0, 1, 128, '#b3b1a4')
    }
  } else {
    for (let x = 16; x < 128; x += 16) {
      rect(x, 0, 1, 128, '#42473b')
      rect(0, x, 128, 1, '#343b30')
    }
    for (const x of [7, 118])
      for (const y of [7, 118]) {
        rect(x, y, 3, 3, '#93917a')
        rect(x + 1, y + 1, 2, 2, '#333a30')
      }
  }
  return texture(element)
}

export function signTexture(
  text: string,
  color = '#a2c69d',
  layout: 'standard' | 'headline' = 'standard'
) {
  const { element, context: ctx } = canvas(512, 192)
  const headline = layout === 'headline'
  ctx.fillStyle = headline ? '#222721' : '#101a16'
  ctx.fillRect(0, 0, 512, 192)
  ctx.strokeStyle = headline ? '#71705a' : '#596b50'
  ctx.lineWidth = 7
  ctx.strokeRect(5, 5, 502, 182)
  ctx.fillStyle = color
  ctx.font = 'bold 27px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = text.split('\n')
  if (headline) {
    lines.forEach((line, index) => {
      const size = index === 0 ? 72 : 31
      ctx.font = `bold ${size}px monospace`
      const fittedSize = Math.min(
        size,
        Math.floor((size * 450) / Math.max(1, ctx.measureText(line).width))
      )
      ctx.font = `bold ${fittedSize}px monospace`
      const y = index === 0 ? 76 : 140
      ctx.fillStyle = '#080e0b'
      ctx.fillText(line, 259, y + 3, 450)
      ctx.fillStyle = color
      ctx.fillText(line, 256, y, 450)
    })
    // Chips and rivets make this feel left on the lab wall, not like a HUD label.
    ctx.fillStyle = '#22272199'
    for (let i = 0; i < 90; i++) {
      const x = 28 + ((i * 137) % 456)
      const y = 29 + ((i * 73) % 127)
      ctx.fillRect(x, y, i % 4 === 0 ? 6 : 2, 1)
    }
    for (const x of [16, 490]) {
      for (const y of [16, 169]) {
        ctx.fillStyle = '#0b100d'
        ctx.fillRect(x, y, 7, 7)
        ctx.fillStyle = '#a49e7e'
        ctx.fillRect(x, y, 5, 2)
        ctx.fillRect(x, y, 2, 5)
      }
    }
  } else {
    lines.forEach((line, index) =>
      ctx.fillText(line, 256, 96 + (index - (lines.length - 1) / 2) * 39, 474)
    )
  }
  ctx.fillStyle = '#0c131155'
  for (let y = 0; y < 192; y += 3) ctx.fillRect(0, y, 512, 1)
  return texture(element)
}

export function pickupTexture(
  kind: 'health' | 'armor' | 'ammo' | 'weapon',
  weapon = 0,
  pool = 0
) {
  const { element, context: ctx } = canvas(128, 128)
  ctx.clearRect(0, 0, 128, 128)
  const block = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  if (kind === 'health') {
    block(12, 95, 104, 12, '#614b2c')
    block(16, 106, 96, 6, '#372f21')
    for (let i = 0; i < 30; i++) {
      const x = 14 + ((i * 19) % 99)
      const h = 12 + ((i * 31) % 44)
      block(x, 97 - h, 4, h, ['#69a946', '#a0bf58', '#38623d'][i % 3]!)
      block(x - 3, 96 - h, 3, 7, '#8fba5e')
    }
    block(65, 42, 3, 56, '#467246')
    block(56, 45, 20, 6, '#eee2bc')
    block(63, 38, 6, 21, '#eee2bc')
    block(63, 45, 6, 6, '#e5b459')
  } else if (kind === 'armor') {
    ctx.fillStyle = '#527b55'
    ctx.beginPath()
    ctx.moveTo(24, 24)
    ctx.lineTo(64, 11)
    ctx.lineTo(104, 24)
    ctx.lineTo(96, 83)
    ctx.lineTo(64, 113)
    ctx.lineTo(32, 83)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#b0c78c'
    ctx.lineWidth = 6
    ctx.stroke()
    block(57, 33, 14, 56, '#b8c998')
    block(39, 51, 50, 13, '#b8c998')
  } else if (kind === 'ammo') {
    const accent = ['#d6b471', '#d19b72', '#73c1c0'][pool] ?? '#cbb878'
    block(21, 24, 88, 81, '#444e42')
    block(26, 20, 78, 5, '#a0a68c')
    block(26, 28, 77, 53, '#1e302a')
    block(34, 35, 20, 27, accent)
    for (let i = 0; i < 4; i++) block(62, 37 + i * 7, 32, 3, '#688774')
    block(28, 86, 74, 12, '#bdb18a')
    ctx.fillStyle = '#30372d'
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('TRAINING DATA', 64, 96)
  } else {
    // Hard pixel edges, a dark silhouette, and bright upper bevels keep the
    // floor arsenal legible against the lab's metal and stone textures.
    const ink = '#101513'
    const steel = '#788481'
    const edge = '#c1c9b9'
    const shade = '#394742'
    const brass = '#c59a55'
    const wood = '#945b35'
    const grain = '#d1985f'

    if (weapon === 0) {
      // System Prompt: a compact slide, open trigger guard, and angled grip.
      block(30, 48, 74, 30, ink)
      block(24, 57, 12, 21, ink)
      block(40, 75, 39, 18, ink)
      block(37, 90, 23, 22, ink)
      block(32, 51, 68, 5, edge)
      block(28, 58, 72, 14, steel)
      block(32, 69, 66, 5, shade)
      block(97, 53, 7, 21, shade)
      block(100, 58, 5, 11, '#050909')
      block(40, 44, 8, 5, ink)
      block(87, 44, 7, 5, ink)
      block(68, 57, 18, 9, '#17201c')
      block(70, 58, 13, 3, '#b0bba7')
      for (let x = 35; x <= 52; x += 5) block(x, 58, 2, 10, shade)
      block(42, 77, 17, 17, '#776b4b')
      block(39, 94, 17, 14, '#776b4b')
      block(41, 94, 3, 12, '#b5aa78')
      for (let y = 82; y < 108; y += 5)
        block(y < 94 ? 46 : 43, y, 10, 2, '#414734')
      block(58, 77, 19, 4, steel)
      block(73, 81, 4, 9, steel)
      block(59, 88, 17, 3, shade)
      ctx.clearRect(60, 82, 11, 5)
      block(61, 80, 3, 5, brass)
      block(47, 66, 7, 3, '#93d096')
    } else if (weapon === 1) {
      // RLHF: wood stock, long blued barrel, ribbed pump, and a safety band.
      block(7, 78, 10, 32, ink)
      block(14, 75, 18, 30, ink)
      block(28, 67, 19, 30, ink)
      block(42, 57, 36, 29, ink)
      block(56, 50, 63, 16, ink)
      block(76, 67, 38, 22, ink)
      block(10, 81, 5, 25, '#4a3828')
      block(16, 80, 15, 20, wood)
      block(29, 72, 12, 22, wood)
      block(39, 66, 8, 23, wood)
      block(16, 79, 14, 4, grain)
      block(29, 71, 10, 4, grain)
      block(39, 65, 7, 4, grain)
      block(20, 89, 13, 2, '#613d28')
      block(31, 80, 8, 2, '#c1834a')
      block(30, 91, 9, 2, '#513a29')
      block(45, 60, 31, 20, steel)
      block(45, 60, 30, 3, edge)
      block(45, 77, 31, 5, shade)
      block(57, 53, 58, 9, shade)
      block(58, 53, 57, 3, edge)
      block(113, 50, 8, 16, ink)
      block(115, 54, 5, 9, '#59625a')
      block(114, 46, 4, 5, '#b3bba7')
      block(73, 63, 39, 7, ink)
      block(77, 65, 32, 3, '#93988a')
      block(79, 71, 30, 13, wood)
      block(79, 70, 28, 3, grain)
      for (let x = 82; x < 108; x += 5) block(x, 73, 2, 10, '#4c3627')
      block(62, 59, 8, 22, '#c5a359')
      block(62, 62, 3, 6, '#303a30')
      block(67, 70, 3, 7, '#303a30')
      block(50, 66, 9, 6, '#28342f')
      block(52, 67, 5, 2, '#b1bba9')
      block(46, 82, 19, 11, ink)
      block(48, 83, 15, 3, '#859082')
      block(60, 85, 3, 5, '#859082')
      ctx.clearRect(49, 87, 10, 3)
    } else if (weapon === 2) {
      // Mechanistic Interpretability: three bright coil rings and copper buses.
      block(17, 59, 97, 35, ink)
      block(28, 49, 40, 18, ink)
      block(107, 55, 15, 35, ink)
      block(38, 88, 23, 24, ink)
      block(20, 63, 91, 24, shade)
      block(22, 61, 32, 4, edge)
      block(30, 52, 32, 11, '#778c7e')
      block(32, 52, 28, 3, '#a4baa6')
      block(25, 70, 29, 13, '#172d27')
      block(29, 74, 5, 4, '#9deed9')
      block(34, 73, 7, 2, '#528d79')
      block(40, 77, 8, 3, '#86ccba')
      block(45, 68, 4, 5, '#88cbbb')
      block(45, 78, 9, 2, '#d1ac60')
      block(41, 93, 16, 16, '#765c3e')
      block(41, 93, 4, 14, '#b48d59')
      for (let y = 95; y < 109; y += 4) block(47, y, 9, 2, '#423f2d')
      block(56, 56, 48, 7, '#995e38')
      block(57, 56, 45, 3, '#e3b16d')
      block(57, 86, 48, 6, '#76452f')
      block(58, 85, 45, 2, '#d19053')
      for (let x = 60; x < 104; x += 15) {
        block(x, 45, 12, 46, ink)
        block(x + 2, 44, 8, 6, '#a0aba0')
        block(x + 2, 51, 8, 31, '#238e9c')
        block(x + 2, 52, 3, 28, '#d2fcf5')
        block(x + 5, 52, 3, 28, '#74d9df')
        block(x + 2, 83, 8, 6, '#727e72')
      }
      block(109, 59, 10, 27, steel)
      block(110, 59, 3, 26, '#c3ccb8')
      block(116, 64, 7, 17, '#092420')
      block(119, 68, 4, 9, '#84f3e1')
    } else {
      // A deliberately oversized red shutdown button in a chunky launch body.
      block(16, 62, 96, 39, ink)
      block(10, 73, 12, 23, ink)
      block(29, 96, 24, 17, ink)
      block(98, 63, 23, 29, ink)
      block(20, 64, 87, 29, '#626b42')
      block(20, 64, 78, 4, '#a9b078')
      block(18, 71, 9, 21, '#82905a')
      block(24, 90, 75, 7, '#343e2b')
      block(32, 98, 17, 11, '#766746')
      block(32, 98, 4, 11, '#c3a876')
      block(101, 67, 16, 22, steel)
      block(101, 67, 3, 20, edge)
      block(115, 70, 6, 15, '#273b33')
      block(115, 74, 6, 7, '#91dacf')
      block(43, 40, 56, 50, ink)
      block(47, 43, 48, 44, brass)
      for (let x = 47; x < 95; x += 12) {
        block(x, 43, 6, 5, '#202a22')
        block(x + 5, 82, 6, 5, '#202a22')
      }
      for (let y = 48; y < 82; y += 12) {
        block(47, y, 5, 6, '#202a22')
        block(90, y + 5, 5, 6, '#202a22')
      }
      block(53, 48, 36, 34, '#302a23')
      block(59, 47, 24, 4, '#b6b5a0')
      block(55, 54, 32, 21, '#811e18')
      block(60, 49, 22, 31, '#811e18')
      block(58, 53, 26, 20, '#cf3526')
      block(62, 51, 18, 25, '#cf3526')
      block(61, 54, 18, 7, '#f56942')
      block(64, 53, 12, 3, '#ffb073')
      block(61, 73, 20, 4, '#791b18')
      block(25, 74, 13, 11, '#1d2922')
      block(28, 76, 6, 3, '#c7d888')
      block(29, 83, 8, 2, '#819b62')
      for (const x of [23, 96]) block(x, 90, 3, 3, '#b2b98b')
    }
  }
  return texture(element)
}
