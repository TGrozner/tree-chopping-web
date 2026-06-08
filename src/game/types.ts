export type Vec2 = {
  x: number
  z: number
}

export type TreeStatus = 'standing' | 'falling' | 'fallen'
export type LogStatus = 'whole' | 'split'

export type Tree = {
  id: string
  position: Vec2
  health: number
  maxHealth: number
  status: TreeStatus
  fallDirection: Vec2
  fallProgress: number
  impactDone: boolean
}

export type Log = {
  id: string
  position: Vec2
  direction: Vec2
  health: number
  status: LogStatus
}

export type WoodChunk = {
  id: string
  position: Vec2
  collected: boolean
}

export type Player = {
  position: Vec2
  facing: Vec2
  speed: number
}

export type GameInput = {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  chopRequested: boolean
}

export type FeedbackEvent = {
  id: number
  kind: 'chop' | 'fall' | 'impact' | 'collect' | 'upgrade'
  position: Vec2
  age: number
}

export type GameState = {
  seed: number
  time: number
  player: Player
  trees: Tree[]
  logs: Log[]
  chunks: WoodChunk[]
  wood: number
  axeLevel: number
  feedback: FeedbackEvent[]
  lastEventId: number
  currentTargetId: string | null
  stats: {
    chops: number
    treesFelled: number
    cascades: number
    chunksCollected: number
    upgrades: number
  }
}

export type DebugSnapshot = {
  wood: number
  axeLevel: number
  standingTrees: number
  fallingTrees: number
  fallenTrees: number
  logs: number
  chunksAvailable: number
  currentTargetId: string | null
  player: Vec2
}

export type TreeChoppingTestApi = {
  getState: () => GameState
  getSnapshot: () => DebugSnapshot
  step: (seconds: number) => void
  chop: () => void
  movePlayerTo: (x: number, z: number) => void
  face: (x: number, z: number) => void
  reset: () => void
}

declare global {
  interface Window {
    __TREE_CHOPPING_TEST__?: TreeChoppingTestApi
  }
}
