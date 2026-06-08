import type { DebugSnapshot, GameState } from './types'

export const getDebugSnapshot = (state: GameState): DebugSnapshot => ({
  wood: state.wood,
  axeLevel: state.axeLevel,
  standingTrees: state.trees.filter((tree) => tree.status === 'standing').length,
  fallingTrees: state.trees.filter((tree) => tree.status === 'falling').length,
  fallenTrees: state.trees.filter((tree) => tree.status === 'fallen').length,
  logs: state.logs.filter((log) => log.status === 'whole').length,
  chunksAvailable: state.chunks.filter((chunk) => !chunk.collected).length,
  currentTargetId: state.currentTargetId,
  player: { ...state.player.position },
})
