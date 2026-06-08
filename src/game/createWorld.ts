import { add, distance, normalize, scale, vec } from './math'
import { biomeForPosition } from './terrain'
import { emptyInventory, STATION_ACCENTS, STATION_LABELS, TREE_SPECS, TUNABLES } from './tunables'
import type { GameState, Station, StationKind, Tree, TreeKind, Vec2, WoodType } from './types'

const mulberry32 = (seed: number): (() => number) => {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const polar = (radius: number, angle: number): Vec2 => vec(Math.cos(angle) * radius, Math.sin(angle) * radius)

const station = (kind: StationKind, position: Vec2): Station => ({
  id: `station-${kind}`,
  kind,
  label: STATION_LABELS[kind],
  position,
  accent: STATION_ACCENTS[kind],
})

const createStations = (): Station[] => {
  const radius = 11
  return [
    station('tools', polar(radius, -Math.PI * 0.375)),
    station('depot', polar(radius, -Math.PI * 0.125)),
    station('upgrades', polar(radius, Math.PI * 0.125)),
    station('prestige', polar(radius, Math.PI * 0.375)),
  ]
}

const kindForBiome = (position: Vec2, roll: number): TreeKind => {
  const biome = biomeForPosition(position)
  if (biome === 'summit') return roll < 0.72 ? 'sapling' : 'normal'
  if (biome === 'pine') return roll < 0.12 ? 'brittle' : roll < 0.82 ? 'normal' : 'veteran'
  if (biome === 'oldwood') return roll < 0.22 ? 'brittle' : roll < 0.62 ? 'normal' : roll < 0.95 ? 'veteran' : 'mythic'
  return roll < 0.16 ? 'brittle' : roll < 0.46 ? 'normal' : roll < 0.9 ? 'veteran' : 'mythic'
}

const woodForBiome = (position: Vec2, kind: TreeKind): WoodType => {
  if (kind === 'mythic') return 'corewood'
  const biome = biomeForPosition(position)
  if (biome === 'core') return 'corewood'
  if (biome === 'oldwood') return kind === 'veteran' ? 'corewood' : 'finewood'
  if (biome === 'pine') return kind === 'veteran' ? 'finewood' : 'wood'
  return 'wood'
}

const makeTree = (id: string, kind: TreeKind, woodType: WoodType, position: Vec2, scaleValue: number, starter: boolean): Tree => {
  const spec = TREE_SPECS[kind]
  const healthScale = woodType === 'corewood' ? 1.22 : woodType === 'finewood' ? 1.1 : 1
  const rewardScale = woodType === 'corewood' ? 1.4 : woodType === 'finewood' ? 1.18 : 1
  return {
    id,
    kind,
    woodType,
    position,
    health: Math.ceil(spec.baseHealth * healthScale * scaleValue),
    maxHealth: Math.ceil(spec.baseHealth * healthScale * scaleValue),
    minAxeTier: Math.max(spec.minAxeTier, woodType === 'corewood' ? 2 : woodType === 'finewood' ? 1 : 0),
    reward: Math.ceil(spec.reward * rewardScale * scaleValue),
    status: 'standing',
    fallDirection: vec(1, 0),
    fallProgress: 0,
    fallAngle: 0,
    angularVelocity: 0,
    logHealth: 0,
    logMaxHealth: 0,
    logVelocity: vec(0, 0),
    rollAngle: 0,
    logAngularVelocity: 0,
    splitDone: false,
    splitStage: 0,
    impactDone: false,
    impactedTreeIds: [],
    shakeTimer: 0,
    shakeDirection: vec(1, 0),
    cutProgress: 0,
    scale: scaleValue,
    tint: spec.tint,
    canopy: spec.canopy,
    starter,
  }
}

const canPlace = (candidate: Vec2, placed: Tree[], spacing: number): boolean => {
  if (distance(candidate, vec(0, 0)) < TUNABLES.spawnPadRadius) return false
  for (const tree of placed) {
    if (distance(candidate, tree.position) < spacing) return false
  }
  return true
}

const createStarterSaplings = (rng: () => number): Tree[] => {
  const trees: Tree[] = [
    makeTree('starter-sapling-000', 'sapling', 'wood', vec(-5.8, 0), 0.88, true),
    makeTree('starter-sapling-001', 'sapling', 'wood', vec(-3.7, 1.35), 0.94, true),
    makeTree('starter-sapling-002', 'sapling', 'wood', vec(-3.5, -1.55), 0.92, true),
  ]
  const chunky = makeTree('starter-deadwood-000', 'brittle', 'wood', vec(-2.2, 4.4), 1.08, true)
  chunky.health = 6
  chunky.maxHealth = 6
  chunky.minAxeTier = 0
  chunky.reward = 4
  trees.push(chunky)

  let attempts = 0
  while (trees.length < TUNABLES.starterSaplings && attempts < 2000) {
    attempts += 1
    const radius = 7.8 + rng() * 17.5
    const angle = rng() * Math.PI * 2
    const position = add(vec(-2.8, 0), polar(radius, angle))
    if (!canPlace(position, trees, 1.85)) continue
    trees.push(makeTree(`starter-sapling-${String(trees.length).padStart(3, '0')}`, 'sapling', 'wood', position, 0.78 + rng() * 0.36, true))
  }
  return trees
}

const createProgressionForest = (rng: () => number, starterTrees: Tree[]): Tree[] => {
  const trees = [...starterTrees]
  let attempts = 0
  while (trees.length < TUNABLES.totalTrees && attempts < 7000) {
    attempts += 1
    const radius = 21 + rng() * 59
    const angle = rng() * Math.PI * 2
    const position = polar(radius, angle)
    if (!canPlace(position, trees, radius < 38 ? 3.4 : 4.3)) continue
    const roll = rng()
    const kind = kindForBiome(position, roll)
    const woodType = woodForBiome(position, kind)
    const scaleValue = kind === 'veteran' ? 1.18 + rng() * 0.35 : kind === 'mythic' ? 1.35 + rng() * 0.3 : 0.92 + rng() * 0.28
    trees.push(makeTree(`tree-${String(trees.length).padStart(3, '0')}`, kind, woodType, position, scaleValue, false))
  }

  const scriptedGroves: Array<[TreeKind, WoodType, Vec2, number]> = [
    ['normal', 'wood', vec(23, -11), 1.05],
    ['normal', 'wood', vec(27, -15), 1],
    ['brittle', 'finewood', vec(38, 19), 1.08],
    ['veteran', 'finewood', vec(46, 25), 1.22],
    ['veteran', 'corewood', vec(62, -28), 1.26],
    ['mythic', 'corewood', vec(-66, 18), 1.42],
  ]
  for (const [kind, woodType, position, scaleValue] of scriptedGroves) {
    trees.push(makeTree(`grove-${kind}-${trees.length}`, kind, woodType, position, scaleValue, false))
  }

  return trees
}

export const createWorld = (seed = 0xca5c): GameState => {
  const rng = mulberry32(seed)
  const spawn = vec(-8.4, 0)
  const starterTrees = createStarterSaplings(rng)
  const trees = createProgressionForest(rng, starterTrees)

  return {
    seed,
    time: 0,
    spawn,
    player: {
      position: { ...spawn },
      facing: normalize(vec(1, 0)),
      cameraYaw: 0,
      speed: 0,
    },
    trees,
    logs: [],
    woodItems: [],
    stations: createStations(),
    stockpile: emptyInventory(),
    backpack: emptyInventory(),
    axeTier: 0,
    speedTier: 0,
    luckTier: 0,
    powerTier: 0,
    backpackTier: 0,
    petTier: 0,
    spirits: 0,
    swing: {
      phase: 'idle',
      elapsed: 0,
      queued: false,
      hitApplied: false,
      combo: 0,
      comboTimer: 0,
      lastTargetId: null,
    },
    feedback: [],
    lastEventId: 0,
    currentTargetId: null,
    activeStationId: null,
    message: 'Find saplings. Depot banks backpack wood.',
    stats: {
      swings: 0,
      hits: 0,
      treesFelled: 0,
      logsSplit: 0,
      cascades: 0,
      pickups: 0,
      deposits: 0,
      upgrades: 0,
      blockedHits: 0,
    },
  }
}
