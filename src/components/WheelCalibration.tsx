import { useEffect, useState } from 'react'
import { clampWheelStep } from '../lib/settings'

const GESTURE_GAP_MS = 200
const SETTLE_MS = 260

interface WheelCalibrationProps {
  currentStep: number
  onCalibrate: (step: number) => void
  onActivity: () => void
}

export function WheelCalibration({
  currentStep,
  onCalibrate,
  onActivity,
}: WheelCalibrationProps) {
  const [measurement, setMeasurement] = useState<number | null>(null)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    const element = document.querySelector<HTMLElement>('.scroll-wheel')
    if (!element) return

    let accumulated = 0
    let lastEventAt = 0
    let settleTimer: number | null = null

    const finish = () => {
      settleTimer = null
      if (accumulated <= 0) {
        setIsMeasuring(false)
        return
      }

      const step = clampWheelStep(accumulated)
      setMeasurement(step)
      setIsMeasuring(false)
      setApplied(true)
      onCalibrate(step)
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      onActivity()

      const now = performance.now()
      if (now - lastEventAt > GESTURE_GAP_MS) accumulated = 0
      lastEventAt = now

      const rawDelta = event.deltaY !== 0 ? event.deltaY : event.deltaX
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? rawDelta * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? rawDelta * 100
            : rawDelta
      if (delta === 0) return

      if (settleTimer !== null) window.clearTimeout(settleTimer)
      accumulated += Math.abs(delta)
      setMeasurement(Math.round(accumulated))
      setIsMeasuring(true)
      setApplied(false)
      settleTimer = window.setTimeout(finish, SETTLE_MS)
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
      if (settleTimer !== null) window.clearTimeout(settleTimer)
    }
  }, [onActivity, onCalibrate])

  const heading = applied ? 'Calibrated' : 'Scroll one notch'
  const status = applied ? 'Applied' : isMeasuring ? 'Measuring…' : 'Hover the ring'

  return (
    <div className={`wheel-calibration${applied ? ' is-applied' : ''}`}>
      <div className="wheel-calibration-heading">{heading}</div>
      <div className="wheel-calibration-value" aria-live="polite">
        {measurement === null ? '—' : measurement}
        {measurement === null ? null : <span className="wheel-calibration-unit"> px</span>}
      </div>
      <div className="wheel-calibration-caption">
        {measurement === null ? `Current ${Math.round(currentStep)} px` : '1 notch'}
      </div>
      <div className="wheel-calibration-status">{status}</div>
      <div className="wheel-calibration-hint">Menu to exit</div>
    </div>
  )
}
