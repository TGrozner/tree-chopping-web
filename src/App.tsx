import { GameCanvas } from './components/GameCanvas'
import { Hud } from './components/Hud'
import { useTreeChoppingGame } from './hooks/useTreeChoppingGame'
import './styles.css'

const App = () => {
  const { stateRef, state } = useTreeChoppingGame()

  return (
    <main className="app-shell">
      <GameCanvas stateRef={stateRef} />
      <Hud state={state} />
    </main>
  )
}

export default App
