import { describe, expect, it } from 'vitest'
import { createWorld } from '../src/game/createWorld'
import { selectUpgrade, tryUpgradeChoice } from '../src/game/systems'
import { BACKPACK_COSTS } from '../src/game/tunables'

describe('upgrade choices', () => {
  it('buys speed by default before backpack', () => {
    const state = createWorld(1)
    state.stockpile.wood = 14

    expect(tryUpgradeChoice(state)).toBe(true)

    expect(state.selectedUpgrade).toBe('speed')
    expect(state.speedTier).toBe(1)
    expect(state.backpackTier).toBe(0)
    expect(state.stockpile.wood).toBe(0)
  })

  it('does not spend wood when the selected backpack upgrade is unaffordable', () => {
    const state = createWorld(1)
    state.stockpile.wood = 14

    selectUpgrade(state, 'backpack')
    expect(tryUpgradeChoice(state)).toBe(false)

    expect(state.selectedUpgrade).toBe('backpack')
    expect(state.speedTier).toBe(0)
    expect(state.backpackTier).toBe(0)
    expect(state.stockpile.wood).toBe(14)
    expect(state.message).toBe(`Backpack costs ${BACKPACK_COSTS[1]} wood.`)
  })

  it('buys backpack when selected and affordable', () => {
    const state = createWorld(1)
    state.stockpile.wood = BACKPACK_COSTS[1]

    selectUpgrade(state, 'backpack')
    expect(tryUpgradeChoice(state)).toBe(true)

    expect(state.selectedUpgrade).toBe('backpack')
    expect(state.speedTier).toBe(0)
    expect(state.backpackTier).toBe(1)
    expect(state.stockpile.wood).toBe(0)
  })
})
