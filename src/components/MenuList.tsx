import type { MenuItem } from './menu-types'
import { getVisibleRange } from '../lib/navigation'

const VISIBLE_ROWS = 6

interface MenuListProps {
  items: MenuItem[]
  selected: number
  onActivate: (index: number) => void
}

export function MenuList({ items, selected, onActivate }: MenuListProps) {
  if (items.length === 0) {
    return <div className="menu-empty">Empty</div>
  }

  if (items.length === 1 && items[0]?.centered) {
    const item = items[0]
    return (
      <div className="menu-list menu-list-single" role="listbox" aria-label="Menu">
        <div
          className="menu-row centered selected"
          role="option"
          aria-selected="true"
          onClick={() => onActivate(0)}
        >
          <span className="menu-label">{item.label}</span>
        </div>
      </div>
    )
  }

  const { start, end } = getVisibleRange(selected, items.length, VISIBLE_ROWS)
  const visibleItems = items.slice(start, end)
  const showScrollbar = items.length > VISIBLE_ROWS
  const thumbHeight = showScrollbar
    ? Math.max(14, (VISIBLE_ROWS / items.length) * 100)
    : 0
  const maxStart = Math.max(1, items.length - VISIBLE_ROWS)
  const thumbTop = showScrollbar ? (start / maxStart) * (100 - thumbHeight) : 0

  return (
    <div className="menu-list" role="listbox" aria-label="Menu">
      {visibleItems.map((item, offset) => {
        const index = start + offset
        const isSelected = index === selected

        return (
          <div
            key={item.id}
            className={`menu-row${isSelected ? ' selected' : ''}${item.centered ? ' centered' : ''}${item.disabled ? ' disabled' : ''}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={item.disabled || undefined}
            onClick={() => onActivate(index)}
          >
            <span className="menu-label">{item.label}</span>
            {item.swatch && (
              <span
                className="menu-swatch"
                style={{ background: item.swatch }}
                aria-hidden="true"
              />
            )}
            {item.value !== undefined && <span className="menu-value">{item.value}</span>}
            {item.chevron && <span className="menu-chevron" aria-hidden="true" />}
          </div>
        )
      })}

      {showScrollbar && (
        <div className="menu-scrollbar" aria-hidden="true">
          <span style={{ height: `${thumbHeight}%`, top: `${thumbTop}%` }} />
        </div>
      )}
    </div>
  )
}
