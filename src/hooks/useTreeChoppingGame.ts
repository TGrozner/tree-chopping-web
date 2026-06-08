import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createWorld } from '../game/createWorld'
import { getDebugSnapshot } from '../game/debug'
import { createEmptyInput, stepGame } from '../game/systems'
import { normalize, vec } from '../game/math'
import type { GameInput, GameState } from '../game/types'

export type MoveInputKey = 'up' | 'down' | 'left' | 'right'

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

  const setMoveInput = useCallback((key: MoveInputKey, value: boolean): void => {
    inputRef.current[key] = value
  }, [])

  const requestChop = useCallback((): void => {
    inputRef.current.chopRequests += 1
  }, [])

  const setChopHeld = useCallback((value: boolean): void => {
    inputRef.current.chopHeld = value
    if (value) inputRef.current.chopRequests += 1
  }, [])

  const requestInteract = useCallback((): void => {
    inputRef.current.interactRequests += 1
  }, [])

  const requestDeposit = useCallback((): void => {
    inputRef.current.depositRequests += 1
  }, [])

  const requestTeleport = useCallback((): void => {
    inputRef.current.teleportRequests += 1
  }, [])

  const controls = useMemo(
    () => ({ setMoveInput, requestChop, requestDeposit, requestInteract, requestTeleport, setChopHeld }),
    [requestChop, requestDeposit, requestInteract, requestTeleport, setChopHeld, setMoveInput],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      keyToInput(inputRef.current, event.code, true)
      if (event.code === 'Space') setChopHeld(true)
      if ((event.code === 'KeyE' || event.code === 'Enter') && !event.repeat) requestInteract()
      if (event.code === 'KeyF' && !event.repeat) requestDeposit()
      if (event.code === 'KeyR' && !event.repeat) requestTeleport()
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      keyToInput(inputRef.current, event.code, false)
      if (event.code === 'Space') setChopHeld(false)
    }
    const onMouseDown = (): void => {
      setChopHeld(true)
    }
    const onMouseUp = (): void => {
      setChopHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [requestDeposit, requestInteract, requestTeleport, setChopHeld])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      stepGame(stateRef.current, inputRef.current, dt)
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
      queueChop: () => {
        inputRef.current.chopRequests += 1
        stepGame(stateRef.current, inputRef.current, 1 / 60)
        forceRender((value) => value + 1)
      },
      queueInteract: () => {
        inputRef.current.interactRequests += 1
        stepGame(stateRef.current, inputRef.current, 1 / 60)
        forceRender((value) => value + 1)
      },
      deposit: () => {
        inputRef.current.depositRequests += 1
        stepGame(stateRef.current, inputRef.current, 1 / 60)
        forceRender((value) => value + 1)
      },
      teleportHome: () => {
        inputRef.current.teleportRequests += 1
        stepGame(stateRef.current, inputRef.current, 1 / 60)
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

  return { controls, stateRef, state: stateRef.current }
}
