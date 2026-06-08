import { useEffect, useRef, type MutableRefObject } from 'react'
import { Renderer } from '../render/Renderer'
import type { GameState } from '../game/types'

type Props = {
  stateRef: MutableRefObject<GameState>
}

export const GameCanvas = ({ stateRef }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new Renderer(canvas)
    let raf = 0
    const render = (): void => {
      renderer.render(stateRef.current)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [stateRef])

  return <canvas className="game-canvas" ref={canvasRef} aria-label="Tree Chopping Web game canvas" />
}
