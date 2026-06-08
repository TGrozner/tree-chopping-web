import { clamp, distance, vec } from './math'
import type { Vec2 } from './types'

const noise = (x: number, z: number): number => {
  const n = Math.sin(x * 0.19 + z * 0.31) + Math.sin(x * 0.43 - z * 0.17) * 0.55
  return n * 0.32
}

export const terrainHeightAt = (position: Vec2): number => {
  const center = vec(-1.5, 0)
  const radius = distance(position, center)
  const plateau = 14
  const crown = 4.6
  const slope = Math.max(0, radius - plateau) * 0.085
  const shoulder = Math.max(0, radius - 48) * 0.045
  const raw = crown - slope - shoulder + noise(position.x, position.z)
  const padBlend = clamp((radius - 8) / 8, 0, 1)
  return Math.max(0.12, raw * padBlend + crown * (1 - padBlend))
}

export const biomeForPosition = (position: Vec2): 'summit' | 'pine' | 'oldwood' | 'core' => {
  const radius = Math.sqrt(position.x * position.x + position.z * position.z)
  if (radius < 24) return 'summit'
  if (radius < 46) return 'pine'
  if (radius < 66) return 'oldwood'
  return 'core'
}
