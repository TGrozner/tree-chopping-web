import { add, clamp, distance, distanceSq, dot, lengthSq, nearestPointOnSegment, normalize, scale, sub, vec } from './math'
import { terrainHeightAt } from './terrain'
import { AXE_CHOP_POWER, AXE_COSTS, AXE_NAMES, AXE_WOOD_MULTIPLIER, BACKPACK_CAPS, BACKPACK_COSTS, TUNABLES, WOOD_TYPES, emptyInventory } from './tunables'
import type { FeedbackEvent, GameInput, GameState, Inventory, Station, Tree, Vec2, WoodItem, WoodType } from './types'

type Target = { type: 'tree'; tree: Tree; score: number } | { type: 'log'; tree: Tree; score: number }

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

const treeMass = (tree: Tree): number => Math.max(0.65, tree.scale * (tree.kind === 'veteran' || tree.kind === 'mythic' ? 1.35 : 1))

const terrainDownhillAt = (position: Vec2): Vec2 => {
  const sample = 0.8
  const dx = terrainHeightAt(vec(position.x + sample, position.z)) - terrainHeightAt(vec(position.x - sample, position.z))
  const dz = terrainHeightAt(vec(position.x, position.z + sample)) - terrainHeightAt(vec(position.x, position.z - sample))
  return normalize(vec(-dx, -dz), vec(0, 0))
}

const logRadius = (tree: Tree): number => TUNABLES.logRollRadius * Math.max(0.72, tree.scale)

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

const findTarget = (state: GameState): Target | null => {
  const logTree = findLogTarget(state)
  if (logTree) return { type: 'log', tree: logTree, score: distanceSq(getFallenTreeCenter(logTree), state.player.position) }

  const tree = findTreeTarget(state)
  if (!tree && !logTree) return null
  if (!tree) return null
  return { type: 'tree', tree, score: distanceSq(tree.position, state.player.position) }
}

const updateTarget = (state: GameState): void => {
  const target = findTarget(state)
  state.currentTargetId = target?.tree.id ?? null
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

const fellTree = (state: GameState, tree: Tree, direction: Vec2, isCascade: boolean): void => {
  if (tree.status !== 'standing') return
  tree.status = 'falling'
  tree.health = 0
  tree.fallDirection = normalize(direction, vec(1, 0))
  tree.fallProgress = 0
  tree.fallAngle = 0.08
  tree.angularVelocity = TUNABLES.treeInitialAngularVelocity / treeMass(tree)
  tree.impactDone = false
  state.stats.treesFelled += 1
  if (isCascade) state.stats.cascades += 1
  addFeedback(state, isCascade ? 'impact' : 'fall', isCascade ? 'cascade' : 'fall', tree.position)
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

const spawnWoodItems = (state: GameState, tree: Tree): void => {
  if (tree.splitDone) return
  tree.splitDone = true
  const pieces = clamp(Math.ceil(tree.reward / 2), 2, 6)
  let remaining = tree.reward
  const center = getFallenTreeCenter(tree)
  for (let index = 0; index < pieces; index += 1) {
    const amount = Math.ceil(remaining / (pieces - index))
    remaining -= amount
    const side = index - (pieces - 1) * 0.5
    const offset = add(scale(tree.fallDirection, side * 0.45), vec(-tree.fallDirection.z * (0.4 + index * 0.08), tree.fallDirection.x * (0.4 + index * 0.08)))
    const item: WoodItem = {
      id: `${tree.id}-wood-${index}`,
      type: tree.woodType,
      amount,
      position: add(center, offset),
      velocity: scale(normalize(offset, vec(1, 0)), 1.8 + index * 0.2),
      age: 0,
      collected: false,
    }
    state.woodItems.push(item)
  }
  state.stats.logsSplit += 1
  addFeedback(state, 'hit', 'split', center)
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
  state.stats.hits += 1
  addFeedback(state, 'hit', `-${damage}`, getFallenTreeCenter(tree))
  setMessage(state, `${formatWood(tree.woodType)} trunk ${Math.max(0, tree.logHealth)}/${tree.logMaxHealth}`)
  if (tree.logHealth <= 0) spawnWoodItems(state, tree)
}

const applySwingHit = (state: GameState): void => {
  const target = findTarget(state)
  const nextCombo = state.swing.comboTimer > 0 ? Math.min(TUNABLES.comboMax, state.swing.combo + 1) : 1
  const finalCombo = nextCombo >= TUNABLES.comboMax
  const comboMultiplier = finalCombo ? TUNABLES.comboFinalMultiplier : 1
  state.swing.combo = finalCombo ? 0 : nextCombo
  state.swing.comboTimer = TUNABLES.comboWindow
  state.swing.lastTargetId = target?.tree.id ?? null

  if (!target) {
    addFeedback(state, 'whiff', 'miss', state.player.position)
    setMessage(state, 'No tree or log in swing range.')
    return
  }

  const targetPosition = target.type === 'tree' ? target.tree.position : getFallenTreeCenter(target.tree)
  state.player.facing = normalize(sub(targetPosition, state.player.position), state.player.facing)
  if (target.type === 'tree') applyTreeHit(state, target.tree, comboMultiplier)
  else applyLogHit(state, target.tree, comboMultiplier)
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
  const forward = (input.up ? 1 : 0) - (input.down ? 1 : 0)
  const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const move = vec(forward, strafe)
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

    if (!tree.impactDone && tree.fallAngle >= TUNABLES.treeImpactAngle) {
      tree.impactDone = true
      const trunkEnd = getTreePhysicsTip(tree)
      const impactDamage = TUNABLES.treeImpactDamage + Math.floor(tree.angularVelocity * mass * 0.45)
      for (const other of state.trees) {
        if (other.id === tree.id || other.status !== 'standing') continue
        const nearest = nearestPointOnSegment(other.position, tree.position, trunkEnd)
        if (distance(other.position, nearest) > TUNABLES.treeImpactRadius * other.scale) continue
        other.health -= impactDamage
        addFeedback(state, 'impact', 'hit', other.position)
        if (other.health <= 0) fellTree(state, other, sub(other.position, tree.position), true)
      }
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

    if (Math.abs(tree.logAngularVelocity) < 0.03 && distanceSq(tree.logVelocity, vec(0, 0)) < 0.01) {
      tree.logVelocity = vec(0, 0)
      tree.logAngularVelocity = 0
    }
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
  updateWoodItems(state, safeDt)
  updateFeedback(state, safeDt)
  updateActiveStation(state)
  updateTarget(state)
}

export const createEmptyInput = (): GameInput => ({
  up: false,
  down: false,
  left: false,
  right: false,
  chopHeld: false,
  chopRequests: 0,
  interactRequests: 0,
  depositRequests: 0,
  teleportRequests: 0,
})
