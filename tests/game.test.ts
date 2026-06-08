import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/game/createWorld'
import { add, normalize, scale, sub, vec } from '../src/game/math'
import { backpackTotal, createEmptyInput, stepGame } from '../src/game/systems'
import type { GameState, Tree } from '../src/game/types'

const stepSeconds = (state: GameState, seconds: number): void => {
  const input = createEmptyInput()
  const dt = 1 / 60
  const count = Math.ceil(seconds / dt)
  for (let index = 0; index < count; index += 1) stepGame(state, input, dt)
}

const swing = (state: GameState, count = 1): void => {
  for (let index = 0; index < count; index += 1) {
    const input = createEmptyInput()
    input.chopRequests = 1
    stepGame(state, input, 1 / 60)
    stepSeconds(state, 0.72)
  }
}

const holdChop = (state: GameState, seconds: number): void => {
  const input = createEmptyInput()
  input.chopHeld = true
  const dt = 1 / 60
  const count = Math.ceil(seconds / dt)
  for (let index = 0; index < count; index += 1) stepGame(state, input, dt)
  input.chopHeld = false
  stepGame(state, input, dt)
}

const standNear = (state: GameState, tree: Tree): void => {
  state.player.position = add(tree.position, vec(-1.7, 0))
  state.player.facing = normalize(sub(tree.position, state.player.position))
  stepGame(state, createEmptyInput(), 1 / 60)
}

const starterTree = (state: GameState): Tree => {
  const tree = state.trees.find((candidate) => candidate.id === 'starter-sapling-000')
  if (!tree) throw new Error('missing starter sapling')
  return tree
}

describe('tree-chopping sbox loop', () => {
  it('starts on a summit hub with stations and a dense starter forest', () => {
    const state = createWorld()
    stepGame(state, createEmptyInput(), 1 / 60)

    expect(state.stations.map((station) => station.kind)).toEqual(['tools', 'depot', 'upgrades', 'prestige'])
    expect(state.trees.length).toBeGreaterThanOrEqual(130)
    expect(state.trees.filter((tree) => tree.starter).length).toBeGreaterThanOrEqual(60)
    expect(state.axeTier).toBe(0)
    expect(state.currentTargetId).toBe('starter-sapling-000')
  })

  it('uses a real swing phase to fell a sapling, roll the fallen tree, split it, and collect backpack wood', () => {
    const state = createWorld()
    const tree = starterTree(state)
    standNear(state, tree)

    swing(state, 3)
    expect(tree.status).toBe('falling')
    expect(tree.fallAngle).toBeGreaterThan(0)
    expect(tree.angularVelocity).toBeGreaterThan(0)
    expect(state.stats.swings).toBe(3)

    stepSeconds(state, 2.1)
    expect(tree.status).toBe('fallen')
    expect(tree.logHealth).toBeGreaterThan(0)
    expect(state.stats.cascades).toBe(0)
    expect(tree.rollAngle).toBeGreaterThan(0)
    expect(state.logs).toHaveLength(0)

    const fallenCenter = add(tree.position, scale(tree.fallDirection, 1.6))
    state.player.position = add(fallenCenter, vec(-1.2, 0))
    state.player.facing = normalize(sub(fallenCenter, state.player.position))
    swing(state, 3)
    expect(tree.splitDone).toBe(true)
    expect(state.woodItems.length).toBeGreaterThan(0)

    stepSeconds(state, 1.4)
    expect(backpackTotal(state)).toBeGreaterThanOrEqual(1)
    expect(state.stockpile.wood).toBe(0)
  })

  it('supports hold-to-chop without repeated input spam', () => {
    const state = createWorld()
    const tree = starterTree(state)
    standNear(state, tree)

    holdChop(state, 2.2)

    expect(state.stats.swings).toBeGreaterThanOrEqual(3)
    expect(state.stats.hits).toBeGreaterThanOrEqual(3)
    expect(tree.status).not.toBe('standing')
  })

  it('keeps swing targeting forgiving when the player is close but not precisely aimed', () => {
    const state = createWorld()
    const tree = starterTree(state)
    state.trees = [tree]
    state.player.position = add(tree.position, vec(0, -2.45))
    state.player.facing = vec(-1, 0)
    stepGame(state, createEmptyInput(), 1 / 60)

    expect(state.currentTargetId).toBe(tree.id)
    swing(state)

    expect(state.stats.hits).toBe(1)
    expect(tree.health).toBeLessThan(tree.maxHealth)
  })

  it('gates harder trees behind the Stone axe tier', () => {
    const state = createWorld()
    const normal = state.trees.find((tree) => !tree.starter && tree.kind === 'normal' && tree.minAxeTier === 1)
    expect(normal).toBeTruthy()
    standNear(state, normal as Tree)

    swing(state, 1)
    expect((normal as Tree).health).toBe((normal as Tree).maxHealth)
    expect(state.stats.blockedHits).toBe(1)
    expect(state.message).toContain('Stone')
  })

  it('deposits backpack wood at the depot and buys the Stone axe at tools', () => {
    const state = createWorld()
    state.backpack.wood = 8
    const depot = state.stations.find((station) => station.kind === 'depot')
    const tools = state.stations.find((station) => station.kind === 'tools')
    if (!depot || !tools) throw new Error('missing shop stations')

    state.player.position = { ...depot.position }
    stepGame(state, createEmptyInput(), 1 / 60)
    const depositInput = createEmptyInput()
    depositInput.interactRequests = 1
    stepGame(state, depositInput, 1 / 60)
    expect(backpackTotal(state)).toBe(0)
    expect(state.stockpile.wood).toBe(8)

    state.player.position = { ...tools.position }
    stepGame(state, createEmptyInput(), 1 / 60)
    const upgradeInput = createEmptyInput()
    upgradeInput.interactRequests = 1
    stepGame(state, upgradeInput, 1 / 60)
    expect(state.axeTier).toBe(1)
    expect(state.stockpile.wood).toBe(0)
  })

  it('keeps R teleport as a hub return instead of a run reset', () => {
    const state = createWorld()
    state.player.position = scale(vec(1, 1), 50)
    const input = createEmptyInput()
    input.teleportRequests = 1
    stepGame(state, input, 1 / 60)

    expect(state.player.position).toEqual(state.spawn)
    expect(state.trees.filter((tree) => tree.status === 'standing').length).toBeGreaterThan(100)
  })
})
