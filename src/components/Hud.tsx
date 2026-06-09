import { useEffect, useState, type SyntheticEvent } from 'react'
import {
  UPGRADE_CHOICES,
  backpackCapacity,
  backpackTotal,
  canAffordUpgrade,
  upgradeCost,
  upgradeLabel,
  upgradeMaxTier,
  upgradeTier,
} from '../game/systems'
import { AXE_NAMES, AXE_COSTS, TUNABLES, WOOD_TYPES } from '../game/tunables'
import type { SaveStatus } from '../hooks/useTreeChoppingGame'
import type { GameState, Inventory, Station, UpgradeKind } from '../game/types'

type Props = {
  onRequestUpgrade: (upgrade: UpgradeKind) => void
  onResetRun: () => void
  onSaveRun: () => void
  saveStatus: SaveStatus
  state: GameState
}

const inventoryText = (inventory: Inventory): string => WOOD_TYPES.map((type) => inventory[type]).join(' / ')

const nextAxeCost = (state: GameState): string => {
  const nextTier = state.axeTier + 1
  if (nextTier >= AXE_NAMES.length) return 'max'
  return inventoryText(AXE_COSTS[nextTier])
}

const stationAction = (station: Station | undefined, state: GameState): string => {
  if (!station) return 'forest'
  if (station.kind === 'depot') return backpackTotal(state) > 0 ? 'deposit backpack' : 'backpack empty'
  if (station.kind === 'tools') return `buy ${AXE_NAMES[Math.min(state.axeTier + 1, AXE_NAMES.length - 1)]}`
  if (station.kind === 'upgrades') {
    const cost = upgradeCost(state, state.selectedUpgrade)
    return cost === null ? `${upgradeLabel(state.selectedUpgrade)} max` : `buy ${upgradeLabel(state.selectedUpgrade)} ${cost}`
  }
  return `prestige ${TUNABLES.prestigeCost}`
}

const targetLabel = (state: GameState): string => {
  if (!state.currentTargetId) return 'none'
  const tree = state.trees.find((candidate) => candidate.id === state.currentTargetId)
  if (tree?.status === 'fallen') return `${tree.woodType} trunk ${tree.logHealth}/${tree.logMaxHealth}`
  if (tree) return `${tree.kind} ${tree.health}/${tree.maxHealth}`
  return state.currentTargetId
}

const saveLabel = (status: SaveStatus): string => {
  if (!status.ok) return 'save blocked'
  if (!status.lastSavedAt) return 'save pending'
  const age = Math.floor((Date.now() - status.lastSavedAt) / 1000)
  return age <= 1 ? 'saved now' : `saved ${Math.min(age, 99)}s ago`
}

const stopHudEvent = (event: SyntheticEvent): void => {
  event.stopPropagation()
}

export const Hud = ({ onRequestUpgrade, onResetRun, onSaveRun, saveStatus, state }: Props) => {
  const [resetConfirming, setResetConfirming] = useState(false)
  const standing = state.trees.filter((tree) => tree.status === 'standing').length
  const activeStation = state.stations.find((station) => station.id === state.activeStationId)
  const packTotal = backpackTotal(state)
  const packCap = backpackCapacity(state)
  const comboPips = Array.from({ length: TUNABLES.comboMax }, (_, index) => index < state.swing.combo)

  useEffect(() => {
    if (!resetConfirming) return undefined
    const timeout = window.setTimeout(() => setResetConfirming(false), 3200)
    return () => window.clearTimeout(timeout)
  }, [resetConfirming])

  const requestReset = (): void => {
    if (!resetConfirming) {
      setResetConfirming(true)
      return
    }
    setResetConfirming(false)
    onResetRun()
  }

  const requestSave = (): void => {
    setResetConfirming(false)
    onSaveRun()
  }

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
        {activeStation?.kind === 'upgrades' ? (
          <div className="upgrade-grid" onMouseDown={stopHudEvent} onPointerDown={stopHudEvent}>
            {UPGRADE_CHOICES.map((choice) => {
              const cost = upgradeCost(state, choice)
              const maxed = cost === null
              const affordable = canAffordUpgrade(state, choice)
              const selected = state.selectedUpgrade === choice
              return (
                <button
                  aria-label={`Upgrade ${upgradeLabel(choice)}`}
                  aria-pressed={selected}
                  className={`upgrade-button ${selected ? 'is-selected' : ''} ${affordable ? 'is-affordable' : ''}`}
                  disabled={maxed}
                  key={choice}
                  onClick={() => onRequestUpgrade(choice)}
                  type="button"
                >
                  <span className="upgrade-name">{upgradeLabel(choice)}</span>
                  <strong>{maxed ? 'max' : cost}</strong>
                  <span className="upgrade-tier">
                    {upgradeTier(state, choice)}/{upgradeMaxTier(choice)}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
        <div className="micro-copy">{state.message}</div>
      </section>

      <section className={`save-panel ${saveStatus.ok ? '' : 'is-error'}`} aria-label="Save">
        <span>{saveLabel(saveStatus)}</span>
        <button onClick={requestSave} onMouseDown={stopHudEvent} onPointerDown={stopHudEvent} type="button">
          save
        </button>
        <button
          className={resetConfirming ? 'is-danger' : ''}
          onClick={requestReset}
          onMouseDown={stopHudEvent}
          onPointerDown={stopHudEvent}
          type="button"
        >
          {resetConfirming ? 'confirm reset' : 'reset run'}
        </button>
      </section>

      <section className="target-panel" aria-label="Target">
        <span>target</span>
        <strong>{targetLabel(state)}</strong>
      </section>

      <details className="debug-hud" data-testid="debug-overlay">
        <summary>debug</summary>
        <div>
          trees standing/falling/fallen: {standing}/
          {state.trees.length - standing - state.trees.filter((tree) => tree.status === 'fallen').length}/
          {state.trees.filter((tree) => tree.status === 'fallen').length}
        </div>
        <div>fallen trunks: {state.trees.filter((tree) => tree.status === 'fallen' && !tree.splitDone).length}</div>
        <div>items: {state.woodItems.filter((item) => !item.collected).length}</div>
        <div>
          swings/hits: {state.stats.swings}/{state.stats.hits}
        </div>
        <div>blocked: {state.stats.blockedHits}</div>
        <button className="debug-reset" onClick={requestReset} type="button">
          {resetConfirming ? 'confirm reset' : 'reset run'}
        </button>
      </details>
    </div>
  )
}
