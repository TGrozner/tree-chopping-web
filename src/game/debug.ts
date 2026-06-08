import { backpackCapacity, backpackTotal } from './systems'
import type { DebugSnapshot, GameState } from './types'

export const getDebugSnapshot = (state: GameState): DebugSnapshot => ({
  stockpile: { ...state.stockpile },
  backpack: { ...state.backpack },
  backpackTotal: backpackTotal(state),
  backpackCapacity: backpackCapacity(state),
  axeTier: state.axeTier,
  activeStationId: state.activeStationId,
  currentTargetId: state.currentTargetId,
  standingTrees: state.trees.filter((tree) => tree.status === 'standing').length,
  fallingTrees: state.trees.filter((tree) => tree.status === 'falling').length,
  fallenTrees: state.trees.filter((tree) => tree.status === 'fallen').length,
  fallenTrunks: state.trees.filter((tree) => tree.status === 'fallen' && !tree.splitDone).length,
  landedLogs: state.trees.filter((tree) => tree.status === 'fallen' && !tree.splitDone).length + state.logs.filter((log) => log.status === 'landed' && !log.splitDone).length,
  woodItems: state.woodItems.filter((item) => !item.collected).length,
  player: { ...state.player.position },
})
