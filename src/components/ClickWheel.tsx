import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { NextIcon, PlayPauseIcon, PreviousIcon } from './Icons'

const STEP_RADIANS = Math.PI / 12
const DEFAULT_SELECT_HOLD_MS = 5000

interface ClickWheelProps {
  isPlaying: boolean
  wheelThreshold: number
  isHidden?: boolean
  onStep: (direction: number) => void
  onSelect: () => void
  onSelectHold?: () => void
  selectHoldMs?: number
  onMenu: () => void
  onPrevious: () => void
  onNext: () => void
  onPlayPause: () => void
  onActivity: () => void
}

interface DragState {
  pointerId: number
  lastAngle: number
  accumulated: number
}

export function ClickWheel({
  isPlaying,
  wheelThreshold,
  isHidden = false,
  onStep,
  onSelect,
  onSelectHold,
  selectHoldMs = DEFAULT_SELECT_HOLD_MS,
  onMenu,
  onPrevious,
  onNext,
  onPlayPause,
  onActivity,
}: ClickWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const wheelStepAccumulator = useRef(0)
  const lastWheelAt = useRef(0)
  const selectHoldTimer = useRef<number | null>(null)
  const selectHoldTriggered = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const element = isHidden
      ? document.querySelector<HTMLElement>('.screen-bezel')
      : wheelRef.current
    if (!element) return

    wheelStepAccumulator.current = 0

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const now = performance.now()
      if (now - lastWheelAt.current > 200) {
        wheelStepAccumulator.current = 0
      }
      lastWheelAt.current = now

      const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? rawDelta * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rawDelta * 100
            : rawDelta
      if (delta === 0) return

      wheelStepAccumulator.current += delta
      let steps = 0
      while (Math.abs(wheelStepAccumulator.current) >= wheelThreshold && steps < 8) {
        const direction = wheelStepAccumulator.current > 0 ? 1 : -1
        wheelStepAccumulator.current -= direction * wheelThreshold
        onStep(direction)
        onActivity()
        steps += 1
      }
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [isHidden, onActivity, onStep, wheelThreshold])

  function clearSelectHold() {
    if (selectHoldTimer.current === null) return
    window.clearTimeout(selectHoldTimer.current)
    selectHoldTimer.current = null
  }

  function beginSelectHold(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!onSelectHold) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    clearSelectHold()
    selectHoldTriggered.current = false
    selectHoldTimer.current = window.setTimeout(() => {
      selectHoldTimer.current = null
      selectHoldTriggered.current = true
      onSelectHold()
    }, selectHoldMs)
  }

  function finishSelectHold() {
    clearSelectHold()
  }

  function handleSelectClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (selectHoldTriggered.current) {
      selectHoldTriggered.current = false
      event.preventDefault()
      return
    }
    onSelect()
  }

  useEffect(() => {
    if (onSelectHold || selectHoldTimer.current === null) return
    window.clearTimeout(selectHoldTimer.current)
    selectHoldTimer.current = null
  }, [onSelectHold])

  useEffect(
    () => () => {
      if (selectHoldTimer.current !== null) {
        window.clearTimeout(selectHoldTimer.current)
      }
    },
    [],
  )

  function angleAt(clientX: number, clientY: number): number {
    const element = wheelRef.current
    if (!element) return 0

    const rect = element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    return Math.atan2(clientY - centerY, clientX - centerX)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      lastAngle: angleAt(event.clientX, event.clientY),
      accumulated: 0,
    }
    setIsDragging(true)
    onActivity()
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const angle = angleAt(event.clientX, event.clientY)
    let delta = angle - drag.lastAngle

    if (delta > Math.PI) delta -= Math.PI * 2
    if (delta < -Math.PI) delta += Math.PI * 2

    drag.lastAngle = angle
    drag.accumulated += delta

    while (Math.abs(drag.accumulated) >= STEP_RADIANS) {
      const direction = drag.accumulated > 0 ? 1 : -1
      drag.accumulated -= direction * STEP_RADIANS
      onStep(direction)
    }

    onActivity()
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = null
    setIsDragging(false)
    onActivity()
  }

  function handleMiddleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button === 1) event.preventDefault()
  }

  function handleMiddleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    onSelect()
  }

  return (
    <div
      className="wheel-area"
      aria-hidden={isHidden || undefined}
      inert={isHidden || undefined}
      onMouseDown={handleMiddleMouseDown}
      onAuxClick={handleMiddleClick}
    >
      <div className="wheel" role="group" aria-label="Click wheel">
        <button
          type="button"
          className="wheel-button wheel-menu"
          onClick={onMenu}
          aria-label="Back"
        >
          <svg
            className="wheel-menu-label"
            viewBox="0 0 400 150"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <path
                id="wheel-menu-curve"
                d="M31.234 97.495S92.808 41.234 200 41.234c121.84 0 168.766 56.26 168.766 56.26"
              />
            </defs>
            <text>
              <textPath href="#wheel-menu-curve" startOffset="112">
                menu
              </textPath>
            </text>
          </svg>
        </button>

        <button
          type="button"
          className="wheel-button wheel-prev"
          onClick={onPrevious}
          aria-label="Previous track"
        >
          <PreviousIcon />
        </button>

        <button
          type="button"
          className="wheel-button wheel-next"
          onClick={onNext}
          aria-label="Next track"
        >
          <NextIcon />
        </button>

        <button
          type="button"
          className="wheel-button wheel-play"
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <PlayPauseIcon />
        </button>

        <div className="wheel-dividers" aria-hidden="true" />

        <div
          ref={wheelRef}
          className={`scroll-wheel${isDragging ? ' is-dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          role="group"
          aria-label="Scroll wheel. Drag around the ring to scroll."
        />

        <button
          type="button"
          className="wheel-center"
          onPointerDown={beginSelectHold}
          onPointerUp={finishSelectHold}
          onPointerCancel={finishSelectHold}
          onPointerLeave={finishSelectHold}
          onClick={handleSelectClick}
          aria-label="Select"
        />
      </div>
    </div>
  )
}
