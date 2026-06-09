import { backpackCapacity, backpackTotal } from '../game/systems'
import { AXE_NAMES, AXE_COSTS, BACKPACK_CAPS, TUNABLES, WOOD_TYPES } from '../game/tunables'
import type { GameState, Inventory, Station } from '../game/types'

type Props = {
  onResetRun: () => void
  state: GameState
}

const inventoryText = (inventory: Inventory): string =>
  WOOD_TYPES.map((type) => inventory[type]).join(' / ')

const nextAxeCost = (state: GameState): string => {
  const nextTier = state.axeTier + 1
  if (nextTier >= AXE_NAMES.length) return 'max'
  return inventoryText(AXE_COSTS[nextTier])
}

const stationAction = (station: Station | undefined, state: GameState): string => {
  if (!station) return 'forest'
  if (station.kind === 'depot') return backpackTotal(state) > 0 ? 'deposit backpack' : 'backpack empty'
  if (station.kind === 'tools') return `buy ${AXE_NAMES[Math.min(state.axeTier + 1, AXE_NAMES.length - 1)]}`
  if (station.kind === 'upgrades') return state.backpackTier + 1 < BACKPACK_CAPS.length ? 'upgrade pack/speed' : 'upgrade passives'
  return `prestige ${TUNABLES.prestigeCost}`
}

const targetLabel = (state: GameState): string => {
  if (!state.currentTargetId) return 'none'
  const tree = state.trees.find((candidate) => candidate.id === state.currentTargetId)
  if (tree?.status === 'fallen') return `${tree.woodType} trunk ${tree.logHealth}/${tree.logMaxHealth}`
  if (tree) return `${tree.kind} ${tree.health}/${tree.maxHealth}`
  return state.currentTargetId
}

export const Hud = ({ onResetRun, state }: Props) => {
  const standing = state.trees.filter((tree) => tree.status === 'standing').length
  const activeStation = state.stations.find((station) => station.id === state.activeStationId)
  const packTotal = backpackTotal(state)
  const packCap = backpackCapacity(state)
  const comboPips = Array.from({ length: TUNABLES.comboMax }, (_, index) => index < state.swing.combo)

  return (
    <div className="hud">
      <div className="top-left-hud">
        <section className="resource-panel" aria-label="Resources">
          <div className="panel-title">stockpile</div>
          <div className="resource-row">
            <span>wood / fine / core</span>
            <strong>{inventoryText(state.stockpile)}</strong>
          </div>
          <div className="resource-row">
            <span>backpack</span>
            <strong>
              {packTotal}/{packCap}
            </strong>
          </div>
        </section>
        <section className="tool-panel" aria-label="Tool">
          <div className="panel-title">tool</div>
          <div className="tool-name">{AXE_NAMES[state.axeTier]}</div>
          <div className="micro-copy">next {nextAxeCost(state)}</div>
        </section>
      </div>

      <div className="combo-pips" aria-label="Combo">
        {comboPips.map((active, index) => (
          <i key={index} className={active ? 'is-active' : ''} />
        ))}
      </div>

      <section className={`station-panel ${activeStation ? 'is-active' : ''}`} aria-label="Station">
        <div className="panel-title">{activeStation?.label ?? 'summit forest'}</div>
        <div className="station-action">{stationAction(activeStation, state)}</div>
        <div className="micro-copy">{state.message}</div>
      </section>

      <section className="target-panel" aria-label="Target">
        <span>target</span>
        <strong>{targetLabel(state)}</strong>
      </section>

      <details className="debug-hud" data-testid="debug-overlay">
        <summary>debug</summary>
        <div>trees standing/falling/fallen: {standing}/{state.trees.length - standing - state.trees.filter((tree) => tree.status === 'fallen').length}/{state.trees.filter((tree) => tree.status === 'fallen').length}</div>
        <div>fallen trunks: {state.trees.filter((tree) => tree.status === 'fallen' && !tree.splitDone).length}</div>
        <div>items: {state.woodItems.filter((item) => !item.collected).length}</div>
        <div>swings/hits: {state.stats.swings}/{state.stats.hits}</div>
        <div>blocked: {state.stats.blockedHits}</div>
        <button className="debug-reset" onClick={onResetRun} type="button">reset run</button>
      </details>
    </div>
  )
}
