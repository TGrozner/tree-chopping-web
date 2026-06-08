import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/game/createWorld'
import { add, normalize, scale, sub, vec } from '../src/game/math'
import { backpackTotal, createEmptyInput, stepGame } from '../src/game/systems'
import { TUNABLES } from '../src/game/tunables'
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
    expect(state.stats.cascades).toBeGreaterThanOrEqual(1)
    expect(state.trees.filter((candidate) => candidate.status !== 'standing').length).toBeGreaterThan(1)
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

  it('moves forward relative to the mouse-controlled camera yaw', () => {
    const state = createWorld()
    const look = createEmptyInput()
    look.lookDeltaX = 360
    stepGame(state, look, 1 / 60)
    expect(state.player.cameraYaw).toBeGreaterThan(1)

    const start = { ...state.player.position }
    const move = createEmptyInput()
    move.up = true
    for (let index = 0; index < 24; index += 1) stepGame(state, move, 1 / 60)

    expect(state.player.position.z - start.z).toBeGreaterThan(2)
  })

  it('lets rolling fallen trunks impact standing trees', () => {
    const state = createWorld()
    const source = starterTree(state)
    const target = state.trees.find((tree) => tree.id === 'starter-sapling-001')
    if (!target) throw new Error('missing neighboring sapling')

    state.trees = [source, target]
    source.position = vec(0, 0)
    source.status = 'fallen'
    source.fallDirection = vec(1, 0)
    source.fallAngle = TUNABLES.treeGroundAngle
    source.logHealth = 2
    source.logMaxHealth = 2
    source.logVelocity = vec(0, 3.6)
    source.logAngularVelocity = 8
    source.impactedTreeIds = []
    target.position = vec(2.6, 0.45)

    stepGame(state, createEmptyInput(), 1 / 60)

    expect(state.stats.cascades).toBeGreaterThanOrEqual(1)
    expect(target.status).toBe('falling')
    expect(source.logVelocity.z).toBeLessThan(3.6)
  })

  it('lets axe hits kick fallen trunks into new cascade impacts', () => {
    const state = createWorld()
    const source = starterTree(state)
    const target = state.trees.find((tree) => tree.id === 'starter-sapling-001')
    if (!target) throw new Error('missing neighboring sapling')

    state.trees = [source, target]
    source.position = vec(0, 0)
    source.status = 'fallen'
    source.fallDirection = vec(1, 0)
    source.fallAngle = TUNABLES.treeGroundAngle
    source.logHealth = 6
    source.logMaxHealth = 6
    source.logVelocity = vec(0, 0)
    source.logAngularVelocity = 0
    source.impactedTreeIds = []
    target.position = vec(2.35, 0.62)
    state.player.position = vec(2.35, -1.15)
    state.player.facing = vec(0, 1)
    stepGame(state, createEmptyInput(), 1 / 60)

    swing(state)

    expect(source.logVelocity.z).toBeGreaterThan(1)
    expect(source.logAngularVelocity).not.toBe(0)
    expect(state.stats.cascades).toBeGreaterThanOrEqual(1)
    expect(target.status).toBe('falling')
  })

  it('splits larger trunks into chopable half-logs before wood items', () => {
    const state = createWorld()
    const tree = state.trees.find((candidate) => candidate.kind === 'normal')
    if (!tree) throw new Error('missing normal tree')
    state.trees = [tree]
    tree.position = vec(0, 0)
    tree.status = 'fallen'
    tree.fallDirection = vec(1, 0)
    tree.fallAngle = TUNABLES.treeGroundAngle
    tree.logHealth = 1
    tree.logMaxHealth = 2
    tree.reward = 4
    tree.minAxeTier = 0
    tree.splitDone = false
    tree.splitStage = 0
    state.player.position = vec(1.8, -1.2)
    state.player.facing = vec(0, 1)
    stepGame(state, createEmptyInput(), 1 / 60)

    swing(state)

    expect(tree.splitDone).toBe(true)
    expect(tree.splitStage).toBe(1)
    expect(state.logs).toHaveLength(2)
    expect(state.woodItems).toHaveLength(0)

    const halfLog = state.logs[0]
    state.player.position = add(halfLog.position, vec(-1.1, 0))
    state.player.facing = normalize(sub(halfLog.position, state.player.position))
    stepGame(state, createEmptyInput(), 1 / 60)
    swing(state, 2)

    expect(halfLog.splitDone).toBe(true)
    expect(halfLog.status).toBe('split')
    expect(state.woodItems.length).toBeGreaterThan(0)
  })

  it('includes an early deadwood tree that demonstrates half-log splitting with hands', () => {
    const state = createWorld()
    const tree = state.trees.find((candidate) => candidate.id === 'starter-deadwood-000')
    if (!tree) throw new Error('missing starter deadwood')
    expect(tree.minAxeTier).toBe(0)
    expect(tree.reward).toBeGreaterThanOrEqual(TUNABLES.halfLogMinReward)

    standNear(state, tree)
    swing(state, 5)
    stepSeconds(state, 2.1)
    expect(tree.status).toBe('fallen')

    const fallenCenter = add(tree.position, scale(tree.fallDirection, 1.6))
    state.player.position = add(fallenCenter, vec(-1.2, 0))
    state.player.facing = normalize(sub(fallenCenter, state.player.position))
    stepGame(state, createEmptyInput(), 1 / 60)
    swing(state, 2)

    expect(tree.splitStage).toBe(1)
    expect(state.logs.filter((log) => log.treeId === tree.id)).toHaveLength(2)
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
    expect(tree.cutProgress).toBeGreaterThan(0)
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
