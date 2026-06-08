import { add, clamp, distance, distanceSq, dot, lengthSq, nearestPointOnSegment, normalize, rotate, scale, sub, vec } from './math'
import { terrainHeightAt } from './terrain'
import { AXE_CHOP_POWER, AXE_COSTS, AXE_NAMES, AXE_WOOD_MULTIPLIER, BACKPACK_CAPS, BACKPACK_COSTS, TUNABLES, WOOD_TYPES, emptyInventory } from './tunables'
import type { FeedbackEvent, GameInput, GameState, Inventory, Log, Station, Tree, Vec2, WoodItem, WoodType } from './types'

type Target = { type: 'tree'; tree: Tree; score: number } | { type: 'log'; tree: Tree; score: number } | { type: 'sublog'; log: Log; score: number }

export const inventoryTotal = (inventory: Inventory): number => WOOD_TYPES.reduce((sum, type) => sum + inventory[type], 0)
export const backpackCapacity = (state: GameState): number => BACKPACK_CAPS[Math.min(state.backpackTier, BACKPACK_CAPS.length - 1)]
export const backpackTotal = (state: GameState): number => inventoryTotal(state.backpack)

const formatWood = (type: WoodType): string => {
  if (type === 'finewood') return 'Finewood'
  if (type === 'corewood') return 'CoreWood'
  return 'Wood'
}

const canAfford = (inventory: Inventory, cost: Inventory): boolean => WOOD_TYPES.every((type) => inventory[type] >= cost[type])

const spend = (inventory: Inventory, cost: Inventory): void => {
  for (const type of WOOD_TYPES) inventory[type] -= cost[type]
}

const addInventory = (inventory: Inventory, type: WoodType, amount: number): void => {
  inventory[type] += amount
}

const addFeedback = (state: GameState, kind: FeedbackEvent['kind'], label: string, position: Vec2): void => {
  state.lastEventId += 1
  state.feedback.push({ id: state.lastEventId, kind, label, position: { ...position }, age: 0 })
}

const setMessage = (state: GameState, message: string): void => {
  state.message = message
}

const chopDamage = (state: GameState, comboMultiplier: number): number => {
  const tier = Math.min(state.axeTier, AXE_CHOP_POWER.length - 1)
  return (AXE_CHOP_POWER[tier] + state.powerTier) * comboMultiplier
}

const targetRange = (state: GameState): number => TUNABLES.swingRange + state.powerTier * 0.18 + state.petTier * 0.1

const logTargetRange = (state: GameState): number => TUNABLES.logSwingRange + state.powerTier * 0.18 + state.petTier * 0.1

export const getTreeTip = (tree: Tree): Vec2 => add(tree.position, scale(tree.fallDirection, TUNABLES.treeHeight * tree.scale))

const getTreePhysicsTip = (tree: Tree): Vec2 => {
  const horizontalLength = TUNABLES.treeHeight * tree.scale * Math.sin(tree.fallAngle)
  return add(tree.position, scale(tree.fallDirection, horizontalLength))
}

const getFallenTreeCenter = (tree: Tree): Vec2 => add(tree.position, scale(tree.fallDirection, TUNABLES.treeHeight * tree.scale * 0.45))

const getSubLogHalfLength = (log: Log): number => TUNABLES.treeHeight * log.scale * 0.22

const getSubLogEndPoints = (log: Log): [Vec2, Vec2] => [
  add(log.position, scale(log.direction, -getSubLogHalfLength(log))),
  add(log.position, scale(log.direction, getSubLogHalfLength(log))),
]

const treeMass = (tree: Tree): number => Math.max(0.65, tree.scale * (tree.kind === 'veteran' || tree.kind === 'mythic' ? 1.35 : 1))

const terrainDownhillAt = (position: Vec2): Vec2 => {
  const sample = 0.8
  const dx = terrainHeightAt(vec(position.x + sample, position.z)) - terrainHeightAt(vec(position.x - sample, position.z))
  const dz = terrainHeightAt(vec(position.x, position.z + sample)) - terrainHeightAt(vec(position.x, position.z - sample))
  return normalize(vec(-dx, -dz), vec(0, 0))
}

const logRadius = (tree: Tree): number => TUNABLES.logRollRadius * Math.max(0.72, tree.scale)

const yawToFacing = (yaw: number): Vec2 => vec(Math.cos(yaw), Math.sin(yaw))

const logRollDirection = (tree: Tree): Vec2 => {
  const side = normalize(vec(-tree.fallDirection.z, tree.fallDirection.x), vec(0, 1))
  const downhill = terrainDownhillAt(getFallenTreeCenter(tree))
  if (lengthSq(downhill) < 0.0001) return side
  return dot(downhill, side) >= 0 ? side : scale(side, -1)
}

const targetScore = (state: GameState, position: Vec2, radius: number, range: number, turnPenalty: number): number | null => {
  const toTarget = sub(position, state.player.position)
  const distanceToEdge = Math.max(0, Math.sqrt(lengthSq(toTarget)) - radius)
  if (distanceToEdge > range) return null
  const facingScore = dot(normalize(toTarget, state.player.facing), state.player.facing)
  const facingPenalty = facingScore >= TUNABLES.targetConeDot ? (1 - facingScore) * 0.35 : (1 - facingScore) * turnPenalty
  return distanceToEdge * distanceToEdge + facingPenalty
}

export const findTreeTarget = (state: GameState): Tree | null => {
  let best: Target | null = null
  const range = targetRange(state)
  for (const tree of state.trees) {
    if (tree.status !== 'standing') continue
    const score = targetScore(state, tree.position, TUNABLES.targetAssistRadius * tree.scale, range, 2.2)
    if (score === null) continue
    if (!best || score < best.score) best = { type: 'tree', tree, score }
  }
  return best?.type === 'tree' ? best.tree : null
}

export const findLogTarget = (state: GameState): Tree | null => {
  const sticky = state.trees.find((tree) => tree.id === state.swing.lastTargetId && tree.status === 'fallen' && !tree.splitDone)
  if (sticky) {
    const nearest = nearestPointOnSegment(state.player.position, sticky.position, getTreePhysicsTip(sticky))
    const stickyScore = targetScore(state, nearest, TUNABLES.logTargetAssistRadius, logTargetRange(state) + 0.7, 0.45)
    if (stickyScore !== null) return sticky
  }

  let best: Target | null = null
  const range = logTargetRange(state)
  for (const tree of state.trees) {
    if (tree.status !== 'fallen' || tree.splitDone) continue
    const nearest = nearestPointOnSegment(state.player.position, tree.position, getTreePhysicsTip(tree))
    const score = targetScore(state, nearest, TUNABLES.logTargetAssistRadius, range, 1.8)
    if (score === null) continue
    if (!best || score < best.score) best = { type: 'log', tree, score }
  }
  return best?.type === 'log' ? best.tree : null
}

const findSubLogTarget = (state: GameState): Log | null => {
  let best: { log: Log; score: number } | null = null
  const range = logTargetRange(state) + 0.2
  for (const log of state.logs) {
    if (log.status !== 'landed' || log.splitDone) continue
    const [start, end] = getSubLogEndPoints(log)
    const nearest = nearestPointOnSegment(state.player.position, start, end)
    const score = targetScore(state, nearest, TUNABLES.logTargetAssistRadius * 0.82, range, 1.4)
    if (score === null) continue
    if (!best || score < best.score) best = { log, score }
  }
  return best?.log ?? null
}

const findTarget = (state: GameState): Target | null => {
  const logTree = findLogTarget(state)
  if (logTree) return { type: 'log', tree: logTree, score: distanceSq(getFallenTreeCenter(logTree), state.player.position) }

  const subLog = findSubLogTarget(state)
  if (subLog) return { type: 'sublog', log: subLog, score: distanceSq(subLog.position, state.player.position) }

  const tree = findTreeTarget(state)
  if (!tree && !logTree && !subLog) return null
  if (!tree) return null
  return { type: 'tree', tree, score: distanceSq(tree.position, state.player.position) }
}

const updateTarget = (state: GameState): void => {
  const target = findTarget(state)
  state.currentTargetId = target?.type === 'sublog' ? target.log.id : target?.tree.id ?? null
}

const updateActiveStation = (state: GameState): void => {
  let best: Station | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const station of state.stations) {
    const stationDistance = distance(station.position, state.player.position)
    if (stationDistance > TUNABLES.stationRange || stationDistance >= bestDistance) continue
    best = station
    bestDistance = stationDistance
  }
  state.activeStationId = best?.id ?? null
}

const isTooHard = (state: GameState, minAxeTier: number): boolean => state.axeTier < minAxeTier

const tierName = (tier: number): string => AXE_NAMES[Math.min(tier, AXE_NAMES.length - 1)]

const fellTree = (state: GameState, tree: Tree, direction: Vec2, isCascade: boolean, impulseMultiplier = 1): void => {
  if (tree.status !== 'standing') return
  tree.status = 'falling'
  tree.health = 0
  tree.fallDirection = normalize(direction, vec(1, 0))
  tree.fallProgress = 0
  tree.fallAngle = 0.08
  const cascadeBoost = isCascade ? TUNABLES.cascadeAngularVelocityMultiplier : 1
  tree.angularVelocity = (TUNABLES.treeInitialAngularVelocity * cascadeBoost * impulseMultiplier) / treeMass(tree)
  tree.impactDone = false
  tree.impactedTreeIds = []
  tree.shakeTimer = 0
  state.stats.treesFelled += 1
  if (isCascade) state.stats.cascades += 1
  addFeedback(state, isCascade ? 'impact' : 'fall', isCascade ? 'cascade' : 'fall', tree.position)
}

const impactStandingTree = (state: GameState, source: Tree, other: Tree, direction: Vec2, damage: number): boolean => {
  other.health -= damage
  other.cutProgress = clamp(other.cutProgress + damage / Math.max(other.maxHealth, 1), 0, 1)
  other.shakeTimer = TUNABLES.treeShakeDuration * 1.25
  other.shakeDirection = normalize(direction, vec(1, 0))
  addFeedback(state, 'impact', `-${damage}`, other.position)
  if (other.health > 0) return false

  const impulseMultiplier = clamp(
    1 + (damage / Math.max(other.maxHealth, 1)) * 0.32 + treeMass(source) * 0.08,
    1,
    TUNABLES.cascadeImpulseMaxMultiplier,
  )
  fellTree(state, other, direction, true, impulseMultiplier)
  return true
}

const primeFallenTreeLog = (state: GameState, tree: Tree, impactAngularVelocity: number): void => {
  if (tree.logMaxHealth > 0) return
  const tier = Math.min(state.axeTier, AXE_WOOD_MULTIPLIER.length - 1)
  tree.reward = Math.max(1, Math.ceil(tree.reward * AXE_WOOD_MULTIPLIER[tier] + state.luckTier * 0.35))
  tree.logHealth = Math.max(2, Math.ceil(tree.maxHealth * 0.22))
  tree.logMaxHealth = tree.logHealth
  const rollDirection = logRollDirection(tree)
  tree.logVelocity = scale(rollDirection, (TUNABLES.logLaunchSpeed + impactAngularVelocity * 0.38) / treeMass(tree))
  tree.rollAngle = 0
  tree.logAngularVelocity = dot(tree.logVelocity, rollDirection) / logRadius(tree)
}

const spawnWoodItemsAt = (state: GameState, idPrefix: string, type: WoodType, reward: number, center: Vec2, direction: Vec2): void => {
  const pieces = clamp(Math.ceil(reward / 2), 2, 6)
  let remaining = reward
  for (let index = 0; index < pieces; index += 1) {
    const amount = Math.ceil(remaining / (pieces - index))
    remaining -= amount
    const side = index - (pieces - 1) * 0.5
    const offset = add(scale(direction, side * 0.45), vec(-direction.z * (0.4 + index * 0.08), direction.x * (0.4 + index * 0.08)))
    const item: WoodItem = {
      id: `${idPrefix}-wood-${index}`,
      type,
      amount,
      position: add(center, offset),
      velocity: scale(normalize(offset, vec(1, 0)), 1.8 + index * 0.2),
      age: 0,
      collected: false,
    }
    state.woodItems.push(item)
  }
}

const spawnWoodItems = (state: GameState, tree: Tree): void => {
  if (tree.splitDone) return
  tree.splitDone = true
  const center = getFallenTreeCenter(tree)
  spawnWoodItemsAt(state, tree.id, tree.woodType, tree.reward, center, tree.fallDirection)
  state.stats.logsSplit += 1
  addFeedback(state, 'split', 'split', center)
}

const spawnHalfLogs = (state: GameState, tree: Tree): void => {
  if (tree.splitDone) return
  tree.splitDone = true
  tree.splitStage = 1
  const center = getFallenTreeCenter(tree)
  const side = normalize(vec(-tree.fallDirection.z, tree.fallDirection.x), vec(0, 1))
  const rewardA = Math.max(1, Math.ceil(tree.reward * 0.5))
  const rewardB = Math.max(1, tree.reward - rewardA)
  const baseHealth = Math.max(1, Math.ceil(tree.logMaxHealth * TUNABLES.halfLogHealthMultiplier))
  const logRewards = [rewardA, rewardB]
  for (let index = 0; index < 2; index += 1) {
    const offsetSide = index === 0 ? -0.48 : 0.48
    const log: Log = {
      id: `${tree.id}-half-${index}`,
      treeId: tree.id,
      kind: tree.kind,
      woodType: tree.woodType,
      position: add(center, scale(side, offsetSide)),
      direction: normalize(add(tree.fallDirection, scale(side, offsetSide * 0.22)), tree.fallDirection),
      velocity: scale(side, (index === 0 ? -1 : 1) * TUNABLES.halfLogLaunchSpeed),
      health: baseHealth,
      maxHealth: baseHealth,
      minAxeTier: tree.minAxeTier,
      reward: logRewards[index],
      status: 'landed',
      fallProgress: 1,
      rollAngle: 0,
      angularVelocity: (index === 0 ? -1 : 1) * 3.5,
      splitDone: false,
      scale: tree.scale * 0.74,
      age: 0,
    }
    state.logs.push(log)
  }
  state.stats.logsSplit += 1
  addFeedback(state, 'split', 'half logs', center)
}

const applyTreeHit = (state: GameState, tree: Tree, comboMultiplier: number): void => {
  if (isTooHard(state, tree.minAxeTier)) {
    state.stats.blockedHits += 1
    addFeedback(state, 'blocked', tierName(tree.minAxeTier), tree.position)
    setMessage(state, `${tree.kind} needs ${tierName(tree.minAxeTier)} or better.`)
    return
  }

  const damage = chopDamage(state, comboMultiplier)
  tree.health -= damage
  tree.cutProgress = clamp(tree.cutProgress + damage / Math.max(tree.maxHealth, 1), 0, 1)
  tree.shakeTimer = TUNABLES.treeShakeDuration
  tree.shakeDirection = normalize(sub(tree.position, state.player.position), state.player.facing)
  state.stats.hits += 1
  addFeedback(state, 'hit', `-${damage}`, tree.position)
  setMessage(state, `${tree.kind} ${Math.max(0, tree.health)}/${tree.maxHealth}`)
  if (tree.health <= 0) fellTree(state, tree, sub(tree.position, state.player.position), false)
}

const applyLogHit = (state: GameState, tree: Tree, comboMultiplier: number): void => {
  if (isTooHard(state, tree.minAxeTier)) {
    state.stats.blockedHits += 1
    addFeedback(state, 'blocked', tierName(tree.minAxeTier), getFallenTreeCenter(tree))
    setMessage(state, `Fallen ${tree.kind} needs ${tierName(tree.minAxeTier)} or better.`)
    return
  }

  const damage = chopDamage(state, comboMultiplier)
  tree.logHealth -= damage
  tree.shakeTimer = TUNABLES.treeShakeDuration * 0.6
  tree.shakeDirection = normalize(sub(getFallenTreeCenter(tree), state.player.position), tree.fallDirection)
  state.stats.hits += 1
  addFeedback(state, 'hit', `-${damage}`, getFallenTreeCenter(tree))
  setMessage(state, `${formatWood(tree.woodType)} trunk ${Math.max(0, tree.logHealth)}/${tree.logMaxHealth}`)
  if (tree.logHealth <= 0) {
    if (tree.reward >= TUNABLES.halfLogMinReward || tree.kind !== 'sapling') spawnHalfLogs(state, tree)
    else spawnWoodItems(state, tree)
  }
}

const applySubLogHit = (state: GameState, log: Log, comboMultiplier: number): void => {
  if (isTooHard(state, log.minAxeTier)) {
    state.stats.blockedHits += 1
    addFeedback(state, 'blocked', tierName(log.minAxeTier), log.position)
    setMessage(state, `Fallen ${log.kind} needs ${tierName(log.minAxeTier)} or better.`)
    return
  }

  const damage = chopDamage(state, comboMultiplier)
  log.health -= damage
  log.velocity = add(log.velocity, scale(normalize(sub(log.position, state.player.position), log.direction), 1.05 + damage * 0.08))
  log.angularVelocity += 1.8 + damage * 0.2
  state.stats.hits += 1
  addFeedback(state, 'hit', `-${damage}`, log.position)
  setMessage(state, `${formatWood(log.woodType)} half-log ${Math.max(0, log.health)}/${log.maxHealth}`)
  if (log.health > 0) return

  log.status = 'split'
  log.splitDone = true
  spawnWoodItemsAt(state, log.id, log.woodType, log.reward, log.position, log.direction)
  state.stats.logsSplit += 1
  addFeedback(state, 'split', 'chunks', log.position)
}

const applySwingHit = (state: GameState): void => {
  const target = findTarget(state)
  const nextCombo = state.swing.comboTimer > 0 ? Math.min(TUNABLES.comboMax, state.swing.combo + 1) : 1
  const finalCombo = nextCombo >= TUNABLES.comboMax
  const comboMultiplier = finalCombo ? TUNABLES.comboFinalMultiplier : 1
  state.swing.combo = finalCombo ? 0 : nextCombo
  state.swing.comboTimer = TUNABLES.comboWindow
  state.swing.lastTargetId = target?.type === 'sublog' ? target.log.id : target?.tree.id ?? null

  if (!target) {
    addFeedback(state, 'whiff', 'miss', state.player.position)
    setMessage(state, 'No tree or log in swing range.')
    return
  }

  const targetPosition = target.type === 'tree' ? target.tree.position : target.type === 'log' ? getFallenTreeCenter(target.tree) : target.log.position
  state.player.facing = normalize(sub(targetPosition, state.player.position), state.player.facing)
  if (target.type === 'tree') applyTreeHit(state, target.tree, comboMultiplier)
  else if (target.type === 'log') applyLogHit(state, target.tree, comboMultiplier)
  else applySubLogHit(state, target.log, comboMultiplier)
}

export const requestSwing = (state: GameState): void => {
  if (state.swing.phase === 'idle') {
    state.swing.phase = 'windup'
    state.swing.elapsed = 0
    state.swing.hitApplied = false
    state.swing.queued = false
    state.stats.swings += 1
    return
  }
  state.swing.queued = true
}

const updateSwing = (state: GameState, dt: number): void => {
  if (state.swing.phase === 'idle' && state.swing.queued) {
    state.swing.phase = 'windup'
    state.swing.elapsed = 0
    state.swing.hitApplied = false
    state.swing.queued = false
    state.stats.swings += 1
  }

  if (state.swing.comboTimer > 0) {
    state.swing.comboTimer = Math.max(0, state.swing.comboTimer - dt)
    if (state.swing.comboTimer === 0) state.swing.combo = 0
  }

  if (state.swing.phase === 'idle') return
  state.swing.elapsed += dt

  if (state.swing.phase === 'windup') {
    if (!state.swing.hitApplied && state.swing.elapsed >= TUNABLES.swingWindup) {
      state.swing.hitApplied = true
      applySwingHit(state)
    }
    if (state.swing.elapsed >= TUNABLES.swingWindup) {
      state.swing.phase = 'recovery'
      state.swing.elapsed = 0
    }
    return
  }

  if (state.swing.elapsed < TUNABLES.swingRecovery) return
  if (state.swing.queued) {
    state.swing.phase = 'windup'
    state.swing.elapsed = 0
    state.swing.hitApplied = false
    state.swing.queued = false
    state.stats.swings += 1
    return
  }
  state.swing.phase = 'idle'
  state.swing.elapsed = 0
  state.swing.hitApplied = false
}

const pushOut = (position: Vec2, obstacle: Vec2, radius: number): Vec2 => {
  const delta = sub(position, obstacle)
  const dist = Math.sqrt(Math.max(distanceSq(position, obstacle), 0.0001))
  if (dist >= radius) return position
  const direction = dist < 0.01 ? vec(1, 0) : scale(delta, 1 / dist)
  return add(obstacle, scale(direction, radius))
}

const resolvePlayerCollisions = (state: GameState, proposed: Vec2): Vec2 => {
  let position = proposed
  for (const tree of state.trees) {
    if (tree.status === 'standing') {
      const radius = TUNABLES.playerRadius + TUNABLES.treeCollisionRadius * tree.scale
      position = pushOut(position, tree.position, radius)
      continue
    }
    if (tree.status === 'fallen' && !tree.splitDone) {
      const nearest = nearestPointOnSegment(position, tree.position, getTreePhysicsTip(tree))
      const radius = TUNABLES.playerRadius + TUNABLES.logCollisionRadius
      position = pushOut(position, nearest, radius)
    }
  }
  for (const station of state.stations) {
    const radius = TUNABLES.playerRadius + TUNABLES.stationCollisionRadius
    position = pushOut(position, station.position, radius)
  }
  return position
}

const updatePlayer = (state: GameState, input: GameInput, dt: number): void => {
  if (input.lookDeltaX !== 0) {
    state.player.cameraYaw += input.lookDeltaX * TUNABLES.mouseLookSensitivity
    input.lookDeltaX = 0
  }

  const cameraForward = yawToFacing(state.player.cameraYaw)
  const cameraRight = rotate(cameraForward, Math.PI * 0.5)
  const forward = (input.up ? 1 : 0) - (input.down ? 1 : 0)
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const move = add(scale(cameraForward, forward), scale(cameraRight, strafe))
  const moving = Math.abs(move.x) + Math.abs(move.z) > 0
  if (!moving) {
    state.player.speed = 0
    return
  }

  const direction = normalize(move, state.player.facing)
  const speed = TUNABLES.playerBaseSpeed + state.speedTier * TUNABLES.playerSpeedPerTier
  state.player.facing = direction
  state.player.speed = speed
  state.player.position = resolvePlayerCollisions(state, add(state.player.position, scale(direction, speed * dt)))

  const originDistance = Math.sqrt(state.player.position.x * state.player.position.x + state.player.position.z * state.player.position.z)
  if (originDistance > TUNABLES.worldRadius) {
    state.player.position = scale(normalize(state.player.position), TUNABLES.worldRadius)
  }
}

const updateFallingTrees = (state: GameState, dt: number): void => {
  for (const tree of state.trees) {
    if (tree.status !== 'falling') continue
    const mass = treeMass(tree)
    const torque = TUNABLES.treeAngularGravity * Math.max(0.18, Math.sin(tree.fallAngle + 0.18)) / mass
    tree.angularVelocity += torque * dt
    tree.angularVelocity *= Math.exp(-TUNABLES.treeAngularDamping * dt * 0.18)
    tree.fallAngle = clamp(tree.fallAngle + tree.angularVelocity * dt, 0, TUNABLES.treeGroundAngle)
    tree.fallProgress = clamp(tree.fallAngle / TUNABLES.treeGroundAngle, 0, 1)

    if (tree.fallAngle >= TUNABLES.treeSweepStartAngle) {
      const trunkEnd = getTreePhysicsTip(tree)
      const trunkLength = Math.max(distance(tree.position, trunkEnd), 0.0001)
      const energy = Math.max(0.1, tree.angularVelocity * mass)
      for (const other of state.trees) {
        if (other.id === tree.id || other.status !== 'standing') continue
        const impactKey = `fall:${other.id}`
        if (tree.impactedTreeIds.includes(impactKey)) continue
        const nearest = nearestPointOnSegment(other.position, tree.position, trunkEnd)
        const contactRadius = TUNABLES.treeImpactRadius * Math.max(0.72, (tree.scale + other.scale) * 0.5)
        if (distance(other.position, nearest) > contactRadius) continue
        tree.impactedTreeIds.push(impactKey)
        const alongTrunk = clamp(distance(tree.position, nearest) / trunkLength, 0, 1)
        const impactDamage = Math.ceil(
          (TUNABLES.treeImpactDamage + energy * TUNABLES.treeImpactEnergyDamage) *
            Math.max(0.82, tree.scale) *
            (0.72 + alongTrunk * 0.68),
        )
        impactStandingTree(state, tree, other, normalize(sub(other.position, tree.position), tree.fallDirection), impactDamage)
      }
    }

    if (!tree.impactDone && tree.fallAngle >= TUNABLES.treeImpactAngle) {
      tree.impactDone = true
      addFeedback(state, 'impact', 'thud', getFallenTreeCenter(tree))
    }

    if (tree.fallAngle >= TUNABLES.treeGroundAngle) {
      const impactAngularVelocity = tree.angularVelocity
      tree.status = 'fallen'
      tree.fallProgress = 1
      tree.fallAngle = TUNABLES.treeGroundAngle
      tree.angularVelocity = 0
      primeFallenTreeLog(state, tree, impactAngularVelocity)
    }
  }
}

const applyRollingLogImpacts = (state: GameState, tree: Tree): void => {
  const speed = Math.sqrt(lengthSq(tree.logVelocity))
  if (speed < TUNABLES.logImpactMinSpeed) return

  const trunkEnd = getTreePhysicsTip(tree)
  const mass = treeMass(tree)
  for (const other of state.trees) {
    if (other.id === tree.id || other.status !== 'standing') continue
    const impactKey = `roll:${other.id}`
    if (tree.impactedTreeIds.includes(impactKey)) continue
    const nearest = nearestPointOnSegment(other.position, tree.position, trunkEnd)
    const contactRadius = TUNABLES.logImpactRadius * Math.max(0.78, (tree.scale + other.scale) * 0.5)
    if (distance(other.position, nearest) > contactRadius) continue

    tree.impactedTreeIds.push(impactKey)
    const impactDamage = Math.ceil((TUNABLES.logImpactDamage + speed * mass * 1.15) * Math.max(0.85, tree.scale))
    const impactDirection = normalize(sub(other.position, nearest), normalize(tree.logVelocity, tree.fallDirection))
    const knockedDown = impactStandingTree(state, tree, other, impactDirection, impactDamage)
    tree.logVelocity = scale(tree.logVelocity, knockedDown ? 0.72 : 0.38)
    tree.logAngularVelocity *= knockedDown ? 0.72 : 0.38
  }
}

const updateFallenTrees = (state: GameState, dt: number): void => {
  for (const tree of state.trees) {
    if (tree.status !== 'fallen' || tree.splitDone) continue
    const rollDirection = logRollDirection(tree)
    const downhill = terrainDownhillAt(getFallenTreeCenter(tree))
    const slopeAcceleration = TUNABLES.logRollGravity * dot(downhill, rollDirection)
    const longitudinalSpeed = dot(tree.logVelocity, tree.fallDirection)
    const constrainedVelocity = sub(tree.logVelocity, scale(tree.fallDirection, longitudinalSpeed * TUNABLES.logLongitudinalGrip))
    tree.logVelocity = add(constrainedVelocity, scale(rollDirection, slopeAcceleration * dt))
    tree.logVelocity = scale(tree.logVelocity, Math.exp(-TUNABLES.logFriction * dt))

    const rollDistance = dot(tree.logVelocity, rollDirection) * dt
    tree.position = add(tree.position, scale(rollDirection, rollDistance))
    tree.rollAngle += rollDistance / logRadius(tree)
    tree.logAngularVelocity = rollDistance / Math.max(dt, 0.0001) / logRadius(tree)
    tree.logAngularVelocity *= Math.exp(-TUNABLES.logAngularDamping * dt * 0.15)
    applyRollingLogImpacts(state, tree)

    if (Math.abs(tree.logAngularVelocity) < 0.03 && distanceSq(tree.logVelocity, vec(0, 0)) < 0.01) {
      tree.logVelocity = vec(0, 0)
      tree.logAngularVelocity = 0
    }
  }
}

const updateSubLogs = (state: GameState, dt: number): void => {
  for (const log of state.logs) {
    if (log.status !== 'landed' || log.splitDone) continue
    log.age += dt
    log.position = add(log.position, scale(log.velocity, dt))
    log.velocity = scale(log.velocity, Math.exp(-TUNABLES.logFriction * 0.92 * dt))
    const speed = Math.sqrt(lengthSq(log.velocity))
    log.rollAngle += speed * dt / Math.max(0.12, TUNABLES.logRollRadius * log.scale)
    log.angularVelocity *= Math.exp(-TUNABLES.logAngularDamping * 0.35 * dt)
    if (speed < 0.03 && Math.abs(log.angularVelocity) < 0.05) {
      log.velocity = vec(0, 0)
      log.angularVelocity = 0
    }
  }
}

const updateTreeReactions = (state: GameState, dt: number): void => {
  for (const tree of state.trees) {
    if (tree.shakeTimer > 0) tree.shakeTimer = Math.max(0, tree.shakeTimer - dt)
  }
}

const canFitBackpack = (state: GameState, amount: number): boolean => backpackTotal(state) + amount <= backpackCapacity(state)

const updateWoodItems = (state: GameState, dt: number): void => {
  for (const item of state.woodItems) {
    if (item.collected) continue
    item.age += dt
    item.position = add(item.position, scale(item.velocity, dt))
    item.velocity = scale(item.velocity, Math.max(0, 1 - dt * 2.5))
    const dist = distance(item.position, state.player.position)
    if (dist <= TUNABLES.woodItemMagnetRange && canFitBackpack(state, item.amount)) {
      const toPlayer = normalize(sub(state.player.position, item.position))
      item.position = add(item.position, scale(toPlayer, TUNABLES.woodItemMagnetSpeed * dt))
    }
    if (distance(item.position, state.player.position) <= TUNABLES.woodItemPickupRange && canFitBackpack(state, item.amount)) {
      item.collected = true
      addInventory(state.backpack, item.type, item.amount)
      state.stats.pickups += item.amount
      addFeedback(state, 'collect', `+${item.amount}`, item.position)
      setMessage(state, `${formatWood(item.type)} in backpack.`)
    }
  }
}

export const tryDepositBackpack = (state: GameState): boolean => {
  const total = backpackTotal(state)
  if (total <= 0) {
    setMessage(state, 'Backpack is empty.')
    return false
  }
  for (const type of WOOD_TYPES) {
    state.stockpile[type] += state.backpack[type]
    state.backpack[type] = 0
  }
  state.stats.deposits += 1
  addFeedback(state, 'deposit', `+${total}`, state.player.position)
  setMessage(state, `Deposited ${total} wood.`)
  return true
}

export const tryUpgradeAxe = (state: GameState): boolean => {
  const nextTier = state.axeTier + 1
  if (nextTier >= AXE_NAMES.length) {
    setMessage(state, 'Chainsaw tier already unlocked.')
    return false
  }
  const cost = AXE_COSTS[nextTier]
  if (!canAfford(state.stockpile, cost)) {
    setMessage(state, `${tierName(nextTier)} costs ${cost.wood}/${cost.finewood}/${cost.corewood}.`)
    return false
  }
  spend(state.stockpile, cost)
  state.axeTier = nextTier
  state.stats.upgrades += 1
  addFeedback(state, 'upgrade', tierName(state.axeTier), state.player.position)
  setMessage(state, `${tierName(state.axeTier)} unlocked.`)
  return true
}

const tryUpgradeBackpack = (state: GameState): boolean => {
  const nextTier = state.backpackTier + 1
  if (nextTier >= BACKPACK_CAPS.length) return false
  const cost = BACKPACK_COSTS[nextTier]
  if (state.stockpile.wood < cost) return false
  state.stockpile.wood -= cost
  state.backpackTier = nextTier
  state.stats.upgrades += 1
  addFeedback(state, 'upgrade', 'pack', state.player.position)
  setMessage(state, `Backpack ${backpackCapacity(state)} capacity.`)
  return true
}

const tryUpgradePassive = (state: GameState, key: 'speedTier' | 'powerTier' | 'luckTier' | 'petTier', label: string, baseCost: number): boolean => {
  const current = state[key]
  if (current >= 5) return false
  const cost = Math.ceil(baseCost * Math.pow(1.85, current))
  if (state.stockpile.wood < cost) return false
  state.stockpile.wood -= cost
  state[key] += 1
  state.stats.upgrades += 1
  addFeedback(state, 'upgrade', label, state.player.position)
  setMessage(state, `${label} tier ${state[key]}.`)
  return true
}

export const tryUpgradeAtStation = (state: GameState): boolean => {
  if (tryUpgradeBackpack(state)) return true
  if (tryUpgradePassive(state, 'speedTier', 'speed', 20)) return true
  if (tryUpgradePassive(state, 'powerTier', 'power', 32)) return true
  if (tryUpgradePassive(state, 'luckTier', 'luck', 46)) return true
  if (tryUpgradePassive(state, 'petTier', 'pet', 70)) return true
  setMessage(state, 'No affordable upgrade.')
  return false
}

export const tryPrestige = (state: GameState): boolean => {
  if (inventoryTotal(state.stockpile) < TUNABLES.prestigeCost || state.axeTier < 4) {
    setMessage(state, `Prestige needs Steel and ${TUNABLES.prestigeCost} banked wood.`)
    return false
  }
  state.stockpile = emptyInventory()
  state.backpack = emptyInventory()
  state.axeTier = 0
  state.speedTier = 0
  state.luckTier = 0
  state.powerTier = 0
  state.backpackTier = 0
  state.petTier = 0
  state.spirits += 1
  state.stats.upgrades += 1
  addFeedback(state, 'prestige', `spirit ${state.spirits}`, state.player.position)
  setMessage(state, `Spirit ${state.spirits} earned.`)
  return true
}

export const interactWithStation = (state: GameState): boolean => {
  const station = state.stations.find((candidate) => candidate.id === state.activeStationId)
  if (!station) {
    setMessage(state, 'Move to a station.')
    return false
  }
  if (station.kind === 'depot') return tryDepositBackpack(state)
  if (station.kind === 'tools') return tryUpgradeAxe(state)
  if (station.kind === 'upgrades') return tryUpgradeAtStation(state)
  return tryPrestige(state)
}

const updateFeedback = (state: GameState, dt: number): void => {
  for (const event of state.feedback) event.age += dt
  state.feedback = state.feedback.filter((event) => event.age < TUNABLES.feedbackLifetime)
}

export const teleportHome = (state: GameState): void => {
  state.player.position = { ...state.spawn }
  state.player.facing = vec(1, 0)
  state.player.cameraYaw = 0
  state.player.speed = 0
  addFeedback(state, 'deposit', 'home', state.spawn)
  setMessage(state, 'Returned to summit hub.')
}

const processRequests = (state: GameState, input: GameInput): void => {
  while (input.chopRequests > 0) {
    requestSwing(state)
    input.chopRequests -= 1
  }
  if (input.chopHeld && state.swing.phase === 'idle' && findTarget(state)) requestSwing(state)
  while (input.teleportRequests > 0) {
    teleportHome(state)
    input.teleportRequests -= 1
  }
  while (input.depositRequests > 0) {
    if (state.activeStationId === 'station-depot') tryDepositBackpack(state)
    else setMessage(state, 'Use the Wood Depot station.')
    input.depositRequests -= 1
  }
  while (input.interactRequests > 0) {
    interactWithStation(state)
    input.interactRequests -= 1
  }
}

export const stepGame = (state: GameState, input: GameInput, dt: number): void => {
  const safeDt = clamp(dt, 0, 0.05)
  state.time += safeDt
  updatePlayer(state, input, safeDt)
  updateActiveStation(state)
  processRequests(state, input)
  updateSwing(state, safeDt)
  updateFallingTrees(state, safeDt)
  updateFallenTrees(state, safeDt)
  updateSubLogs(state, safeDt)
  updateWoodItems(state, safeDt)
  updateFeedback(state, safeDt)
  updateTreeReactions(state, safeDt)
  updateActiveStation(state)
  updateTarget(state)
}

export const createEmptyInput = (): GameInput => ({
  up: false,
  down: false,
  left: false,
  right: false,
  lookDeltaX: 0,
  chopHeld: false,
  chopRequests: 0,
  interactRequests: 0,
  depositRequests: 0,
  teleportRequests: 0,
})
