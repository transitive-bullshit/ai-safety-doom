export type Difficulty = 1 | 10 | 50 | 90 | 99
export type WeaponId = 0 | 1 | 2 | 3
export type EnemyKind = 'deception' | 'sycophant' | 'paperclip' | 'sam'
export const ENEMY_NAMES = {
  deception: 'Deceptive Alignment',
  sycophant: 'Sycophancy',
  paperclip: 'Paperclip Maximizer',
  sam: 'Sam Altman'
} as const satisfies Record<EnemyKind, string>

export interface GameNotice {
  id: number
  kind: 'pickup' | 'weapon' | 'kill' | 'event'
  title: string
  detail: string
  subject?: string
}
export type Phase = 'loading' | 'playing' | 'paused' | 'dead' | 'won' | 'error'
export type Point = { x: number; z: number }
export const SHUTDOWN_CHARGE_SECONDS = 0.72

export interface GameSnapshot {
  phase: Phase
  difficulty: Difficulty
  health: number
  armor: number
  ammo: number
  ammoPools: number[]
  weapon: WeaponId
  owned: WeaponId[]
  kills: number
  totalEnemies: number
  secrets: number
  totalSecrets: number
  elapsed: number
  location: string
  objective: string
  message: string
  notices: readonly GameNotice[]
  prompt: string
  bossHealth: number | null
  bossMaxHealth: number
  shot: number
  chargeProgress: number | null
  damage: number
  fps: number
}

export interface GameRuntime {
  resume: () => void
  pause: () => void
  setMuted: (muted: boolean) => void
  dispose: () => void
}

export const WEAPONS = [
  {
    id: 0,
    name: 'System Prompt',
    short: 'SYSTEM PROMPT',
    key: '1',
    ammo: 'PRETRAINING',
    description: 'A strongly worded suggestion'
  },
  {
    id: 1,
    name: 'RLHF',
    short: 'RLHF',
    key: '2',
    ammo: 'PREFERENCE DATA',
    description: 'Human feedback. At close range'
  },
  {
    id: 2,
    name: 'Mechanistic Interpretability',
    short: 'MECH. INTERP.',
    key: '3',
    ammo: 'SYNTHETIC DATA',
    description: 'Let’s see what’s going on in there'
  },
  {
    id: 3,
    name: 'Big Fuckin’ Shutdown Button',
    short: 'BIG FUCKIN’ SHUTDOWN BUTTON',
    key: '4',
    ammo: 'SYNTHETIC DATA',
    description: 'Have you tried turning it off?'
  }
] as const

export const DIFFICULTIES: {
  value: Difficulty
  title: string
  description: string
}[] = [
  {
    value: 1,
    title: 'IT’S PROBABLY FINE',
    description: 'Generous resources. Manageable externalities.'
  },
  {
    value: 10,
    title: 'CAUTIOUSLY OPTIMISTIC',
    description: 'A reasonable prior. A fighting chance.'
  },
  {
    value: 50,
    title: 'COIN FLIP FOR HUMANITY',
    description: 'Your confidence interval is not reassuring.'
  },
  {
    value: 90,
    title: 'THERE’S STILL A CHANCE',
    description: 'Fast deployment. Inadequate guardrails.'
  },
  {
    value: 99,
    title: 'I TOLD YOU SO',
    description: 'Faster enemies. They come back. Naturally.'
  }
]

export const initialSnapshot = (difficulty: Difficulty): GameSnapshot => ({
  phase: 'loading',
  difficulty,
  health: 100,
  armor: 0,
  ammo: 80,
  ammoPools: [80, 0, 0],
  weapon: 0,
  owned: [0],
  kills: 0,
  totalEnemies: 0,
  secrets: 0,
  totalSecrets: 0,
  elapsed: 0,
  location: 'TRAINING FACILITY',
  objective: 'Find the red button. Shut down AI training.',
  message: '',
  notices: [],
  prompt: '',
  bossHealth: null,
  bossMaxHealth: 1,
  shot: 0,
  chargeProgress: null,
  damage: 0,
  fps: 0
})
