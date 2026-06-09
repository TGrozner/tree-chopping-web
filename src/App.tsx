import { GameCanvas } from './components/GameCanvas'
import { GameControls } from './components/GameControls'
import { Hud } from './components/Hud'
import { useTreeChoppingGame } from './hooks/useTreeChoppingGame'
import './styles.css'

const App = () => {
  const { controls, saveStatus, stateRef, state } = useTreeChoppingGame()

  return (
    <main className="app-shell">
      <GameCanvas stateRef={stateRef} />
      <Hud
        onRequestUpgrade={controls.requestUpgrade}
        onResetRun={controls.resetRun}
        onSaveRun={controls.saveNow}
        saveStatus={saveStatus}
        state={state}
      />
      <GameControls controls={controls} />
    </main>
  )
}

export default App
