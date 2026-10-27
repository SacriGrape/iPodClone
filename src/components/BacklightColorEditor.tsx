import { hexToRgb } from '../lib/color'
import type { ColorChannel } from '../lib/color'

interface BacklightColorEditorProps {
  color: string
  channel: ColorChannel
  onSelectChannel: (channel: ColorChannel) => void
}

const CHANNELS: Array<{ key: ColorChannel; label: string }> = [
  { key: 'r', label: 'Red' },
  { key: 'g', label: 'Green' },
  { key: 'b', label: 'Blue' },
]

export function BacklightColorEditor({
  color,
  channel,
  onSelectChannel,
}: BacklightColorEditorProps) {
  const rgb = hexToRgb(color)

  return (
    <div className="backlight-editor">
      <div className="backlight-editor-hex" aria-live="polite">
        {color.toUpperCase()}
      </div>
      <div className="backlight-editor-channels" role="listbox" aria-label="RGB channels">
        {CHANNELS.map(({ key, label }) => (
          <div
            key={key}
            className={`backlight-editor-row${channel === key ? ' selected' : ''}`}
            role="option"
            aria-selected={channel === key}
            onClick={() => onSelectChannel(key)}
          >
            <span className="menu-label">{label}</span>
            <span className="backlight-editor-value">{rgb[key]}</span>
          </div>
        ))}
      </div>
      <div className="backlight-editor-hint">
        Wheel adjusts value · Select channel
      </div>
    </div>
  )
}
