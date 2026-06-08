import type { Vec2 } from './types'

export const vec = (x: number, z: number): Vec2 => ({ x, z })

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })
export const scale = (v: Vec2, amount: number): Vec2 => ({ x: v.x * amount, z: v.z * amount })
export const rotate = (v: Vec2, radians: number): Vec2 => {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: v.x * cos - v.z * sin, z: v.x * sin + v.z * cos }
}
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z
export const lengthSq = (v: Vec2): number => dot(v, v)
export const distanceSq = (a: Vec2, b: Vec2): number => lengthSq(sub(a, b))
export const distance = (a: Vec2, b: Vec2): number => Math.sqrt(distanceSq(a, b))

export const normalize = (v: Vec2, fallback: Vec2 = { x: 0, z: 1 }): Vec2 => {
  const len = Math.sqrt(lengthSq(v))
  if (len < 0.0001) return fallback
  return { x: v.x / len, z: v.z / len }
}

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

export const nearestPointOnSegment = (p: Vec2, a: Vec2, b: Vec2): Vec2 => {
  const ab = sub(b, a)
  const t = clamp(dot(sub(p, a), ab) / Math.max(lengthSq(ab), 0.0001), 0, 1)
  return add(a, scale(ab, t))
}
