export type Vec2 = {
  x: number
  z: number
}

export type WoodType = 'wood' | 'finewood' | 'corewood'
export type Inventory = Record<WoodType, number>

export type TreeKind = 'sapling' | 'normal' | 'veteran' | 'brittle' | 'mythic'
export type TreeStatus = 'standing' | 'falling' | 'fallen'
export type LogStatus = 'falling' | 'landed' | 'split'
export type StationKind = 'tools' | 'depot' | 'upgrades' | 'prestige'
export type SwingPhase = 'idle' | 'windup' | 'recovery'

export type Tree = {
  id: string
  kind: TreeKind
  woodType: WoodType
  position: Vec2
  health: number
  maxHealth: number
  minAxeTier: number
  reward: number
  status: TreeStatus
  fallDirection: Vec2
  fallProgress: number
  fallAngle: number
  angularVelocity: number
  logHealth: number
  logMaxHealth: number
  logVelocity: Vec2
  rollAngle: number
  logAngularVelocity: number
  splitDone: boolean
  splitStage: number
  impactDone: boolean
  impactedTreeIds: string[]
  shakeTimer: number
  shakeDirection: Vec2
  cutProgress: number
  scale: number
  tint: string
  canopy: 'cone' | 'round' | 'wide'
  starter: boolean
}

export type Log = {
  id: string
  treeId: string
  kind: TreeKind
  woodType: WoodType
  position: Vec2
  direction: Vec2
  velocity: Vec2
  health: number
  maxHealth: number
  minAxeTier: number
  reward: number
  status: LogStatus
  fallProgress: number
  rollAngle: number
  angularVelocity: number
  splitDone: boolean
  scale: number
  age: number
}

export type WoodItem = {
  id: string
  type: WoodType
  amount: number
  position: Vec2
  velocity: Vec2
  age: number
  collected: boolean
}

export type Station = {
  id: string
  kind: StationKind
  label: string
  position: Vec2
  accent: string
}

export type Player = {
  position: Vec2
  facing: Vec2
  cameraYaw: number
  speed: number
}

export type GameInput = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  lookDeltaX: number
  chopHeld: boolean
  chopRequests: number
  interactRequests: number
  depositRequests: number
  teleportRequests: number
}

export type SwingState = {
  phase: SwingPhase
  elapsed: number
  queued: boolean
  hitApplied: boolean
  combo: number
  comboTimer: number
  lastTargetId: string | null
}

export type FeedbackEvent = {
  id: number
  kind: 'hit' | 'fall' | 'impact' | 'split' | 'collect' | 'upgrade' | 'deposit' | 'blocked' | 'whiff' | 'prestige'
  label: string
  position: Vec2
  age: number
}

export type GameStats = {
  swings: number
  hits: number
  treesFelled: number
  logsSplit: number
  cascades: number
  pickups: number
  deposits: number
  upgrades: number
  blockedHits: number
}

export type GameState = {
  seed: number
  time: number
  spawn: Vec2
  player: Player
  trees: Tree[]
  logs: Log[]
  woodItems: WoodItem[]
  stations: Station[]
  stockpile: Inventory
  backpack: Inventory
  axeTier: number
  speedTier: number
  luckTier: number
  powerTier: number
  backpackTier: number
  petTier: number
  spirits: number
  swing: SwingState
  feedback: FeedbackEvent[]
  lastEventId: number
  currentTargetId: string | null
  activeStationId: string | null
  message: string
  stats: GameStats
}

export type DebugSnapshot = {
  stockpile: Inventory
  backpack: Inventory
  backpackTotal: number
  backpackCapacity: number
  axeTier: number
  activeStationId: string | null
  currentTargetId: string | null
  standingTrees: number
  fallingTrees: number
  fallenTrees: number
  fallenTrunks: number
  landedLogs: number
  woodItems: number
  player: Vec2
}

export type TreeChoppingTestApi = {
  getState: () => GameState
  getSnapshot: () => DebugSnapshot
  step: (seconds: number) => void
  queueChop: () => void
  queueInteract: () => void
  deposit: () => void
  teleportHome: () => void
  movePlayerTo: (x: number, z: number) => void
  face: (x: number, z: number) => void
  look: (movementX: number) => void
  reset: () => void
}

declare global {
  interface Window {
    __TREE_CHOPPING_TEST__?: TreeChoppingTestApi
  }
}
