import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/game/createWorld'
import { loadGameState, removeGameState, saveGameState, SAVE_KEY } from '../src/game/persistence'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe('game persistence', () => {
  it('saves progression and reloads without transient swing feedback', () => {
    const storage = new MemoryStorage()
    const state = createWorld()
    state.stockpile.wood = 12
    state.axeTier = 1
    state.selectedUpgrade = 'power'
    state.swing.phase = 'windup'
    state.feedback.push({ id: 99, kind: 'hit', label: '-1', position: { x: 0, z: 0 }, age: 0 })

    expect(saveGameState(storage, state)).toBe(true)
    const loaded = loadGameState(storage)

    expect(storage.getItem(SAVE_KEY)).toBeTruthy()
    expect(loaded?.stockpile.wood).toBe(12)
    expect(loaded?.axeTier).toBe(1)
    expect(loaded?.selectedUpgrade).toBe('power')
    expect(loaded?.swing.phase).toBe('idle')
    expect(loaded?.feedback).toEqual([])
    expect(loaded?.message).toBe('Progress loaded.')
  })

  it('removes a saved run', () => {
    const storage = new MemoryStorage()
    saveGameState(storage, createWorld())

    removeGameState(storage)

    expect(storage.getItem(SAVE_KEY)).toBeNull()
    expect(loadGameState(storage)).toBeNull()
  })
})
