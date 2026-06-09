import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createWorld } from '../game/createWorld'
import { getDebugSnapshot } from '../game/debug'
import { loadGameState, removeGameState, saveGameState } from '../game/persistence'
import { createEmptyInput, stepGame } from '../game/systems'
import { normalize, vec } from '../game/math'
import type { FeedbackEvent, GameInput, GameState } from '../game/types'

export type MoveInputKey = 'up' | 'down' | 'left' | 'right'

const keyToInput = (input: GameInput, code: string, value: boolean): void => {
  if (code === 'KeyW' || code === 'ArrowUp') input.up = value
  if (code === 'KeyS' || code === 'ArrowDown') input.down = value
  if (code === 'KeyA' || code === 'ArrowLeft') input.left = value
  if (code === 'KeyD' || code === 'ArrowRight') input.right = value
}

const browserStorage = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const useTreeChoppingGame = () => {
  const initialState = useMemo(() => loadGameState(browserStorage()) ?? createWorld(), [])
  const stateRef = useRef<GameState>(initialState)
  const inputRef = useRef<GameInput>(createEmptyInput())
  const lookHeldRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)
  const playedFeedbackRef = useRef<Set<number>>(new Set())
  const lastSaveRef = useRef(0)
  const [, forceRender] = useState(0)

  const ensureAudio = useCallback((): AudioContext | null => {
    if (audioRef.current) {
      void audioRef.current.resume()
      return audioRef.current
    }
    const contextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!contextCtor) return null
    const context = new contextCtor()
    audioRef.current = context
    return context
  }, [])

  const playFeedbackSound = useCallback((event: FeedbackEvent): void => {
    const context = audioRef.current
    if (!context) return
    const now = context.currentTime
    const output = context.createGain()
    output.connect(context.destination)

    const isThud = event.kind === 'impact' || event.kind === 'fall'
    const isSplit = event.kind === 'split'
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(output)
    oscillator.type = isThud ? 'sine' : isSplit ? 'sawtooth' : 'triangle'
    oscillator.frequency.setValueAtTime(isThud ? 74 : isSplit ? 220 : 165, now)
    oscillator.frequency.exponentialRampToValueAtTime(isThud ? 38 : isSplit ? 130 : 92, now + (isThud ? 0.22 : 0.08))
    gain.gain.setValueAtTime(isThud ? 0.18 : isSplit ? 0.09 : 0.055, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isThud ? 0.28 : 0.11))
    output.gain.setValueAtTime(0.75, now)
    oscillator.start(now)
    oscillator.stop(now + (isThud ? 0.3 : 0.13))
  }, [])

  const playNewFeedbackSounds = useCallback((): void => {
    for (const event of stateRef.current.feedback) {
      if (playedFeedbackRef.current.has(event.id)) continue
      playedFeedbackRef.current.add(event.id)
      if (!['hit', 'cleave', 'impact', 'fall', 'split'].includes(event.kind)) continue
      playFeedbackSound(event)
    }
  }, [playFeedbackSound])

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

  const saveNow = useCallback((): void => {
    saveGameState(browserStorage(), stateRef.current)
    lastSaveRef.current = performance.now()
  }, [])

  const resetRun = useCallback((): void => {
    removeGameState(browserStorage())
    stateRef.current = createWorld()
    inputRef.current = createEmptyInput()
    playedFeedbackRef.current.clear()
    lastSaveRef.current = 0
    forceRender((value) => value + 1)
  }, [])

  const controls = useMemo(
    () => ({ setMoveInput, requestChop, requestDeposit, requestInteract, requestTeleport, resetRun, setChopHeld }),
    [requestChop, requestDeposit, requestInteract, requestTeleport, resetRun, setChopHeld, setMoveInput],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      ensureAudio()
      keyToInput(inputRef.current, event.code, true)
      if (event.code === 'Space') setChopHeld(true)
      if ((event.code === 'KeyE' || event.code === 'Enter') && !event.repeat) requestInteract()
      if (event.code === 'KeyF' && !event.repeat) requestDeposit()
      if (event.code === 'KeyR' && !event.repeat) requestTeleport()
      if (event.code === 'Backspace' && event.shiftKey && !event.repeat) resetRun()
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      keyToInput(inputRef.current, event.code, false)
      if (event.code === 'Space') setChopHeld(false)
    }
    const onMouseDown = (event: MouseEvent): void => {
      ensureAudio()
      if (event.button === 2) {
        lookHeldRef.current = true
        event.preventDefault()
        return
      }
      if (event.button !== 0) return
      if (event.target instanceof HTMLCanvasElement && document.pointerLockElement !== event.target) {
        event.target.requestPointerLock?.()
      }
      setChopHeld(true)
    }
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button === 2) {
        lookHeldRef.current = false
        event.preventDefault()
        return
      }
      if (event.button !== 0) return
      setChopHeld(false)
    }
    const onMouseMove = (event: MouseEvent): void => {
      if (!document.pointerLockElement && !lookHeldRef.current) return
      inputRef.current.lookDeltaX += event.movementX
    }
    const onContextMenu = (event: MouseEvent): void => {
      if (event.target instanceof HTMLCanvasElement) event.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [ensureAudio, requestDeposit, requestInteract, requestTeleport, resetRun, setChopHeld])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      stepGame(stateRef.current, inputRef.current, dt)
      playNewFeedbackSounds()
      if (now - lastSaveRef.current > 1200) saveNow()
      forceRender((value) => value + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playNewFeedbackSounds, saveNow])

  useEffect(() => {
    const onBeforeUnload = (): void => {
      saveGameState(browserStorage(), stateRef.current)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      onBeforeUnload()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
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
        const direction = normalize(vec(x, z), vec(1, 0))
        stateRef.current.player.facing = direction
        stateRef.current.player.cameraYaw = Math.atan2(direction.z, direction.x)
        forceRender((value) => value + 1)
      },
      look: (movementX: number) => {
        inputRef.current.lookDeltaX += movementX
        stepGame(stateRef.current, inputRef.current, 1 / 60)
        forceRender((value) => value + 1)
      },
      reset: () => {
        resetRun()
      },
      resetRun,
      saveNow,
    }
    return () => {
      delete window.__TREE_CHOPPING_TEST__
    }
  }, [resetRun, saveNow])

  return { controls, stateRef, state: stateRef.current }
}
