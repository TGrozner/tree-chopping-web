import { add, clamp, distance, distanceSq, dot, nearestPointOnSegment, normalize, scale, sub, vec } from './math'
import { TUNABLES } from './tunables'
import type { FeedbackEvent, GameInput, GameState, Log, Tree, Vec2, WoodChunk } from './types'

const addFeedback = (state: GameState, kind: FeedbackEvent['kind'], position: Vec2): void => {
  state.lastEventId += 1
  state.feedback.push({ id: state.lastEventId, kind, position: { ...position }, age: 0 })
}

const chopDamage = (state: GameState): number => TUNABLES.chopDamageBase + state.axeLevel - 1

const fellTree = (state: GameState, tree: Tree, direction: Vec2, isCascade: boolean): void => {
  if (tree.status !== 'standing') return
  tree.status = 'falling'
  tree.health = 0
  tree.fallDirection = normalize(direction, vec(0, 1))
  tree.fallProgress = 0
  tree.impactDone = false
  state.stats.treesFelled += 1
  if (isCascade) state.stats.cascades += 1
  addFeedback(state, isCascade ? 'impact' : 'fall', tree.position)
}

export const getTreeTip = (tree: Tree): Vec2 => add(tree.position, scale(tree.fallDirection, TUNABLES.treeHeight))

export const findTreeTarget = (state: GameState): Tree | null => {
  let best: Tree | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const tree of state.trees) {
    if (tree.status !== 'standing') continue
    const toTree = sub(tree.position, state.player.position)
    const distSq = distanceSq(tree.position, state.player.position)
    if (distSq > TUNABLES.targetRange * TUNABLES.targetRange) continue
    const facingScore = dot(normalize(toTree), state.player.facing)
    if (facingScore < TUNABLES.targetConeDot) continue
    if (distSq < bestScore) {
      best = tree
      bestScore = distSq
    }
  }
  return best
}

export const findLogTarget = (state: GameState): Log | null => {
  let best: Log | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const log of state.logs) {
    if (log.status !== 'whole') continue
    const dist = distance(log.position, state.player.position)
    if (dist > TUNABLES.logChopRange) continue
    if (dist < bestDistance) {
      best = log
      bestDistance = dist
    }
  }
  return best
}

const spawnLog = (state: GameState, tree: Tree): void => {
  const id = `log-${tree.id}`
  if (state.logs.some((log) => log.id === id)) return
  state.logs.push({
    id,
    position: add(tree.position, scale(tree.fallDirection, TUNABLES.treeHeight * 0.45)),
    direction: { ...tree.fallDirection },
    health: TUNABLES.logHealth,
    status: 'whole',
  })
}

const splitLog = (state: GameState, log: Log): void => {
  log.status = 'split'
  for (let index = 0; index < TUNABLES.chunksPerLog; index += 1) {
    const side = index - 1
    const chunk: WoodChunk = {
      id: `${log.id}-chunk-${index}`,
      position: add(log.position, vec(side * 0.45, index * 0.25)),
      collected: false,
    }
    state.chunks.push(chunk)
  }
  addFeedback(state, 'chop', log.position)
}

export const chop = (state: GameState): void => {
  const treeTarget = findTreeTarget(state)
  if (treeTarget) {
    treeTarget.health -= chopDamage(state)
    state.stats.chops += 1
    addFeedback(state, 'chop', treeTarget.position)
    if (treeTarget.health <= 0) {
      fellTree(state, treeTarget, sub(treeTarget.position, state.player.position), false)
    }
    return
  }

  const logTarget = findLogTarget(state)
  if (!logTarget) return
  logTarget.health -= chopDamage(state)
  state.stats.chops += 1
  addFeedback(state, 'chop', logTarget.position)
  if (logTarget.health <= 0) splitLog(state, logTarget)
}

const updateTarget = (state: GameState): void => {
  state.currentTargetId = findTreeTarget(state)?.id ?? findLogTarget(state)?.id ?? null
}

const updatePlayer = (state: GameState, input: GameInput, dt: number): void => {
  const move = vec((input.right ? 1 : 0) - (input.left ? 1 : 0), (input.up ? 1 : 0) - (input.down ? 1 : 0))
  const direction = normalize(move, state.player.facing)
  const moving = Math.abs(move.x) + Math.abs(move.z) > 0
  if (moving) {
    state.player.facing = direction
    state.player.speed = TUNABLES.playerSpeed
    state.player.position = add(state.player.position, scale(direction, TUNABLES.playerSpeed * dt))
    state.player.position.x = clamp(state.player.position.x, -TUNABLES.worldHalfSize, TUNABLES.worldHalfSize)
    state.player.position.z = clamp(state.player.position.z, -TUNABLES.worldHalfSize, TUNABLES.worldHalfSize)
  } else {
    state.player.speed = 0
  }
}

const updateFallingTrees = (state: GameState, dt: number): void => {
  for (const tree of state.trees) {
    if (tree.status !== 'falling') continue
    tree.fallProgress = clamp(tree.fallProgress + dt / TUNABLES.fallDuration, 0, 1)

    if (!tree.impactDone && tree.fallProgress >= 0.62) {
      tree.impactDone = true
      const trunkEnd = getTreeTip(tree)
      for (const other of state.trees) {
        if (other.id === tree.id || other.status !== 'standing') continue
        const nearest = nearestPointOnSegment(other.position, tree.position, trunkEnd)
        if (distance(other.position, nearest) <= TUNABLES.treeImpactRadius) {
          other.health -= 2
          addFeedback(state, 'impact', other.position)
          if (other.health <= 0) fellTree(state, other, sub(other.position, tree.position), true)
        }
      }
    }

    if (tree.fallProgress >= 1) {
      tree.status = 'fallen'
      spawnLog(state, tree)
    }
  }
}

const collectChunks = (state: GameState): void => {
  for (const chunk of state.chunks) {
    if (chunk.collected) continue
    if (distance(chunk.position, state.player.position) > TUNABLES.collectRadius) continue
    chunk.collected = true
    state.wood += 1
    state.stats.chunksCollected += 1
    addFeedback(state, 'collect', chunk.position)
  }

  if (state.axeLevel === 1 && state.wood >= TUNABLES.upgradeWoodCost) {
    state.axeLevel = 2
    state.stats.upgrades += 1
    addFeedback(state, 'upgrade', state.player.position)
  }
}

const updateFeedback = (state: GameState, dt: number): void => {
  for (const event of state.feedback) event.age += dt
  state.feedback = state.feedback.filter((event) => event.age < TUNABLES.feedbackLifetime)
}

export const stepGame = (state: GameState, input: GameInput, dt: number): void => {
  state.time += dt
  updatePlayer(state, input, dt)
  if (input.chopRequested) chop(state)
  updateFallingTrees(state, dt)
  collectChunks(state)
  updateFeedback(state, dt)
  updateTarget(state)
}

export const createEmptyInput = (): GameInput => ({
  up: false,
  down: false,
  left: false,
  right: false,
  chopRequested: false,
})
