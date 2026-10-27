import { useCallback, useState } from 'react'
import type { Settings } from '../types'
import { loadSettings, saveSettings } from '../lib/settings'

export function useSettings(): {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
} {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
