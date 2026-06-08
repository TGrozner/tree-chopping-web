import { useEffect, useRef, useState } from 'react'
import { createWorld } from '../game/createWorld'
import { getDebugSnapshot } from '../game/debug'
import { createEmptyInput, stepGame, chop } from '../game/systems'
import { normalize, vec } from '../game/math'
import type { GameInput, GameState } from '../game/types'

const keyToInput = (input: GameInput, code: string, value: boolean): void => {
  if (code === 'KeyW' || code === 'ArrowUp') input.up = value
  if (code === 'KeyS' || code === 'ArrowDown') input.down = value
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = value
  if (code === 'KeyD' || code === 'ArrowRight') input.right = value
}

export const useTreeChoppingGame = () => {
  const stateRef = useRef<GameState>(createWorld())
  const inputRef = useRef<GameInput>(createEmptyInput())
  const [, forceRender] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      keyToInput(inputRef.current, event.code, true)
      if (event.code === 'Space') inputRef.current.chopRequested = true
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      keyToInput(inputRef.current, event.code, false)
    }
    const onMouseDown = (): void => {
      inputRef.current.chopRequested = true
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      stepGame(stateRef.current, inputRef.current, dt)
      inputRef.current.chopRequested = false
      forceRender((value) => value + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    window.__TREE_CHOPPING_TEST__ = {
      getState: () => stateRef.current,
      getSnapshot: () => getDebugSnapshot(stateRef.current),
      step: (seconds: number) => {
        const fixedDt = 1 / 60
        const count = Math.ceil(seconds / fixedDt)
        for (let index = 0; index < count; index += 1) stepGame(stateRef.current, createEmptyInput(), fixedDt)
        forceRender((value) => value + 1)
      },
      chop: () => {
        chop(stateRef.current)
        forceRender((value) => value + 1)
      },
      movePlayerTo: (x: number, z: number) => {
        stateRef.current.player.position = vec(x, z)
        forceRender((value) => value + 1)
      },
      face: (x: number, z: number) => {
        stateRef.current.player.facing = normalize(vec(x, z), vec(0, 1))
        forceRender((value) => value + 1)
      },
      reset: () => {
        stateRef.current = createWorld()
        forceRender((value) => value + 1)
      },
    }
    return () => {
      delete window.__TREE_CHOPPING_TEST__
    }
  }, [])

  return { stateRef, state: stateRef.current }
}
