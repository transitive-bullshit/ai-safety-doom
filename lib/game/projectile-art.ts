import { CanvasTexture, NearestFilter, SRGBColorSpace } from 'three'

export type EnemyProjectileArt = 'paperclip' | 'sam'

function polygon(
  context: CanvasRenderingContext2D,
  color: string,
  points: readonly (readonly [number, number])[]
) {
  context.fillStyle = color
  context.beginPath()
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.closePath()
  context.fill()
}

/** Small, shared pixel sprites. Each enemy reads by silhouette, even in shadow. */
export function enemyProjectileTexture(kind: EnemyProjectileArt) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = kind === 'sam' ? 32 : 64
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = false

  if (kind === 'paperclip') {
    const wire = () => {
      context.beginPath()
      context.moveTo(38, 19)
      context.lineTo(38, 41)
      context.bezierCurveTo(38, 47, 30, 47, 30, 41)
      context.lineTo(30, 18)
      context.bezierCurveTo(30, 7, 47, 7, 47, 18)
      context.lineTo(47, 43)
      context.bezierCurveTo(47, 59, 20, 59, 20, 43)
      context.lineTo(20, 20)
    }
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const [width, color] of [
      [9, '#302f34'],
      [6, '#9eaaa9'],
      [3, '#eff3dc']
    ] as const) {
      wire()
      context.lineWidth = width
      context.strokeStyle = color
      context.stroke()
    }
    context.fillStyle = '#fff3ce'
    for (const [x, y] of [
      [9, 33],
      [56, 17],
      [54, 52]
    ] as const) {
      context.fillRect(x - 3, y, 7, 1)
      context.fillRect(x, y - 3, 1, 7)
    }
  } else {
    // Fixed industrial silhouette: exhaust, finned casing, hazard band, steel nose.
    polygon(context, '#813321', [
      [1, 16],
      [15, 8],
      [12, 13],
      [24, 10],
      [24, 23],
      [12, 21],
      [15, 25]
    ])
    polygon(context, '#e76626', [
      [3, 16],
      [18, 11],
      [25, 14],
      [25, 20],
      [14, 21]
    ])
    polygon(context, '#fff0a8', [
      [10, 16],
      [23, 14],
      [26, 17],
      [22, 19]
    ])
    polygon(context, '#302b2b', [
      [20, 6],
      [30, 11],
      [47, 11],
      [61, 16],
      [47, 23],
      [30, 23],
      [20, 28],
      [23, 19],
      [23, 14]
    ])
    polygon(context, '#7f3027', [
      [23, 7],
      [34, 12],
      [30, 15],
      [23, 13]
    ])
    polygon(context, '#62221e', [
      [23, 20],
      [32, 19],
      [34, 22],
      [23, 26]
    ])
    polygon(context, '#c2b9a0', [
      [47, 12],
      [59, 16],
      [47, 21]
    ])
    polygon(context, '#6a655c', [
      [47, 17],
      [59, 16],
      [47, 22]
    ])
    context.fillStyle = '#ab4b35'
    context.fillRect(27, 12, 20, 9)
    context.fillStyle = '#df8b5a'
    context.fillRect(28, 12, 18, 2)
    context.fillStyle = '#713123'
    context.fillRect(27, 19, 20, 3)
    context.fillStyle = '#272729'
    context.fillRect(39, 12, 4, 10)
    context.fillStyle = '#c6a75f'
    context.fillRect(39, 13, 4, 2)
    context.fillRect(39, 18, 4, 2)
    context.fillStyle = '#efddad'
    context.fillRect(29, 15, 2, 2)
    context.fillRect(35, 15, 2, 2)
  }

  const texture = new CanvasTexture(canvas)
  texture.magFilter = texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace
  return texture
}
