import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

type Corner = 'nw' | 'ne' | 'sw' | 'se'

interface ResizeDrag {
  pointerId: number
  corner: Corner
  screenX: number
  screenY: number
  windowX: number
  windowY: number
  windowWidth: number
  windowHeight: number
}

const NORMAL_ASPECT_RATIO = 439 / 716
const NORMAL_MIN_WIDTH = 300
const COMPACT_ASPECT_RATIO = 344 / 294
const COMPACT_MIN_WIDTH = 236

function windowMetrics() {
  const minimized = document.querySelector('.ipod')?.classList.contains('is-minimized')
  return minimized
    ? { aspectRatio: COMPACT_ASPECT_RATIO, minWidth: COMPACT_MIN_WIDTH }
    : { aspectRatio: NORMAL_ASPECT_RATIO, minWidth: NORMAL_MIN_WIDTH }
}

export function WindowResizeHandles() {
  const dragRef = useRef<ResizeDrag | null>(null)

  function resizeTo(screenX: number, screenY: number) {
    const drag = dragRef.current
    const api = window.ipodDesktop
    if (!drag || !api) return

    const { aspectRatio, minWidth } = windowMetrics()
    const dx = screenX - drag.screenX
    const dy = screenY - drag.screenY
    const widthDelta = drag.corner.includes('w') ? -dx : dx
    const heightDelta = drag.corner.includes('n') ? -dy : dy
    const scaleX = (drag.windowWidth + widthDelta) / drag.windowWidth
    const scaleY = (drag.windowHeight + heightDelta) / drag.windowHeight
    const scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY
    const width = Math.max(minWidth, drag.windowWidth * scale)
    const height = width / aspectRatio
    const x = drag.corner.includes('w') ? drag.windowX + drag.windowWidth - width : drag.windowX
    const y = drag.corner.includes('n') ? drag.windowY + drag.windowHeight - height : drag.windowY

    api.resizeWindow({ x, y, width, height })
  }

  useEffect(() => {
    const finish = () => {
      dragRef.current = null
    }

    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current) return
      if (event.buttons === 0) {
        finish()
        return
      }
      resizeTo(event.screenX, event.screenY)
    }

    window.addEventListener('pointermove', handleMove, true)
    window.addEventListener('pointerup', finish, true)
    window.addEventListener('pointercancel', finish, true)
    window.addEventListener('blur', finish)
    document.addEventListener('pointerleave', finish)
    return () => {
      window.removeEventListener('pointermove', handleMove, true)
      window.removeEventListener('pointerup', finish, true)
      window.removeEventListener('pointercancel', finish, true)
      window.removeEventListener('blur', finish)
      document.removeEventListener('pointerleave', finish)
    }
  }, [])

  function beginResize(corner: Corner, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!window.ipodDesktop) return

    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      pointerId: event.pointerId,
      corner,
      screenX: event.screenX,
      screenY: event.screenY,
      windowX: window.screenX,
      windowY: window.screenY,
      windowWidth: window.outerWidth,
      windowHeight: window.outerHeight,
    }
  }

  const handleProps = (corner: Corner) => ({
    className: `desktop-resize-handle desktop-resize-${corner}`,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => beginResize(corner, event),
  })

  return (
    <div className="desktop-resize-handles" aria-hidden="true">
      <div {...handleProps('nw')} />
      <div {...handleProps('ne')} />
      <div {...handleProps('sw')} />
      <div {...handleProps('se')} />
    </div>
  )
}
