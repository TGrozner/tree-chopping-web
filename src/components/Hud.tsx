import type { GameState } from '../game/types'

type Props = {
  state: GameState
}

export const Hud = ({ state }: Props) => {
  const standing = state.trees.filter((tree) => tree.status === 'standing').length
  const falling = state.trees.filter((tree) => tree.status === 'falling').length
  const fallen = state.trees.filter((tree) => tree.status === 'fallen').length
  const target = state.currentTargetId ?? 'none'

  return (
    <div className="hud">
      <div className="hud-card main-hud">
        <div>wood: {state.wood}</div>
        <div>axe: lvl {state.axeLevel}</div>
        <div>target: {target}</div>
      </div>
      <div className="hud-card debug-hud" data-testid="debug-overlay">
        <div>trees standing/falling/fallen: {standing}/{falling}/{fallen}</div>
        <div>logs: {state.logs.filter((log) => log.status === 'whole').length}</div>
        <div>chunks: {state.chunks.filter((chunk) => !chunk.collected).length}</div>
        <div>chops: {state.stats.chops}</div>
        <div>cascades: {state.stats.cascades}</div>
      </div>
      <div className="hint">WASD move · Space/click chop · chop fallen logs into chunks · collect wood to upgrade</div>
    </div>
  )
}
