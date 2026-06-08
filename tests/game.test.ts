import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/game/createWorld'
import { chop, createEmptyInput, stepGame } from '../src/game/systems'
import { vec } from '../src/game/math'

const stepSeconds = (state: ReturnType<typeof createWorld>, seconds: number): void => {
  const dt = 1 / 60
  const count = Math.ceil(seconds / dt)
  for (let index = 0; index < count; index += 1) stepGame(state, createEmptyInput(), dt)
}

describe('tree chopping vertical slice', () => {
  it('chops a standing tree into a fallen log', () => {
    const state = createWorld()
    state.player.position = vec(0, 1.2)
    state.player.facing = vec(0, 1)

    chop(state)
    expect(state.trees.find((tree) => tree.id === 'tree-a')?.health).toBe(1)
    chop(state)
    expect(state.trees.find((tree) => tree.id === 'tree-a')?.status).toBe('falling')

    stepSeconds(state, 1.5)
    expect(state.trees.find((tree) => tree.id === 'tree-a')?.status).toBe('fallen')
    expect(state.logs.some((log) => log.id === 'log-tree-a' && log.status === 'whole')).toBe(true)
  })

  it('supports a deterministic cascade reaction', () => {
    const state = createWorld()
    state.player.position = vec(0, 1.2)
    state.player.facing = vec(0, 1)

    chop(state)
    chop(state)
    stepSeconds(state, 0.9)

    expect(state.trees.find((tree) => tree.id === 'tree-b')?.status).toBe('falling')
    expect(state.stats.cascades).toBeGreaterThanOrEqual(1)
  })

  it('splits logs, collects chunks, and upgrades the axe', () => {
    const state = createWorld()

    for (const treeId of ['tree-a', 'tree-b']) {
      const tree = state.trees.find((candidate) => candidate.id === treeId)
      if (!tree) throw new Error(`Missing ${treeId}`)
      tree.status = 'fallen'
      tree.fallDirection = vec(0, 1)
      tree.fallProgress = 1
      stepGame(state, createEmptyInput(), 0.016)
    }

    for (const log of state.logs) {
      state.player.position = { ...log.position }
      chop(state)
      chop(state)
    }

    stepGame(state, createEmptyInput(), 0.016)
    expect(state.wood).toBe(6)
    expect(state.axeLevel).toBe(2)
    expect(state.stats.upgrades).toBe(1)
  })
})
