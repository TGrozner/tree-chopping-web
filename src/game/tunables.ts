import type { Inventory, StationKind, TreeKind, WoodType } from './types'

export const WOOD_TYPES = ['wood', 'finewood', 'corewood'] as const satisfies readonly WoodType[]

export const emptyInventory = (): Inventory => ({
  wood: 0,
  finewood: 0,
  corewood: 0,
})

export const AXE_NAMES = ['Hands', 'Stone', 'Bronze', 'Iron', 'Steel', 'Lumberjack', 'Chainsaw'] as const

export const AXE_CHOP_POWER = [1, 2, 4, 5, 6, 8, 10] as const
export const AXE_WOOD_MULTIPLIER = [1, 1.5, 2.5, 4, 6.5, 10, 16] as const

export const AXE_COSTS: readonly Inventory[] = [
  emptyInventory(),
  { wood: 8, finewood: 0, corewood: 0 },
  { wood: 28, finewood: 0, corewood: 0 },
  { wood: 60, finewood: 10, corewood: 0 },
  { wood: 160, finewood: 30, corewood: 10 },
  { wood: 420, finewood: 90, corewood: 36 },
  { wood: 1100, finewood: 260, corewood: 120 },
]

export const BACKPACK_CAPS = [24, 80, 180, 420, 950, 2200] as const
export const BACKPACK_COSTS = [0, 14, 55, 160, 420, 1000] as const

export const STATION_LABELS: Record<StationKind, string> = {
  tools: 'TOOLS',
  depot: 'WOOD DEPOT',
  upgrades: 'UPGRADES',
  prestige: 'PRESTIGE',
}

export const STATION_ACCENTS: Record<StationKind, string> = {
  tools: '#f0b44d',
  depot: '#6fb979',
  upgrades: '#70a6ff',
  prestige: '#cf8dff',
}

export const TREE_SPECS: Record<
  TreeKind,
  {
    baseHealth: number
    reward: number
    minAxeTier: number
    trunk: string
    tint: string
    canopy: 'cone' | 'round' | 'wide'
  }
> = {
  sapling: {
    baseHealth: 4,
    reward: 1,
    minAxeTier: 0,
    trunk: '#8b5d32',
    tint: '#5fb65d',
    canopy: 'cone',
  },
  normal: {
    baseHealth: 8,
    reward: 3,
    minAxeTier: 1,
    trunk: '#805026',
    tint: '#2f8345',
    canopy: 'round',
  },
  veteran: {
    baseHealth: 20,
    reward: 8,
    minAxeTier: 2,
    trunk: '#68411f',
    tint: '#1f5f3d',
    canopy: 'wide',
  },
  brittle: {
    baseHealth: 12,
    reward: 2,
    minAxeTier: 1,
    trunk: '#8d6b4a',
    tint: '#769057',
    canopy: 'cone',
  },
  mythic: {
    baseHealth: 34,
    reward: 14,
    minAxeTier: 4,
    trunk: '#5f4e67',
    tint: '#66c7c8',
    canopy: 'wide',
  },
}

export const TUNABLES = {
  worldRadius: 86,
  playerBaseSpeed: 8.2,
  playerSpeedPerTier: 0.55,
  mouseLookSensitivity: 0.0038,
  swingRange: 2.65,
  logSwingRange: 2.8,
  targetAssistRadius: 1.05,
  logTargetAssistRadius: 1.35,
  closeTargetRange: 1.25,
  targetConeDot: -0.15,
  swingWindup: 0.42,
  swingRecovery: 0.24,
  treeShakeDuration: 0.36,
  treeShakeFrequency: 18,
  treeShakeMaxAngle: 0.16,
  holdSwingRepeatDelay: 0.04,
  comboWindow: 0.95,
  comboMax: 3,
  comboFinalMultiplier: 2,
  fallDuration: 1.15,
  treeAngularGravity: 3.15,
  treeAngularDamping: 0.9,
  treeInitialAngularVelocity: 0.68,
  cascadeAngularVelocityMultiplier: 1.45,
  cascadeImpulseMaxMultiplier: 1.8,
  treeSweepStartAngle: 0.34,
  treeImpactAngle: 0.92,
  treeGroundAngle: Math.PI * 0.5,
  logLandDuration: 0.85,
  logLaunchSpeed: 2.6,
  logRollGravity: 7.2,
  logRollRadius: 0.34,
  logFriction: 1.25,
  logAngularDamping: 2.1,
  logLongitudinalGrip: 0.92,
  logImpactRadius: 1.12,
  logImpactDamage: 2,
  logImpactMinSpeed: 0.8,
  halfLogMinReward: 3,
  halfLogHealthMultiplier: 0.56,
  halfLogLaunchSpeed: 1.9,
  logHitKickSpeed: 2.45,
  logHitSpin: 5.2,
  treeHeight: 4.8,
  treeImpactRadius: 1.95,
  treeImpactDamage: 4,
  treeImpactEnergyDamage: 1.35,
  playerRadius: 0.58,
  treeCollisionRadius: 0.58,
  logCollisionRadius: 0.5,
  stationCollisionRadius: 1.85,
  woodItemMagnetRange: 3.2,
  woodItemPickupRange: 0.42,
  woodItemMagnetSpeed: 9.5,
  stationRange: 3.7,
  feedbackLifetime: 0.9,
  starterSaplings: 62,
  totalTrees: 130,
  hubRadius: 13,
  spawnPadRadius: 7,
  prestigeCost: 900,
} as const
