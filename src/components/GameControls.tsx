import type { MoveInputKey } from '../hooks/useTreeChoppingGame'

type ControlsApi = {
  setMoveInput: (key: MoveInputKey, value: boolean) => void
  requestChop: () => void
  setChopHeld: (value: boolean) => void
  requestDeposit: () => void
  requestInteract: () => void
  requestTeleport: () => void
  resetRun: () => void
}

type Props = {
  controls: ControlsApi
}

type MoveButtonProps = {
  className: string
  controls: ControlsApi
  keyName: MoveInputKey
  label: string
  symbol: string
}

const stop = (event: React.PointerEvent<HTMLButtonElement>): void => {
  event.preventDefault()
  event.stopPropagation()
}

const MoveButton = ({ className, controls, keyName, label, symbol }: MoveButtonProps) => (
  <button
    aria-label={label}
    className={`touch-button move-button ${className}`}
    onPointerDown={(event) => {
      stop(event)
      controls.setMoveInput(keyName, true)
    }}
    onPointerUp={(event) => {
      stop(event)
      controls.setMoveInput(keyName, false)
    }}
    onPointerCancel={(event) => {
      stop(event)
      controls.setMoveInput(keyName, false)
    }}
    onPointerLeave={(event) => {
      stop(event)
      controls.setMoveInput(keyName, false)
    }}
    type="button"
  >
    {symbol}
  </button>
)

export const GameControls = ({ controls }: Props) => (
  <div className="touch-controls" aria-label="Touch controls">
    <div className="dpad">
      <MoveButton className="dpad-up" controls={controls} keyName="up" label="Move up" symbol="^" />
      <MoveButton className="dpad-left" controls={controls} keyName="left" label="Move left" symbol="<" />
      <MoveButton className="dpad-down" controls={controls} keyName="down" label="Move down" symbol="v" />
      <MoveButton className="dpad-right" controls={controls} keyName="right" label="Move right" symbol=">" />
    </div>
    <button
      aria-label="Chop"
      className="touch-button chop-button"
      onPointerDown={(event) => {
        stop(event)
        controls.setChopHeld(true)
      }}
      onPointerUp={(event) => {
        stop(event)
        controls.setChopHeld(false)
      }}
      onPointerCancel={(event) => {
        stop(event)
        controls.setChopHeld(false)
      }}
      onPointerLeave={(event) => {
        stop(event)
        controls.setChopHeld(false)
      }}
      type="button"
    >
      AX
    </button>
    <div className="action-stack">
      <button
        aria-label="Interact"
        className="touch-button small-action"
        onPointerDown={(event) => {
          stop(event)
          controls.requestInteract()
        }}
        type="button"
      >
        E
      </button>
      <button
        aria-label="Teleport home"
        className="touch-button small-action"
        onPointerDown={(event) => {
          stop(event)
          controls.requestTeleport()
        }}
        type="button"
      >
        R
      </button>
      <button
        aria-label="Reset run"
        className="touch-button small-action"
        onPointerDown={(event) => {
          stop(event)
          controls.resetRun()
        }}
        type="button"
      >
        RS
      </button>
    </div>
  </div>
)
