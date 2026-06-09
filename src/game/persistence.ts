import { createWorld } from './createWorld'
import type { GameState, Inventory, SwingState, Vec2 } from './types'

export const SAVE_KEY = 'tree-chopping-web:save:v1'
const SAVE_VERSION = 1

type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type SavePayload = {
  version: number
  savedAt: number
  state: GameState
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const inventory = (value: unknown, fallback: Inventory): Inventory => {
  if (!isRecord(value)) return { ...fallback }
  return {
    wood: typeof value.wood === 'number' ? value.wood : fallback.wood,
    finewood: typeof value.finewood === 'number' ? value.finewood : fallback.finewood,
    corewood: typeof value.corewood === 'number' ? value.corewood : fallback.corewood,
  }
}

const vec2 = (value: unknown, fallback: Vec2): Vec2 => {
  if (!isRecord(value)) return { ...fallback }
  return {
    x: typeof value.x === 'number' ? value.x : fallback.x,
    z: typeof value.z === 'number' ? value.z : fallback.z,
  }
}

const sanitizeSwing = (fallback: SwingState): SwingState => ({
  ...fallback,
  phase: 'idle',
  elapsed: 0,
  queued: false,
  hitApplied: false,
  comboTimer: 0,
})

export const sanitizeLoadedState = (candidate: unknown): GameState | null => {
  if (!isRecord(candidate)) return null
  const seed = typeof candidate.seed === 'number' ? candidate.seed : undefined
  const fallback = createWorld(seed)
  const state = candidate as Partial<GameState>
  return {
    ...fallback,
    ...state,
    seed: seed ?? fallback.seed,
    spawn: vec2(state.spawn, fallback.spawn),
    player: {
      ...fallback.player,
      ...(isRecord(state.player) ? state.player : {}),
      position: vec2(isRecord(state.player) ? state.player.position : undefined, fallback.player.position),
      facing: vec2(isRecord(state.player) ? state.player.facing : undefined, fallback.player.facing),
      speed: 0,
    },
    trees: Array.isArray(state.trees) ? state.trees : fallback.trees,
    logs: Array.isArray(state.logs) ? state.logs : fallback.logs,
    woodItems: Array.isArray(state.woodItems) ? state.woodItems : fallback.woodItems,
    stations: Array.isArray(state.stations) ? state.stations : fallback.stations,
    stockpile: inventory(state.stockpile, fallback.stockpile),
    backpack: inventory(state.backpack, fallback.backpack),
    swing: sanitizeSwing(fallback.swing),
    feedback: [],
    currentTargetId: null,
    currentSwingTargetIds: [],
    activeStationId: null,
    message: 'Progress loaded.',
  }
}

export const loadGameState = (storage: SaveStorage | null | undefined): GameState | null => {
  if (!storage) return null
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as unknown
    if (!isRecord(payload) || payload.version !== SAVE_VERSION) return null
    return sanitizeLoadedState(payload.state)
  } catch {
    return null
  }
}

export const saveGameState = (storage: SaveStorage | null | undefined, state: GameState): boolean => {
  if (!storage) return false
  try {
    const payload: SavePayload = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state: sanitizeLoadedState(state) ?? createWorld(state.seed),
    }
    storage.setItem(SAVE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export const removeGameState = (storage: SaveStorage | null | undefined): void => {
  try {
    storage?.removeItem(SAVE_KEY)
  } catch {
    // Ignore storage failures: reset should still work in memory.
  }
}
