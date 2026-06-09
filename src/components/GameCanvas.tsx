import { useEffect, useRef, type MutableRefObject } from 'react'
import type { GameState } from '../game/types'

type Props = {
  stateRef: MutableRefObject<GameState>
}

export const GameCanvas = ({ stateRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let raf = 0
    let renderer: import('../render/Renderer').Renderer | null = null

    void import('../render/Renderer').then(({ Renderer }) => {
      if (disposed) return
      renderer = new Renderer(canvas)
      const render = (): void => {
        renderer?.render(stateRef.current)
        raf = requestAnimationFrame(render)
      }
      raf = requestAnimationFrame(render)
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      renderer?.dispose()
    }
  }, [stateRef])

  return <canvas className="game-canvas" ref={canvasRef} aria-label="Tree Chopping Web game canvas" />
}
