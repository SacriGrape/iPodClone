import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { Artist, MouseAction, Playlist, RepeatMode, Settings, Track } from '../types'
import type { Player, PlayerState } from '../lib/player'
import {
  BACKLIGHT_OPTIONS,
  CLICKER_OPTIONS,
  MOUSE_ACTION_OPTIONS,
  REPEAT_OPTIONS,
} from '../lib/settings'
import { formatBytes, formatDuration, formatLongDuration } from '../lib/format'
import { totalDuration, totalSize } from '../lib/library'
import { clampIndex, stepIndex } from '../lib/navigation'
import { BrickGame } from './BrickGame'
import type { BrickGameHandle } from './BrickGame'
import { ClickWheel } from './ClickWheel'
import { PlayIcon } from './Icons'
import { MenuList } from './MenuList'
import { NowPlaying } from './NowPlaying'
import { WheelCalibration } from './WheelCalibration'
import type { MenuItem } from './menu-types'

type View =
  | { type: 'main' }
  | { type: 'playlists' }
  | { type: 'playlist'; id: string }
  | { type: 'artists' }
  | { type: 'artist'; name: string }
  | { type: 'songs' }
  | { type: 'nowPlaying' }
  | { type: 'settings' }
  | { type: 'backlight' }
  | { type: 'wheel' }
  | { type: 'mouseButtons' }
  | { type: 'mouseButton'; button: 'side1' | 'side2' }
  | { type: 'about' }
  | { type: 'brick' }

interface NavEntry {
  view: View
  selected: number
}

interface WindowDrag {
  pointerId: number
  screenX: number
  screenY: number
  windowX: number
  windowY: number
}

interface IpodProps {
  tracks: Track[]
  playlists: Playlist[]
  artists: Artist[]
  settings: Settings
  player: Player
  playerState: PlayerState
  onSettingsChange: (patch: Partial<Settings>) => void
  onPlayTrack: (track: Track, context: Track[]) => void
  onTogglePlayback: () => void
  onPrevious: () => void
  onNext: () => void
  onVolumeChange: (volume: number) => void
  onImportMusic: () => void
  showImport?: boolean
}

interface MenuBuildContext {
  tracks: Track[]
  playlists: Playlist[]
  artists: Artist[]
  settings: Settings
  currentTrack: Track | null
  showImport: boolean
  push: (view: View) => void
  pop: () => void
  updateSettings: (patch: Partial<Settings>) => void
  playTrack: (track: Track, context: Track[]) => void
  importMusic: () => void
}

function mouseActionLabel(action: MouseAction): string {
  return MOUSE_ACTION_OPTIONS.find((option) => option.value === action)?.label ?? 'None'
}

function buildMenu(
  view: View,
  context: MenuBuildContext,
): { title: string; items: MenuItem[] } {
  const {
    tracks,
    playlists,
    artists,
    settings,
    currentTrack,
    showImport,
    push,
    pop,
    updateSettings,
    playTrack,
    importMusic,
  } = context

  switch (view.type) {
    case 'main': {
      if (tracks.length === 0) {
        return {
          title: 'iPod',
          items: [
            {
              id: 'no-music',
              label: 'No Music',
              centered: true,
              action: importMusic,
            },
            {
              id: 'settings',
              label: 'Settings',
              chevron: true,
              action: () => push({ type: 'settings' }),
            },
          ],
        }
      }

      return {
        title: 'iPod',
        items: [
          {
            id: 'playlists',
            label: 'Playlists',
            chevron: true,
            action: () => push({ type: 'playlists' }),
          },
          {
            id: 'artists',
            label: 'Artists',
            chevron: true,
            action: () => push({ type: 'artists' }),
          },
          {
            id: 'songs',
            label: 'Songs',
            chevron: true,
            action: () => push({ type: 'songs' }),
          },
          {
            id: 'settings',
            label: 'Settings',
            chevron: true,
            action: () => push({ type: 'settings' }),
          },
          ...(showImport
            ? [
                {
                  id: 'import',
                  label: 'Add Music…',
                  action: importMusic,
                },
              ]
            : []),
          ...(currentTrack
            ? [
                {
                  id: 'now-playing',
                  label: 'Now Playing',
                  chevron: true,
                  action: () => push({ type: 'nowPlaying' }),
                },
              ]
            : []),
        ],
      }
    }

    case 'playlists':
      return {
        title: 'Playlists',
        items: playlists.map((playlist) => ({
          id: playlist.id,
          label: playlist.name,
          value: String(playlist.tracks.length),
          chevron: true,
          action: () => push({ type: 'playlist', id: playlist.id }),
        })),
      }

    case 'playlist': {
      const playlist = playlists.find((entry) => entry.id === view.id)
      if (!playlist) {
        return { title: 'Playlists', items: [] }
      }

      return {
        title: playlist.name,
        items: [
          ...(playlist.tracks.length
            ? [
                {
                  id: 'play-all',
                  label: 'Play All',
                  chevron: true,
                  action: () => {
                    const first = playlist.tracks[0]
                    if (first) playTrack(first, playlist.tracks)
                    push({ type: 'nowPlaying' })
                  },
                },
              ]
            : []),
          ...playlist.tracks.map((track) => ({
            id: `track:${track.id}`,
            label: track.title,
            value: formatDuration(track.duration),
            action: () => {
              playTrack(track, playlist.tracks)
              push({ type: 'nowPlaying' })
            },
          })),
        ],
      }
    }

    case 'artists':
      return {
        title: 'Artists',
        items: [
          {
            id: 'all-songs',
            label: 'All Songs',
            chevron: true,
            action: () => push({ type: 'songs' }),
          },
          ...artists.map((artist) => ({
            id: `artist:${artist.name}`,
            label: artist.name,
            value: String(artist.tracks.length),
            chevron: true,
            action: () => push({ type: 'artist', name: artist.name }),
          })),
        ],
      }

    case 'artist': {
      const artist = artists.find((entry) => entry.name === view.name)
      if (!artist) {
        return { title: 'Artists', items: [] }
      }

      return {
        title: artist.name,
        items: [
          {
            id: 'play-all',
            label: 'Play All',
            chevron: true,
            action: () => {
              const first = artist.tracks[0]
              if (first) playTrack(first, artist.tracks)
              push({ type: 'nowPlaying' })
            },
          },
          ...artist.tracks.map((track) => ({
            id: `track:${track.id}`,
            label: track.title,
            value: formatDuration(track.duration),
            action: () => {
              playTrack(track, artist.tracks)
              push({ type: 'nowPlaying' })
            },
          })),
        ],
      }
    }

    case 'songs':
      return {
        title: 'Songs',
        items: tracks.map((track) => ({
          id: `track:${track.id}`,
          label: track.title,
          value: formatDuration(track.duration),
          action: () => {
            playTrack(track, tracks)
            push({ type: 'nowPlaying' })
          },
        })),
      }

    case 'nowPlaying':
      return { title: 'Now Playing', items: [] }

    case 'settings': {
      const repeatIndex = REPEAT_OPTIONS.findIndex((option) => option.value === settings.repeat)
      const nextRepeat: RepeatMode =
        REPEAT_OPTIONS[(repeatIndex + 1) % REPEAT_OPTIONS.length]?.value ?? 'off'
      const backlightLabel =
        BACKLIGHT_OPTIONS.find((option) => option.value === settings.backlight)?.label ?? 'Always On'
      const clickerLabel =
        CLICKER_OPTIONS.find((option) => option.value === settings.clicker)?.label ?? 'On'

      return {
        title: 'Settings',
        items: [
          {
            id: 'shuffle',
            label: 'Shuffle',
            value: settings.shuffle ? 'Songs' : 'Off',
            action: () => updateSettings({ shuffle: !settings.shuffle }),
          },
          {
            id: 'repeat',
            label: 'Repeat',
            value: REPEAT_OPTIONS.find((option) => option.value === settings.repeat)?.label ?? 'Off',
            action: () => updateSettings({ repeat: nextRepeat }),
          },
          {
            id: 'backlight',
            label: 'Backlight',
            value: backlightLabel,
            chevron: true,
            action: () => push({ type: 'backlight' }),
          },
          {
            id: 'clicker',
            label: 'Clicker',
            value: clickerLabel,
            action: () =>
              updateSettings({ clicker: settings.clicker === 'on' ? 'off' : 'on' }),
          },
          {
            id: 'wheel',
            label: 'Scroll Wheel',
            value: `${Math.round(settings.wheelStep)} px`,
            chevron: true,
            action: () => push({ type: 'wheel' }),
          },
          {
            id: 'mouse',
            label: 'Mouse Buttons',
            chevron: true,
            action: () => push({ type: 'mouseButtons' }),
          },
          {
            id: 'about',
            label: 'About',
            chevron: true,
            action: () => push({ type: 'about' }),
          },
        ],
      }
    }

    case 'backlight':
      return {
        title: 'Backlight',
        items: BACKLIGHT_OPTIONS.map((option) => ({
          id: option.value,
          label: option.label,
          value: settings.backlight === option.value ? '✓' : undefined,
          action: () => {
            updateSettings({ backlight: option.value })
            pop()
          },
        })),
      }

    case 'wheel':
      return { title: 'Scroll Wheel', items: [] }

    case 'mouseButtons':
      return {
        title: 'Mouse Buttons',
        items: [
          {
            id: 'side1',
            label: 'Side Button 1',
            value: mouseActionLabel(settings.mouseSide1),
            chevron: true,
            action: () => push({ type: 'mouseButton', button: 'side1' }),
          },
          {
            id: 'side2',
            label: 'Side Button 2',
            value: mouseActionLabel(settings.mouseSide2),
            chevron: true,
            action: () => push({ type: 'mouseButton', button: 'side2' }),
          },
        ],
      }

    case 'mouseButton': {
      const current =
        view.button === 'side1' ? settings.mouseSide1 : settings.mouseSide2

      return {
        title: view.button === 'side1' ? 'Side Button 1' : 'Side Button 2',
        items: MOUSE_ACTION_OPTIONS.map((option) => ({
          id: option.value,
          label: option.label,
          value: current === option.value ? '✓' : undefined,
          action: () => {
            if (view.button === 'side1') {
              updateSettings({ mouseSide1: option.value })
            } else {
              updateSettings({ mouseSide2: option.value })
            }
            pop()
          },
        })),
      }
    }

    case 'about':
      return {
        title: 'About',
        items: [
          { id: 'model', label: 'iPod', value: 'Local', centered: true, disabled: true },
          { id: 'songs', label: 'Songs', value: String(tracks.length), disabled: true },
          { id: 'artists', label: 'Artists', value: String(artists.length), disabled: true },
          { id: 'playlists', label: 'Playlists', value: String(playlists.length), disabled: true },
          {
            id: 'duration',
            label: 'Music',
            value: formatLongDuration(totalDuration(tracks)),
            disabled: true,
          },
          {
            id: 'storage',
            label: 'Library',
            value: formatBytes(totalSize(tracks)),
            disabled: true,
          },
          { id: 'version', label: 'Version', value: '1.0', disabled: true },
        ],
      }

    case 'brick':
      return { title: 'Brick', items: [] }

    default:
      return { title: 'iPod', items: [] }
  }
}

function ScreenTitlebar({ title, isPlaying }: { title: string; isPlaying: boolean }) {
  return (
    <div className="screen-titlebar">
      <span className={`titlebar-play${isPlaying ? ' visible' : ''}`} aria-hidden="true">
        {isPlaying ? <PlayIcon /> : null}
      </span>
      <span className="screen-title">{title}</span>
      <span className="battery-indicator" aria-hidden="true" />
    </div>
  )
}

export function Ipod({
  tracks,
  playlists,
  artists,
  settings,
  player,
  playerState,
  onSettingsChange,
  onPlayTrack,
  onTogglePlayback,
  onPrevious,
  onNext,
  onVolumeChange,
  onImportMusic,
  showImport = false,
}: IpodProps) {
  const [stack, setStack] = useState<NavEntry[]>([{ view: { type: 'main' }, selected: 0 }])
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [volumeMode, setVolumeMode] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const volumeModeTimer = useRef<number | null>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const brickRef = useRef<BrickGameHandle>(null)
  const windowDragRef = useRef<WindowDrag | null>(null)

  const currentEntry = stack[stack.length - 1] ?? { view: { type: 'main' } as View, selected: 0 }
  const currentView = currentEntry.view
  const currentTrack = playerState.queue[playerState.index] ?? null

  const wake = useCallback(() => setLastActivityAt(Date.now()), [])
  const focusDevice = useCallback(() => {
    deviceRef.current?.focus({ preventScroll: true })
  }, [])

  const handleDevicePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      focusDevice()
      wake()

      const api = window.ipodDesktop
      if (!api || (event.pointerType === 'mouse' && event.button !== 0)) return

      const target = event.target as HTMLElement
      if (target.closest('.screen-bezel, .wheel-area, button, input, textarea')) return

      event.preventDefault()
      windowDragRef.current = {
        pointerId: event.pointerId,
        screenX: event.screenX,
        screenY: event.screenY,
        windowX: window.screenX,
        windowY: window.screenY,
      }
    },
    [focusDevice, wake],
  )

  const handleScreenDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (currentView.type === 'brick' || currentView.type === 'wheel') return

      const target = event.target as HTMLElement
      if (target.closest('.menu-row, button, input, textarea, select')) return

      focusDevice()
      wake()
      const next = !isMinimized
      setIsMinimized(next)
      window.ipodDesktop?.setMinimizedMode(next)
    },
    [currentView.type, focusDevice, isMinimized, wake],
  )

  const backlightOption = BACKLIGHT_OPTIONS.find(
    (entry) => entry.value === settings.backlight,
  )
  const dimmed =
    settings.backlight === 'off' ||
    (currentView.type !== 'brick' &&
      backlightOption?.timeout != null &&
      backlightOption.timeout > 0 &&
      now - lastActivityAt >= backlightOption.timeout)

  useEffect(() => {
    if (!backlightOption?.timeout) return

    const delay = Math.max(0, lastActivityAt + backlightOption.timeout - Date.now())
    const timeout = window.setTimeout(() => setNow(Date.now()), delay)
    return () => window.clearTimeout(timeout)
  }, [backlightOption?.timeout, lastActivityAt])

  useEffect(
    () => () => {
      if (volumeModeTimer.current !== null) {
        window.clearTimeout(volumeModeTimer.current)
      }
    },
    [],
  )

  useEffect(() => {
    const finish = () => {
      windowDragRef.current = null
    }

    const handleMove = (event: PointerEvent) => {
      const drag = windowDragRef.current
      const api = window.ipodDesktop
      if (!drag || !api) return
      if (event.buttons === 0) {
        finish()
        return
      }
      api.moveWindow({
        x: drag.windowX + event.screenX - drag.screenX,
        y: drag.windowY + event.screenY - drag.screenY,
      })
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

  const push = useCallback((view: View) => {
    setStack((previous) => [...previous, { view, selected: 0 }])
  }, [])

  const pop = useCallback(() => {
    setStack((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous))
  }, [])

  const openBrick = useCallback(() => {
    if (currentView.type !== 'about') return
    player.click()
    wake()
    setVolumeMode(false)
    push({ type: 'brick' })
  }, [currentView.type, player, push, wake])

  const menu = useMemo(
    () =>
      buildMenu(currentView, {
        tracks,
        playlists,
        artists,
        settings,
        currentTrack,
        showImport,
        push,
        pop,
        updateSettings: onSettingsChange,
        playTrack: onPlayTrack,
        importMusic: onImportMusic,
      }),
    [
      currentView,
      tracks,
      playlists,
      artists,
      settings,
      currentTrack,
      showImport,
      push,
      pop,
      onSettingsChange,
      onPlayTrack,
      onImportMusic,
    ],
  )

  const selectedIndex = clampIndex(currentEntry.selected, menu.items.length)
  const selectedItem = menu.items[selectedIndex]

  const move = useCallback(
    (direction: number) => {
      if (menu.items.length === 0) return

      setStack((previous) => {
        const top = previous[previous.length - 1]
        if (!top) return previous

        return [
          ...previous.slice(0, -1),
          { ...top, selected: stepIndex(top.selected, direction, menu.items.length) },
        ]
      })
    },
    [menu.items.length],
  )

  const activateIndex = useCallback(
    (index: number) => {
      const item = menu.items[index]

      setStack((previous) => {
        const top = previous[previous.length - 1]
        if (!top) return previous
        return [...previous.slice(0, -1), { ...top, selected: index }]
      })

      if (!item || item.disabled || !item.action) return
      player.click()
      item.action()
      wake()
    },
    [menu.items, player, wake],
  )

  const activateSelected = useCallback(() => {
    activateIndex(selectedIndex)
  }, [activateIndex, selectedIndex])

  const startVolumeMode = useCallback(() => {
    setVolumeMode(true)

    if (volumeModeTimer.current !== null) {
      window.clearTimeout(volumeModeTimer.current)
    }

    volumeModeTimer.current = window.setTimeout(() => {
      volumeModeTimer.current = null
      setVolumeMode(false)
      if (document.activeElement instanceof HTMLInputElement) {
        deviceRef.current?.focus({ preventScroll: true })
      }
    }, 1400)
  }, [])

  const adjustVolume = useCallback(
    (direction: number) => {
      const current = player.getSnapshot().volume
      const next = Math.min(1, Math.max(0, current + direction * 0.05))
      player.setVolume(next)
      onVolumeChange(next)
      startVolumeMode()
    },
    [onVolumeChange, player, startVolumeMode],
  )

  const calibrateWheel = useCallback(
    (step: number) => {
      onSettingsChange({ wheelStep: step })
    },
    [onSettingsChange],
  )

  const setVolumeFromSlider = useCallback(
    (volume: number) => {
      const next = Math.min(1, Math.max(0, volume))
      player.setVolume(next)
      onVolumeChange(next)
      startVolumeMode()
    },
    [onVolumeChange, player, startVolumeMode],
  )

  useEffect(() => {
    const handleShowSettings = () => {
      setStack((previous) => {
        const top = previous[previous.length - 1]
        if (top?.view.type === 'settings') return previous
        return [...previous, { view: { type: 'settings' }, selected: 0 }]
      })
    }

    const handleVolume = (event: Event) => {
      const direction = (event as CustomEvent<number>).detail
      if (direction === 1 || direction === -1) adjustVolume(direction)
    }

    window.addEventListener('ipod:show-settings', handleShowSettings)
    window.addEventListener('ipod:volume', handleVolume)

    return () => {
      window.removeEventListener('ipod:show-settings', handleShowSettings)
      window.removeEventListener('ipod:volume', handleVolume)
    }
  }, [adjustVolume])

  const handleStep = useCallback(
    (direction: number) => {
      wake()

      if (currentView.type === 'wheel') {
        return
      }

      player.click()

      if (currentView.type === 'brick') {
        brickRef.current?.steer(direction)
        return
      }

      if (currentView.type === 'nowPlaying') {
        adjustVolume(direction)
        return
      }

      move(direction)
    },
    [adjustVolume, currentView.type, move, player, wake],
  )

  const handleMenu = useCallback(() => {
    player.click()
    wake()
    setVolumeMode(false)
    pop()
    focusDevice()
  }, [focusDevice, player, pop, wake])

  const handleSelect = useCallback(() => {
    focusDevice()

    if (currentView.type === 'wheel') {
      player.click()
      wake()
      pop()
      return
    }

    if (currentView.type === 'brick') {
      player.click()
      wake()
      brickRef.current?.launch()
      return
    }

    activateSelected()
  }, [activateSelected, currentView.type, focusDevice, player, pop, wake])

  const handleScreenMiddleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button === 1) event.preventDefault()
    },
    [],
  )

  const handleScreenMiddleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 1) return
      event.preventDefault()
      event.stopPropagation()
      handleSelect()
    },
    [handleSelect],
  )

  const handlePrevious = useCallback(() => {
    player.click()
    wake()
    onPrevious()
    focusDevice()
  }, [focusDevice, onPrevious, player, wake])

  const handleNext = useCallback(() => {
    player.click()
    wake()
    onNext()
    focusDevice()
  }, [focusDevice, onNext, player, wake])

  const handlePlayPause = useCallback(() => {
    player.click()
    wake()
    onTogglePlayback()
    focusDevice()
  }, [focusDevice, onTogglePlayback, player, wake])

  useEffect(() => {
    const isSideButton = (button: number) => button === 3 || button === 4

    const suppress = (event: MouseEvent) => {
      if (!isSideButton(event.button)) return
      event.preventDefault()
      event.stopPropagation()
    }

    const handleSideButton = (event: MouseEvent) => {
      if (!isSideButton(event.button)) return
      suppress(event)

      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, .desktop-sheet')) return

      const action =
        event.button === 3 ? settings.mouseSide1 : settings.mouseSide2

      switch (action) {
        case 'back':
          handleMenu()
          break
        case 'next':
          handleNext()
          break
        case 'previous':
          handlePrevious()
          break
        case 'playPause':
          handlePlayPause()
          break
        case 'none':
          break
      }
    }

    window.addEventListener('mousedown', suppress, true)
    window.addEventListener('auxclick', suppress, true)
    window.addEventListener('mouseup', handleSideButton, true)

    return () => {
      window.removeEventListener('mousedown', suppress, true)
      window.removeEventListener('auxclick', suppress, true)
      window.removeEventListener('mouseup', handleSideButton, true)
    }
  }, [
    handleMenu,
    handleNext,
    handlePlayPause,
    handlePrevious,
    settings.mouseSide1,
    settings.mouseSide2,
  ])

  const handleKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (event.key === 'Escape') {
          event.preventDefault()
          handleMenu()
        }
        return
      }

      if (target.closest('button') && (event.key === 'Enter' || event.key === ' ')) {
        return
      }

      if (currentView.type === 'brick') {
        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowRight':
            event.preventDefault()
            player.click()
            wake()
            brickRef.current?.steer(event.key === 'ArrowRight' ? 1 : -1)
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            player.click()
            wake()
            brickRef.current?.launch()
            break
          case 'Escape':
          case 'Backspace':
            event.preventDefault()
            handleMenu()
            break
          case 'ArrowUp':
          case 'ArrowDown':
            event.preventDefault()
            break
          default:
            break
        }
        return
      }

      const nowPlaying = currentView.type === 'nowPlaying'

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          if (nowPlaying) adjustVolume(1)
          else {
            player.click()
            wake()
            move(-1)
          }
          break
        case 'ArrowDown':
          event.preventDefault()
          if (nowPlaying) adjustVolume(-1)
          else {
            player.click()
            wake()
            move(1)
          }
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (nowPlaying) {
            player.click()
            wake()
            setVolumeMode(false)
            player.skip(-5)
          } else {
            handlePrevious()
          }
          break
        case 'ArrowRight':
          event.preventDefault()
          if (nowPlaying) {
            player.click()
            wake()
            setVolumeMode(false)
            player.skip(5)
          } else {
            handleNext()
          }
          break
        case 'Enter':
          event.preventDefault()
          if (nowPlaying) handlePlayPause()
          else handleSelect()
          break
        case ' ':
          event.preventDefault()
          handlePlayPause()
          break
        case 'Escape':
        case 'Backspace':
          event.preventDefault()
          handleMenu()
          break
        default:
          break
      }
    },
    [
      currentView.type,
      handleMenu,
      handleNext,
      handlePlayPause,
      handlePrevious,
      handleSelect,
      adjustVolume,
      move,
      player,
      wake,
    ],
  )

  return (
    <div
      ref={deviceRef}
      className={`ipod${isMinimized ? ' is-minimized' : ''}`}
      tabIndex={0}
      role="group"
      aria-label="iPod. Use the click wheel or arrow keys to navigate."
      onKeyDown={handleKeyboard}
      onPointerDown={handleDevicePointerDown}
    >
      <div
        className="screen-bezel"
        onDoubleClick={handleScreenDoubleClick}
        onMouseDown={handleScreenMiddleMouseDown}
        onAuxClick={handleScreenMiddleClick}
      >
        <div className={`screen${dimmed ? ' is-dimmed' : ' is-backlit'}`}>
          <div className="screen-content">
            {currentView.type === 'brick' ? (
              <BrickGame ref={brickRef} />
            ) : (
              <>
                <ScreenTitlebar title={menu.title} isPlaying={playerState.isPlaying} />
                {currentView.type === 'nowPlaying' ? (
                  <NowPlaying
                    track={currentTrack}
                    index={playerState.index}
                    queueLength={playerState.queue.length}
                    isPlaying={playerState.isPlaying}
                    isLoading={playerState.isLoading}
                    currentTime={playerState.currentTime}
                    duration={playerState.duration}
                    shuffle={settings.shuffle}
                    repeat={settings.repeat}
                    volume={playerState.volume}
                    mode={volumeMode ? 'volume' : 'progress'}
                    onVolumeChange={setVolumeFromSlider}
                    error={playerState.error}
                  />
                ) : currentView.type === 'wheel' ? (
                  <WheelCalibration
                    currentStep={settings.wheelStep}
                    onCalibrate={calibrateWheel}
                    onActivity={wake}
                  />
                ) : (
                  <MenuList
                    items={menu.items}
                    selected={selectedIndex}
                    onActivate={activateIndex}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ClickWheel
        isPlaying={playerState.isPlaying}
        wheelThreshold={settings.wheelStep}
        isHidden={isMinimized}
        onStep={handleStep}
        onSelect={handleSelect}
        onSelectHold={currentView.type === 'about' ? openBrick : undefined}
        selectHoldMs={5000}
        onMenu={handleMenu}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onPlayPause={handlePlayPause}
        onActivity={wake}
      />

      <div className="sr-only" aria-live="polite">
        {currentView.type === 'brick'
          ? 'Brick game'
          : currentView.type === 'wheel'
            ? 'Scroll wheel calibration'
            : `${menu.title}: ${selectedItem?.label ?? 'Empty'}`}
      </div>
    </div>
  )
}
