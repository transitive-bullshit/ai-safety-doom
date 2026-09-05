import type { EnemyKind, Point, WeaponId } from './types'

export const CELL = 3.2
export const STEP_HEIGHT = 0.3
export const at = (column: number, row: number): Point => ({
  x: (column + 0.5) * CELL,
  z: (row + 0.5) * CELL
})

export interface Sector {
  id: string
  name: string
  /** Absolute world elevations, measured from the lower staging floor. */
  floor: number
  ceiling: number
  sky: boolean
  wallMaterial: 'stone' | 'panel' | 'server'
  floorMaterial: 'floor' | 'stone'
  light: number
  color: string
}

export interface Decoration extends Point {
  id: string
  kind: 'light' | 'beam' | 'railing' | 'terminal'
  /** Center and dimensions in world units; these details do not block actors. */
  y: number
  width: number
  height: number
  depth: number
  angle: number
  color: string
}

export type PickupKind = 'health' | 'armor' | 'ammo' | 'weapon'
export type PickupDefinition = Point & {
  id: string
  kind: PickupKind
  amount: number
  weapon?: WeaponId
  ammoPool?: number
  ammoName?: string
}

const sectors = {
  staging: {
    id: 'staging',
    name: 'STAGING AREA',
    floor: 0,
    ceiling: 6,
    sky: false,
    wallMaterial: 'panel',
    floorMaterial: 'floor',
    light: 0.77,
    color: '#ba8f79'
  },
  platform: {
    id: 'platform',
    name: 'ARRIVAL PLATFORM',
    floor: 1.5,
    ceiling: 6,
    sky: false,
    wallMaterial: 'panel',
    floorMaterial: 'floor',
    light: 0.88,
    color: '#b5b0a5'
  },
  feedback: {
    id: 'feedback',
    name: 'HUMAN FEEDBACK',
    floor: 0,
    ceiling: 4.3,
    sky: false,
    wallMaterial: 'panel',
    floorMaterial: 'floor',
    light: 0.8,
    color: '#b5a178'
  },
  connector: {
    id: 'connector',
    name: 'CONTAINMENT ACCESS',
    floor: 0,
    ceiling: 4.8,
    sky: false,
    wallMaterial: 'stone',
    floorMaterial: 'stone',
    light: 0.67,
    color: '#b68d78'
  },
  computer: {
    id: 'computer',
    name: 'EVALUATION CHAMBER',
    floor: 0,
    ceiling: 6.6,
    sky: false,
    wallMaterial: 'server',
    floorMaterial: 'floor',
    light: 0.72,
    color: '#84a6aa'
  },
  gallery: {
    id: 'gallery',
    name: 'OBSERVATION GALLERY',
    floor: 1.2,
    ceiling: 6.6,
    sky: false,
    wallMaterial: 'server',
    floorMaterial: 'floor',
    light: 0.84,
    color: '#88b7c0'
  },
  court: {
    id: 'court',
    name: 'THE CONTAINMENT COURT',
    floor: 0,
    ceiling: 10.5,
    sky: true,
    wallMaterial: 'stone',
    floorMaterial: 'stone',
    light: 0.79,
    color: '#aaa6b5'
  },
  overlook: {
    id: 'overlook',
    name: 'OVERSIGHT WALK',
    floor: 1.5,
    ceiling: 6.8,
    sky: false,
    wallMaterial: 'stone',
    floorMaterial: 'floor',
    light: 0.65,
    color: '#a296b0'
  },
  training: {
    id: 'training',
    name: 'THE TRAINING RUN',
    floor: 1.5,
    ceiling: 5.7,
    sky: false,
    wallMaterial: 'server',
    floorMaterial: 'floor',
    light: 0.77,
    color: '#8ca595'
  },
  oversight: {
    id: 'oversight',
    name: 'SAFETY OVERSIGHT',
    floor: 1.5,
    ceiling: 6.3,
    sky: false,
    wallMaterial: 'panel',
    floorMaterial: 'floor',
    light: 0.8,
    color: '#b9a173'
  },
  deployment: {
    id: 'deployment',
    name: 'TRAINING CORE',
    floor: 1.5,
    ceiling: 9.2,
    sky: true,
    wallMaterial: 'stone',
    floorMaterial: 'stone',
    light: 0.8,
    color: '#b48e8d'
  },
  shrine: {
    id: 'shrine',
    name: 'BAYESIAN SHRINE',
    floor: 1.5,
    ceiling: 4.5,
    sky: false,
    wallMaterial: 'stone',
    floorMaterial: 'stone',
    light: 0.66,
    color: '#b594c5'
  },
  heldOut: {
    id: 'held-out',
    name: 'HELD-OUT TEST SET',
    floor: 0,
    ceiling: 4.3,
    sky: false,
    wallMaterial: 'server',
    floorMaterial: 'floor',
    light: 0.82,
    color: '#a7b889'
  }
} satisfies Record<string, Sector>
type SectorId = keyof typeof sectors

const cells = Array.from({ length: 66 }, () => Array<string>(58).fill('#'))
const sectorCells = cells.map((row) => row.map((): Sector => sectors.staging))

function carve(column: number, row: number, sector: SectorId) {
  cells[row]![column] = '.'
  sectorCells[row]![column] = sectors[sector]
}

function room(
  left: number,
  top: number,
  right: number,
  bottom: number,
  sector: SectorId
) {
  for (let z = top; z <= bottom; z++)
    for (let x = left; x <= right; x++) carve(x, z, sector)
}

/** Rasterize authored chamfered outlines; this is a fixed map, not generation. */
function polygon(vertices: [number, number][], sector: SectorId) {
  const left = Math.min(...vertices.map(([x]) => x))
  const right = Math.max(...vertices.map(([x]) => x))
  const top = Math.min(...vertices.map(([, z]) => z))
  const bottom = Math.max(...vertices.map(([, z]) => z))
  for (let z = top; z < bottom; z++) {
    for (let x = left; x < right; x++) {
      let inside = false
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const [ax, az] = vertices[i]!
        const [bx, bz] = vertices[j]!
        if (
          az > z + 0.5 !== bz > z + 0.5 &&
          x + 0.5 < ((bx - ax) * (z + 0.5 - az)) / (bz - az) + ax
        )
          inside = !inside
      }
      if (inside) carve(x, z, sector)
    }
  }
}

function wall(left: number, top: number, right: number, bottom: number) {
  for (let z = top; z <= bottom; z++)
    for (let x = left; x <= right; x++) cells[z]![x] = '#'
}

function elevate(
  left: number,
  top: number,
  right: number,
  bottom: number,
  floor: number
) {
  for (let z = top; z <= bottom; z++)
    for (let x = left; x <= right; x++) {
      if (cells[z]![x] !== '#')
        sectorCells[z]![x] = { ...sectorCells[z]![x]!, floor }
    }
}

function skylight(left: number, top: number, right: number, bottom: number) {
  for (let z = top; z <= bottom; z++)
    for (let x = left; x <= right; x++) {
      if (cells[z]![x] !== '#')
        sectorCells[z]![x] = {
          ...sectorCells[z]![x]!,
          sky: true,
          light: 0.95,
          color: '#b0b1c4'
        }
    }
}

// Staging Area's composition: broad southern arrival lip, a narrower sunken
// chamber, a westward first exit, and a bent connection to the southeast room.
room(25, 42, 30, 49, 'staging')
room(24, 43, 24, 44, 'staging')
room(31, 46, 31, 48, 'staging')
room(23, 50, 31, 53, 'platform')
room(25, 49, 30, 50, 'staging')
elevate(25, 50, 30, 50, 1.5)
for (let step = 1; step <= 4; step++)
  elevate(26, 50 - step, 28, 50 - step, 1.5 - step * STEP_HEIGHT)
// The side of the arrival lip remains a genuine 1.5 m drop. Its stairs return.
elevate(27, 43, 28, 44, 0.15)
skylight(26, 43, 29, 44)
skylight(26, 47, 28, 48)

polygon(
  [
    [19, 43],
    [23, 43],
    [24, 44],
    [24, 48],
    [22, 49],
    [18, 49],
    [17, 47],
    [17, 45]
  ],
  'feedback'
)
room(23, 45, 25, 45, 'feedback')
room(18, 39, 20, 44, 'connector')
room(19, 38, 25, 40, 'connector')
room(25, 39, 29, 40, 'connector')
room(27, 41, 27, 42, 'staging')
// Broad posts make the far aperture readable without a second blocking door.
wall(26, 41, 26, 41)
wall(28, 41, 28, 41)

// U-shaped, stepped-corner access hall around a solid service core.
room(29, 35, 31, 40, 'connector')
room(30, 33, 33, 36, 'connector')
room(32, 32, 34, 34, 'connector')
room(34, 33, 36, 36, 'connector')
room(35, 35, 37, 40, 'connector')
polygon(
  [
    [37, 39],
    [41, 39],
    [44, 36],
    [47, 36],
    [47, 47],
    [45, 50],
    [36, 50],
    [34, 48],
    [34, 42]
  ],
  'computer'
)
room(35, 39, 38, 41, 'computer')
room(41, 33, 46, 36, 'gallery')
room(42, 36, 44, 39, 'computer')
for (let step = 1; step <= 4; step++)
  elevate(42, 40 - step, 44, 40 - step, step * STEP_HEIGHT)
// Server islands divide sight lines; the room is one open, connected volume.
wall(38, 43, 38, 45)
wall(43, 44, 44, 44)
elevate(40, 46, 41, 47, 0.3)

// The upper gallery bends west, then descends into the shared open-sky court.
room(43, 31, 43, 33, 'gallery')
room(36, 29, 44, 30, 'gallery')
room(32, 27, 37, 29, 'gallery')
room(28, 27, 33, 28, 'gallery')
room(27, 28, 29, 31, 'gallery')
for (let step = 1; step <= 4; step++)
  elevate(27, 27 + step, 29, 27 + step, 1.2 - step * STEP_HEIGHT)
polygon(
  [
    [16, 26],
    [19, 23],
    [25, 23],
    [28, 26],
    [28, 31],
    [26, 33],
    [26, 35],
    [20, 37],
    [16, 34],
    [13, 34],
    [13, 29]
  ],
  'court'
)
room(27, 31, 29, 31, 'court')
room(17, 34, 19, 38, 'court')
// A terraced central containment stack is the landmark visible on the return.
elevate(19, 26, 24, 31, 0.3)
elevate(20, 27, 23, 30, 0.6)
wall(21, 28, 22, 29)

// Western service spine and the stacked bays echo the original northern maze.
room(9, 30, 14, 31, 'overlook')
elevate(9, 30, 14, 31, 0)
room(8, 17, 10, 30, 'overlook')
for (let step = 0; step <= 5; step++)
  elevate(8, 30 - step, 10, 30 - step, step * STEP_HEIGHT)
room(8, 4, 10, 18, 'training')
room(3, 2, 10, 5, 'training')
room(3, 7, 7, 9, 'training')
room(4, 11, 7, 13, 'training')
room(3, 15, 7, 17, 'training')
room(11, 6, 15, 8, 'training')
room(11, 10, 15, 12, 'training')
room(11, 14, 15, 17, 'training')
// Narrow openings, offset corners, and solid piers preserve the gallery rhythm.
wall(7, 7, 7, 7)
wall(7, 9, 7, 9)
wall(10, 10, 10, 10)
wall(10, 12, 10, 12)
wall(7, 15, 7, 15)
wall(12, 15, 12, 15)
elevate(3, 2, 10, 3, 2.1)
elevate(3, 4, 10, 4, 1.8)

// A high return walk reconnects the maze to the familiar court by a real ledge.
room(11, 18, 15, 20, 'overlook')
room(13, 20, 15, 28, 'overlook')
// This overlook drops into the court; the western stair is the return route.
room(15, 26, 16, 29, 'overlook')

room(16, 15, 18, 15, 'oversight')
polygon(
  [
    [18, 13],
    [22, 13],
    [25, 16],
    [25, 19],
    [22, 19],
    [20, 17],
    [18, 17]
  ],
  'oversight'
)
room(24, 13, 27, 21, 'oversight')
room(24, 21, 26, 22, 'overlook')
// The southern edge overlooks the hub but cannot be climbed as a shortcut.
wall(24, 17, 24, 17)
wall(26, 19, 26, 19)

// Separate octagonal deployment chamber, with a raised eastern control gallery.
polygon(
  [
    [32, 9],
    [35, 9],
    [39, 13],
    [39, 17],
    [35, 21],
    [32, 21],
    [28, 17],
    [28, 13]
  ],
  'deployment'
)
room(27, 15, 29, 15, 'oversight')
wall(28, 13, 28, 14)
wall(28, 16, 28, 17)
room(35, 11, 35, 14, 'deployment')
for (let step = 1; step <= 4; step++)
  elevate(35, 10 + step, 35, 10 + step, 1.5 + step * STEP_HEIGHT)
elevate(36, 14, 38, 17, 2.7)
wall(31, 13, 31, 13)
wall(35, 18, 35, 18)

// Two optional discoveries preserve the south secret and the eastern annex.
room(26, 54, 29, 55, 'shrine')
room(27, 55, 27, 58, 'shrine')
polygon(
  [
    [26, 58],
    [29, 58],
    [30, 59],
    [30, 61],
    [28, 63],
    [26, 62],
    [25, 60]
  ],
  'shrine'
)
room(47, 39, 50, 39, 'heldOut')
polygon(
  [
    [51, 37],
    [54, 37],
    [55, 38],
    [55, 41],
    [53, 42],
    [50, 41],
    [50, 38]
  ],
  'heldOut'
)
room(49, 39, 51, 39, 'heldOut')

const doorDefinitions = [
  { id: 'containment-gate', column: 24, row: 45, secret: false },
  { id: 'eval-gate', column: 43, row: 31, secret: false },
  { id: 'training-gate', column: 9, row: 24, secret: false },
  { id: 'oversight-gate', column: 17, row: 15, secret: false },
  { id: 'launch-gate', column: 28, row: 15, secret: false },
  { id: 'bayesian-shrine', column: 27, row: 56, secret: true },
  { id: 'held-out-set', column: 49, row: 39, secret: true }
]
wall(8, 24, 8, 24)
wall(10, 24, 10, 24)
wall(24, 44, 24, 44)
wall(24, 46, 24, 46)
for (const door of doorDefinitions)
  cells[door.row]![door.column] = door.secret ? 'S' : 'D'

export function sectorAt(x: number, z: number): Sector {
  return (
    sectorCells[Math.floor(z / CELL)]?.[Math.floor(x / CELL)] ?? sectors.staging
  )
}
export function floorHeight(x: number, z: number) {
  return sectorAt(x, z).floor
}
export function ceilingHeight(x: number, z: number) {
  return sectorAt(x, z).ceiling
}

const enemy = (id: string, kind: EnemyKind, x: number, z: number) => ({
  id,
  kind,
  ...at(x, z)
})
const pickup = (
  id: string,
  kind: PickupKind,
  x: number,
  z: number,
  amount: number,
  options: Pick<PickupDefinition, 'weapon' | 'ammoPool' | 'ammoName'> = {}
): PickupDefinition => ({ id, kind, ...at(x, z), amount, ...options })
const zone = (
  sector: SectorId,
  left: number,
  top: number,
  right: number,
  bottom: number
) => ({
  name: sectors[sector].name,
  color: sectors[sector].color,
  minX: left * CELL,
  maxX: (right + 1) * CELL,
  minZ: top * CELL,
  maxZ: (bottom + 1) * CELL
})
const decoration = (
  id: string,
  kind: Decoration['kind'],
  column: number,
  row: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  color: string,
  angle = 0
): Decoration => ({
  id,
  kind,
  ...at(column, row),
  y,
  width,
  height,
  depth,
  color,
  angle
})

export const LEVEL = {
  grid: cells.map((row) => row.join('')),
  sectors: Object.values(sectors),
  spawn: { ...at(29, 51), angle: 0.18 },
  shutdown: at(37, 16),
  barrels: [
    { id: 'raw-data-staging-a', ...at(30, 43) },
    { id: 'raw-data-staging-b', ...at(30, 44) },
    { id: 'raw-data-eval-a', ...at(45, 47) },
    { id: 'raw-data-eval-b', ...at(44, 48) },
    { id: 'raw-data-court-a', ...at(17, 29) },
    { id: 'raw-data-court-b', ...at(18, 30) },
    { id: 'raw-data-training-a', ...at(4, 3) },
    { id: 'raw-data-training-b', ...at(5, 4) },
    { id: 'raw-data-launch-a', ...at(30, 18) },
    { id: 'raw-data-launch-b', ...at(31, 18) }
  ],
  doors: doorDefinitions.map(({ column, row, ...door }) => ({
    ...door,
    ...at(column, row),
    column,
    row
  })),
  zones: [
    zone('shrine', 25, 54, 30, 63),
    zone('heldOut', 48, 37, 55, 42),
    zone('platform', 23, 50, 31, 53),
    zone('staging', 24, 41, 31, 49),
    zone('feedback', 17, 43, 23, 49),
    zone('gallery', 41, 31, 46, 38),
    zone('computer', 34, 36, 47, 50),
    zone('court', 13, 23, 29, 37),
    zone('training', 3, 2, 15, 17),
    zone('overlook', 8, 18, 15, 31),
    zone('oversight', 16, 12, 27, 22),
    zone('deployment', 28, 9, 39, 21)
  ],
  decorations: [
    decoration(
      'arrival-ledge-light',
      'light',
      29,
      49,
      5.76,
      2.1,
      0.12,
      0.6,
      '#b8c0d8'
    ),
    decoration(
      'staging-crosspiece',
      'beam',
      27,
      45,
      5.67,
      6.1,
      0.42,
      0.9,
      '#7b7774'
    ),
    decoration(
      'staging-skylight-west',
      'light',
      26,
      44,
      5.78,
      1.8,
      0.12,
      0.65,
      '#c5c1d8'
    ),
    decoration(
      'staging-skylight-east',
      'light',
      28,
      44,
      5.78,
      1.8,
      0.12,
      0.65,
      '#c5c1d8'
    ),
    decoration(
      'arrival-ceiling',
      'beam',
      27,
      50,
      5.65,
      17.5,
      0.5,
      0.75,
      '#716152'
    ),
    decoration(
      'feedback-beam',
      'beam',
      20,
      44,
      4.08,
      9.3,
      0.35,
      0.6,
      '#776d57'
    ),
    decoration(
      'feedback-light',
      'light',
      20,
      45,
      4.05,
      1.8,
      0.12,
      0.55,
      '#e2b374'
    ),
    decoration('u-bend-light', 'light', 33, 33, 4.57, 1.6, 0.1, 0.6, '#c19869'),
    decoration('computer-beam', 'beam', 40, 42, 6.35, 20, 0.45, 0.6, '#55787d'),
    decoration(
      'computer-light',
      'light',
      40,
      43,
      6.3,
      2.5,
      0.14,
      0.7,
      '#86d3d4'
    ),
    decoration(
      'gallery-light',
      'light',
      44,
      34,
      6.35,
      1.8,
      0.1,
      0.7,
      '#8bdfe5'
    ),
    decoration('training-light', 'light', 9, 8, 5.47, 1.8, 0.1, 0.6, '#a9c9a8'),
    decoration(
      'training-crosspiece',
      'beam',
      9,
      14,
      5.35,
      8.8,
      0.4,
      0.7,
      '#667765'
    ),
    decoration(
      'oversight-light',
      'light',
      21,
      15,
      6.08,
      1.9,
      0.1,
      0.7,
      '#d9b876'
    ),
    decoration('control-light', 'light', 37, 16, 7.5, 1.3, 0.12, 0.6, '#f0a172')
  ],
  signs: [
    {
      ...at(29, 42),
      z: 42 * CELL + 0.04,
      angle: 0,
      text: 'PHASEONE[big]\nwas here',
      color: '#e5c58a',
      layout: 'headline' as const,
      width: 5.6,
      height: 2.1
    },
    {
      ...at(26, 42),
      z: 42 * CELL + 0.04,
      angle: 0,
      text: 'CONTAINMENT\nIS A MINDSET',
      color: '#efaa64'
    },
    {
      ...at(24, 52),
      x: 23 * CELL + 0.04,
      angle: Math.PI / 2,
      text: 'ALL YOU HAVE IS\nA SYSTEM PROMPT',
      color: '#bec5ae'
    },
    {
      ...at(22, 43),
      z: 43 * CELL + 0.04,
      angle: 0,
      text: 'HUMAN FEEDBACK\nSTRONGLY ENCOURAGED',
      color: '#f2b657'
    },
    {
      ...at(40, 49),
      z: 50 * CELL - 0.04,
      angle: Math.PI,
      text: 'EVALS PASSED*\n*MODEL WROTE EVALS',
      color: '#85d2c6'
    },
    {
      ...at(9, 5),
      x: 11 * CELL - 0.04,
      angle: -Math.PI / 2,
      text: "IT'S ONLY AN INTERNAL EVAL\nWHAT COULD GO WRONG",
      color: '#87dadb'
    },
    {
      ...at(20, 13),
      z: 13 * CELL + 0.04,
      angle: 0,
      text: 'SAFETY OVERSIGHT\nPLEASE INITIAL HERE',
      color: '#d9b569'
    },
    {
      ...at(33, 10),
      z: 9 * CELL + 0.04,
      angle: 0,
      text: 'SHIP FIRST\nALIGN LATER',
      color: '#fa8364'
    },
    {
      ...at(25, 59),
      x: 25 * CELL + 0.04,
      angle: Math.PI / 2,
      text: 'P(H|E) ∝ P(E|H) P(H)\nUPDATE RESPONSIBLY',
      color: '#d6b7f0'
    },
    {
      ...at(54, 39),
      x: 55 * CELL - 0.04,
      angle: -Math.PI / 2,
      text: 'HELD-OUT TEST SET\nANSWER KEY INSIDE',
      color: '#c9da92'
    },
    {
      ...at(21, 35),
      z: 36 * CELL - 0.04,
      angle: Math.PI,
      text: 'GENERALIZATION\nOUTSIDE THE LAB',
      color: '#c0b6d1'
    }
  ],
  enemies: [
    enemy('mask-01', 'deception', 29, 43),
    enemy('yes-01', 'sycophant', 25, 44),
    enemy('clip-01', 'paperclip', 20, 47),
    enemy('yes-02', 'sycophant', 30, 37),
    enemy('mask-02', 'deception', 36, 42),
    enemy('clip-02', 'paperclip', 42, 46),
    enemy('mask-03', 'deception', 44, 34),
    enemy('yes-03', 'sycophant', 33, 28),
    enemy('clip-03', 'paperclip', 25, 32),
    enemy('clip-04', 'paperclip', 18, 28),
    enemy('mask-04', 'deception', 9, 19),
    enemy('yes-04', 'sycophant', 5, 16),
    enemy('mask-05', 'deception', 5, 8),
    enemy('clip-05', 'paperclip', 13, 7),
    enemy('yes-05', 'sycophant', 13, 16),
    enemy('shrine-guard', 'deception', 27, 61),
    enemy('answer-key-guard', 'paperclip', 53, 40),
    enemy('launch-mask', 'deception', 25, 16),
    enemy('launch-yes', 'sycophant', 30, 16),
    enemy('launch-clip', 'paperclip', 35, 11),
    enemy('sam', 'sam', 33, 15)
  ],
  /** Cumulative difficulty roster: first 2 at 50%, first 8 at 90%, all at 99%. */
  reinforcements: [
    enemy('reinforcement-staging-yes', 'sycophant', 30, 47),
    enemy('reinforcement-training-mask', 'deception', 9, 11),
    enemy('reinforcement-feedback-mask', 'deception', 22, 47),
    enemy('reinforcement-eval-clip', 'paperclip', 40, 42),
    enemy('reinforcement-court-yes', 'sycophant', 24, 24),
    enemy('reinforcement-walk-clip', 'paperclip', 14, 22),
    enemy('reinforcement-oversight-mask', 'deception', 22, 16),
    enemy('reinforcement-core-yes', 'sycophant', 34, 13),
    // Nightmare crowds the lower staging chamber and both early approaches.
    enemy('reinforcement-staging-mask-north', 'deception', 26, 43),
    enemy('reinforcement-staging-clip', 'paperclip', 30, 46),
    enemy('reinforcement-staging-yes-west', 'sycophant', 25, 48),
    enemy('reinforcement-staging-mask-east', 'deception', 29, 47),
    enemy('reinforcement-feedback-clip', 'paperclip', 22, 44),
    enemy('reinforcement-feedback-yes-west', 'sycophant', 18, 45),
    enemy('reinforcement-feedback-mask-south', 'deception', 21, 48),
    enemy('reinforcement-access-yes', 'sycophant', 20, 42),
    enemy('reinforcement-access-clip', 'paperclip', 23, 39),
    enemy('reinforcement-access-mask', 'deception', 29, 39),
    // Later encounters occupy level ground beside the route, clear of stairs.
    enemy('reinforcement-connector-yes', 'sycophant', 32, 35),
    enemy('reinforcement-eval-mask-west', 'deception', 36, 44),
    enemy('reinforcement-eval-clip-east', 'paperclip', 45, 41),
    enemy('reinforcement-eval-yes-south', 'sycophant', 42, 49),
    enemy('reinforcement-gallery-mask', 'deception', 42, 34),
    enemy('reinforcement-court-clip-west', 'paperclip', 17, 30),
    enemy('reinforcement-court-yes-south', 'sycophant', 23, 34),
    enemy('reinforcement-court-mask-west', 'deception', 15, 32),
    enemy('reinforcement-spine-clip', 'paperclip', 9, 22),
    enemy('reinforcement-training-yes-west', 'sycophant', 6, 12),
    enemy('reinforcement-training-mask-east', 'deception', 12, 11),
    enemy('reinforcement-training-clip-north', 'paperclip', 9, 6),
    enemy('reinforcement-training-yes-south', 'sycophant', 14, 17),
    enemy('reinforcement-oversight-mask-south', 'deception', 25, 20),
    enemy('reinforcement-core-clip-west', 'paperclip', 32, 17),
    enemy('reinforcement-core-clip-south', 'paperclip', 34, 19),
    enemy('reinforcement-core-yes-north', 'sycophant', 30, 12),
    enemy('reinforcement-return-clip', 'paperclip', 12, 19)
  ],
  pickups: [
    pickup('rlhf', 'weapon', 29, 49, 24, { weapon: 1, ammoPool: 1 }),
    pickup('interp', 'weapon', 21, 45, 110, { weapon: 2, ammoPool: 2 }),
    pickup('opening-grass', 'health', 30, 49, 35),
    pickup('opening-rails', 'armor', 28, 51, 90),
    pickup('opening-data', 'ammo', 29, 45, 8, {
      ammoPool: 1,
      ammoName: 'POSTTRAINING RL'
    }),
    pickup('feedback-data', 'ammo', 19, 46, 20, { ammoPool: 1 }),
    pickup('feedback-grass', 'health', 18, 47, 40),
    pickup('feedback-rails', 'armor', 19, 40, 65),
    pickup('feedback-synthetic', 'ammo', 33, 33, 90, { ammoPool: 2 }),
    pickup('eval-grass', 'health', 36, 47, 45),
    pickup('eval-data', 'ammo', 40, 46, 24, { ammoPool: 1 }),
    pickup('eval-synthetic', 'ammo', 43, 41, 100, { ammoPool: 2 }),
    pickup('training-grass', 'health', 18, 32, 45),
    pickup('training-rails', 'armor', 25, 27, 90),
    pickup('training-data', 'ammo', 5, 7, 140, { ammoPool: 2 }),
    pickup('training-shells', 'ammo', 13, 7, 24, { ammoPool: 1 }),
    pickup('shutdown-button', 'weapon', 21, 15, 140, {
      weapon: 3,
      ammoPool: 2
    }),
    pickup('oversight-grass', 'health', 13, 16, 70),
    pickup('oversight-rails', 'armor', 14, 11, 100),
    pickup('pre-launch-data', 'ammo', 26, 14, 170, { ammoPool: 2 }),
    pickup('launch-grass-west', 'health', 30, 15, 70),
    pickup('launch-grass-east', 'health', 37, 15, 70),
    pickup('launch-rails', 'armor', 32, 19, 100),
    pickup('launch-data-west', 'ammo', 32, 11, 120, { ammoPool: 2 }),
    pickup('launch-data-east', 'ammo', 36, 16, 120, { ammoPool: 2 }),
    pickup('launch-feedback', 'ammo', 34, 18, 36, { ammoPool: 1 }),
    pickup('shrine-rails', 'armor', 27, 60, 100),
    pickup('shrine-grass', 'health', 28, 59, 100),
    pickup('answer-key', 'ammo', 53, 39, 250, { ammoPool: 2 }),
    pickup('answer-grass', 'health', 52, 40, 100)
  ],
  /** The intended main journey; browser tests derive navigation from these points. */
  route: [
    at(28, 51),
    at(27, 50),
    at(27, 49),
    at(27, 48),
    at(27, 47),
    at(27, 46),
    at(29, 49),
    at(26, 45),
    at(23, 45),
    at(21, 45),
    at(19, 40),
    at(25, 39),
    at(30, 37),
    at(33, 33),
    at(36, 37),
    at(36, 46),
    at(43, 41),
    at(43, 39),
    at(43, 38),
    at(43, 37),
    at(43, 36),
    at(43, 32),
    at(43, 30),
    at(36, 29),
    at(32, 28),
    at(29, 28),
    at(29, 29),
    at(29, 30),
    at(29, 31),
    at(25, 32),
    at(18, 32),
    at(12, 31),
    at(9, 30),
    at(9, 29),
    at(9, 28),
    at(9, 27),
    at(9, 26),
    at(9, 25),
    at(9, 19),
    at(9, 14),
    at(5, 7),
    at(13, 7),
    at(14, 11),
    at(13, 16),
    at(18, 15),
    at(21, 15),
    at(26, 14),
    at(30, 15),
    at(33, 18),
    at(32, 11),
    at(35, 11),
    at(35, 12),
    at(35, 13),
    at(35, 14),
    at(37, 16)
  ]
}
