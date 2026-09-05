import type { EnemyKind } from './types'

export type SpriteRect = readonly [
  x: number,
  y: number,
  width: number,
  height: number
]
export interface EnemyArt {
  asset: string
  height: number
  frames: readonly SpriteRect[]
  eyes?: readonly (readonly [x: number, y: number])[]
  cutouts?: readonly {
    frame: number
    x: number
    y: number
    width: number
    height: number
  }[]
}

/** Measured alpha bounds; the generated attack poses intentionally exceed a grid cell. */
export const ENEMY_ART = {
  deception: {
    asset: '/game/enemies-deception-animated.png',
    height: 470,
    frames: [
      [79, 12, 302, 470],
      [600, 12, 314, 481],
      [1114, 13, 326, 483],
      [57, 504, 415, 491],
      [586, 537, 345, 463],
      [1034, 738, 472, 246]
    ]
  },
  sycophant: {
    asset: '/game/enemies-sycophant-animated.png',
    height: 472,
    frames: [
      [57, 9, 399, 472],
      [586, 16, 367, 469],
      [1099, 12, 364, 472],
      [52, 521, 396, 466],
      [515, 521, 506, 482],
      [1033, 724, 479, 242]
    ]
  },
  paperclip: {
    asset: '/game/enemies-paperclip-maximizer.png',
    height: 491,
    frames: [
      [67, 9, 357, 491],
      [518, 10, 427, 491],
      [1130, 10, 380, 491],
      [135, 517, 228, 496],
      [489, 517, 545, 492],
      [1050, 725, 467, 251]
    ]
  },
  sam: {
    asset: '/game/enemies-sam-likeness.png',
    height: 503,
    // The preparation pose crosses the row boundary beside the idle feet.
    cutouts: [
      { frame: 0, x: 430, y: 488, width: 80, height: 20 },
      { frame: 3, x: 70, y: 486, width: 340, height: 20 }
    ],
    frames: [
      [16, 0, 451, 503],
      [545, 5, 445, 500],
      [1081, 6, 420, 499],
      [27, 490, 473, 518],
      [559, 517, 485, 493],
      [1095, 576, 414, 428]
    ]
  }
} as const satisfies Record<EnemyKind, EnemyArt>
