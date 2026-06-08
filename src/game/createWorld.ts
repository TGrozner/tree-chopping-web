import { normalize, vec } from './math'
import type { GameState, Tree } from './types'

const tree = (id: string, x: number, z: number, health: number): Tree => ({
  id,
  position: vec(x, z),
  health,
  maxHealth: health,
  status: 'standing',
  fallDirection: vec(0, 1),
  fallProgress: 0,
  impactDone: false,
})

export const createWorld = (seed = 42): GameState => {
  const trees: Tree[] = [
    tree('tree-a', 0, 3.2, 2),
    tree('tree-b', 0, 8.6, 2),
    tree('tree-c', -4.6, 6.2, 3),
    tree('tree-d', 4.8, 6.6, 3),
    tree('tree-e', -8.4, -1.4, 3),
    tree('tree-f', 7.6, -2.4, 4),
    tree('tree-g', -2.5, -6.8, 2),
    tree('tree-h', 3.6, -7.4, 2),
    tree('tree-i', -8.8, 10.8, 4),
    tree('tree-j', 8.2, 11.4, 4),
  ]

  return {
    seed,
    time: 0,
    player: {
      position: vec(0, 0),
      facing: normalize(vec(0, 1)),
      speed: 0,
    },
    trees,
    logs: [],
    chunks: [],
    wood: 0,
    axeLevel: 1,
    feedback: [],
    lastEventId: 0,
    currentTargetId: null,
    stats: {
      chops: 0,
      treesFelled: 0,
      cascades: 0,
      chunksCollected: 0,
      upgrades: 0,
    },
  }
}
