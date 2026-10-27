import { app, BrowserWindow, Menu, dialog, ipcMain, protocol, screen, shell } from 'electron'
import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import {
  AUDIO_EXTENSIONS,
  importAudioFiles,
  importAudioFolder,
  mimeForPath,
  pathFromMediaToken,
} from './media.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distRoot = path.resolve(__dirname, '..', 'dist')
const preloadPath = path.join(__dirname, 'preload.cjs')
const devUrl = process.env.VITE_DEV_SERVER_URL
const isDev = Boolean(devUrl)

const allowedFiles = new Set()
const allowedRoots = new Set()

// setAspectRatio is supported on macOS and Windows; Linux keeps its ratio
// through the custom corner handles in the renderer.
const supportsAspectRatio = process.platform === 'darwin' || process.platform === 'win32'

let mainWindow = null
let alwaysOnTop = false
let allowlistPath = ''
let uiStatePath = ''
let minimizedMode = false
let menuState = { shuffle: false, repeat: 'off' }

app.setName('iPod')
if (process.platform === 'win32') app.setAppUserModelId('local.ipod.clone')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ipod',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const ASSET_MIME = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function isInside(root, target) {
  const relative = path.relative(root, target)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function isAllowedMedia(filePath) {
  if (allowedFiles.has(filePath)) return true
  for (const root of allowedRoots) {
    if (isInside(root, filePath)) return true
  }
  return false
}

async function loadAllowlist() {
  allowlistPath = path.join(app.getPath('userData'), 'media-allowlist.json')

  try {
    const data = JSON.parse(await fs.readFile(allowlistPath, 'utf8'))
    for (const filePath of data.files ?? []) {
      if (typeof filePath === 'string') allowedFiles.add(filePath)
    }
    for (const root of data.roots ?? []) {
      if (typeof root === 'string') allowedRoots.add(root)
    }
  } catch {
    // First launch or a removed allowlist.
  }
}

async function saveAllowlist() {
  try {
    await fs.mkdir(path.dirname(allowlistPath), { recursive: true })
    await fs.writeFile(
      allowlistPath,
      JSON.stringify({ files: [...allowedFiles], roots: [...allowedRoots] }, null, 2),
    )
  } catch {
    // A read-only user-data directory should not make imports fail.
  }
}

async function loadUiState() {
  uiStatePath = path.join(app.getPath('userData'), 'ui-state.json')
  try {
    const data = JSON.parse(await fs.readFile(uiStatePath, 'utf8'))
    alwaysOnTop = data.alwaysOnTop === true
  } catch {
    // First launch or a removed settings file.
  }
}

async function saveUiState() {
  try {
    await fs.mkdir(path.dirname(uiStatePath), { recursive: true })
    await fs.writeFile(uiStatePath, JSON.stringify({ alwaysOnTop }, null, 2))
  } catch {
    // A read-only user-data directory should not break the menu.
  }
}

const MEDIA_CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
}

async function readRange(filePath, request, stats) {
  const range = request.headers.get('range')
  if (!range) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match) return null

  let start = match[1] ? Number(match[1]) : undefined
  let end = match[2] ? Number(match[2]) : undefined

  if (start === undefined) {
    const suffix = end ?? 0
    start = Math.max(0, stats.size - suffix)
    end = stats.size - 1
  } else {
    end = Math.min(end ?? stats.size - 1, stats.size - 1)
  }

  if (start >= stats.size || start > end) {
    return new Response('', {
      status: 416,
      headers: { ...MEDIA_CORS_HEADERS, 'Content-Range': `bytes */${stats.size}` },
    })
  }

  const stream = createReadStream(filePath, { start, end })
  return new Response(Readable.toWeb(stream), {
    status: 206,
    headers: {
      ...MEDIA_CORS_HEADERS,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Content-Type': mimeForPath(filePath),
    },
  })
}

async function handleMedia(request) {
  const url = new URL(request.url)
  const token = url.pathname.slice('/media/'.length)
  let filePath

  try {
    filePath = pathFromMediaToken(token)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  let realPath
  let stats

  try {
    realPath = await fs.realpath(filePath)
    stats = await fs.stat(realPath)
  } catch {
    return new Response('Not found', { status: 404 })
  }

  if (!stats.isFile() || !isAllowedMedia(realPath)) {
    return new Response('Forbidden', { status: 403 })
  }

  const ranged = await readRange(realPath, request, stats)
  if (ranged) return ranged

  const stream = createReadStream(realPath)
  return new Response(Readable.toWeb(stream), {
    status: 200,
    headers: {
      ...MEDIA_CORS_HEADERS,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(stats.size),
      'Content-Type': mimeForPath(realPath),
    },
  })
}

async function handleAsset(request) {
  const url = new URL(request.url)
  let pathname = decodeURIComponent(url.pathname)
  if (!pathname || pathname === '/') pathname = '/index.html'

  const filePath = path.resolve(distRoot, `.${pathname}`)
  if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
    return new Response('Not found', { status: 404 })
  }

  try {
    const data = await fs.readFile(filePath)
    return new Response(data, {
      headers: {
        'Content-Type': ASSET_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

function registerProtocol() {
  protocol.handle('ipod', async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'app') return new Response('Not found', { status: 404 })
    if (url.pathname.startsWith('/media/')) return handleMedia(request)
    return handleAsset(request)
  })
}

function send(action) {
  const target = BrowserWindow.getFocusedWindow() ?? mainWindow
  target?.webContents.send('desktop:menu-action', action)
}

function folderProgressReporter(webContents) {
  let lastSentAt = 0

  return (progress) => {
    const now = Date.now()
    const isFinalReading =
      progress.phase === 'reading' && progress.parsed === progress.total
    if (now - lastSentAt < 150 && !isFinalReading) return

    lastSentAt = now
    if (!webContents.isDestroyed()) {
      webContents.send('desktop:folder-progress', progress)
    }
  }
}

async function showOpenDialog(options) {
  return mainWindow
    ? dialog.showOpenDialog(mainWindow, options)
    : dialog.showOpenDialog(options)
}

async function showMessageBox(options) {
  return mainWindow
    ? dialog.showMessageBox(mainWindow, options)
    : dialog.showMessageBox(options)
}

const WINDOW_ASPECT_RATIO = 439 / 716
const MIN_WINDOW_WIDTH = 300
const COMPACT_ASPECT_RATIO = 344 / 294
const COMPACT_MIN_WIDTH = 236
const COMPACT_MIN_HEIGHT = Math.round(COMPACT_MIN_WIDTH / COMPACT_ASPECT_RATIO)
const APP_PADDING_RATIO = 2.7335 / 100
const BODY_BORDER = 1
const NORMAL_SCREEN_WIDTH_RATIO = 0.6998
const NORMAL_SCREEN_TOP_RATIO = 0.0723
const COMPACT_SCREEN_WIDTH_RATIO = 0.88923
const COMPACT_SCREEN_TOP_RATIO = 0.05538

function screenMetrics(windowWidth, compact) {
  const contentWidth = windowWidth * (1 - APP_PADDING_RATIO * 2) - BODY_BORDER * 2
  const width = contentWidth * (compact ? COMPACT_SCREEN_WIDTH_RATIO : NORMAL_SCREEN_WIDTH_RATIO)
  return {
    width,
    x: windowWidth * APP_PADDING_RATIO + BODY_BORDER + (contentWidth - width) / 2,
    y:
      windowWidth * APP_PADDING_RATIO +
      BODY_BORDER +
      contentWidth * (compact ? COMPACT_SCREEN_TOP_RATIO : NORMAL_SCREEN_TOP_RATIO),
  }
}

function windowWidthForScreen(screenWidth, compact) {
  const ratio = compact ? COMPACT_SCREEN_WIDTH_RATIO : NORMAL_SCREEN_WIDTH_RATIO
  return (screenWidth / ratio + BODY_BORDER * 2) / (1 - APP_PADDING_RATIO * 2)
}

function setWindowMinimizedMode(minimized) {
  if (!mainWindow || minimized === minimizedMode) return

  const currentBounds = mainWindow.getBounds()

  if (minimized) {
    const normalScreen = screenMetrics(currentBounds.width, false)
    const screenLeft = currentBounds.x + normalScreen.x
    const screenTop = currentBounds.y + normalScreen.y
    const width = Math.max(
      COMPACT_MIN_WIDTH,
      Math.round(windowWidthForScreen(normalScreen.width, true)),
    )
    const height = Math.round(width / COMPACT_ASPECT_RATIO)
    const compactScreen = screenMetrics(width, true)
    const x = Math.round(screenLeft - compactScreen.x)
    const y = Math.round(screenTop - compactScreen.y)

    minimizedMode = true
    if (supportsAspectRatio) mainWindow.setAspectRatio(COMPACT_ASPECT_RATIO)
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(COMPACT_MIN_WIDTH, COMPACT_MIN_HEIGHT)
    mainWindow.setBounds({ x, y, width, height }, false)
    mainWindow.focus()
    return
  }

  const compactScreen = screenMetrics(currentBounds.width, true)
  const screenLeft = currentBounds.x + compactScreen.x
  const screenTop = currentBounds.y + compactScreen.y
  const width = Math.max(
    MIN_WINDOW_WIDTH,
    Math.round(windowWidthForScreen(compactScreen.width, false)),
  )
  const height = Math.round(width / WINDOW_ASPECT_RATIO)
  const normalScreen = screenMetrics(width, false)
  const x = Math.round(screenLeft - normalScreen.x)
  const y = Math.round(screenTop - normalScreen.y)

  minimizedMode = false
  mainWindow.setResizable(true)
  if (supportsAspectRatio) mainWindow.setAspectRatio(WINDOW_ASPECT_RATIO)
  mainWindow.setMinimumSize(
    MIN_WINDOW_WIDTH,
    Math.round(MIN_WINDOW_WIDTH / WINDOW_ASPECT_RATIO),
  )
  mainWindow.setBounds({ x, y, width, height }, false)
  mainWindow.focus()
}

function createWindow() {
  const window = new BrowserWindow({
    width: 439,
    height: 716,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: Math.round(MIN_WINDOW_WIDTH / WINDOW_ASPECT_RATIO),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    fullscreenable: false,
    title: 'iPod',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  mainWindow = window
  window.setAlwaysOnTop(alwaysOnTop)
  window.setMenuBarVisibility(false)
  if (supportsAspectRatio) window.setAspectRatio(WINDOW_ASPECT_RATIO)

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null
      minimizedMode = false
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith(devUrl)) return
    if (!isDev && url.startsWith('ipod://app/')) return
    event.preventDefault()
  })

  if (isDev) {
    window.loadURL(devUrl)
  } else {
    window.loadURL('ipod://app/index.html')
  }
}

function buildMenu() {
  const template = [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('show-settings'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Add Music…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('add-files'),
        },
        {
          label: 'Add Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('add-folder'),
        },
        { type: 'separator' },
        {
          label: 'Clear Library…',
          click: async () => {
            const result = await showMessageBox({
              type: 'warning',
              buttons: ['Cancel', 'Clear Library'],
              defaultId: 0,
              cancelId: 0,
              message: 'Clear all imported music?',
              detail: 'The audio files on disk will not be deleted.',
            })
            if (result.response === 1) send('clear-library')
          },
        },
        { type: 'separator' },
        { role: 'close' },
        ...(process.platform === 'darwin'
          ? []
          : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    {
      label: 'Playback',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'CmdOrCtrl+P',
          click: () => send('play-pause'),
        },
        {
          label: 'Next Track',
          accelerator: 'CmdOrCtrl+Right',
          click: () => send('next'),
        },
        {
          label: 'Previous Track',
          accelerator: 'CmdOrCtrl+Left',
          click: () => send('previous'),
        },
        { type: 'separator' },
        {
          label: 'Volume Up',
          accelerator: 'CmdOrCtrl+Up',
          click: () => send('volume-up'),
        },
        {
          label: 'Volume Down',
          accelerator: 'CmdOrCtrl+Down',
          click: () => send('volume-down'),
        },
        { type: 'separator' },
        {
          label: 'Shuffle Songs',
          type: 'checkbox',
          checked: menuState.shuffle,
          click: () => send('toggle-shuffle'),
        },
        {
          label: 'Repeat',
          submenu: [
            {
              label: 'Off',
              type: 'radio',
              checked: menuState.repeat === 'off',
              click: () => send('repeat-off'),
            },
            {
              label: 'One',
              type: 'radio',
              checked: menuState.repeat === 'one',
              click: () => send('repeat-one'),
            },
            {
              label: 'All',
              type: 'radio',
              checked: menuState.repeat === 'all',
              click: () => send('repeat-all'),
            },
          ],
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: alwaysOnTop,
          click: (item) => {
            alwaysOnTop = item.checked
            mainWindow?.setAlwaysOnTop(alwaysOnTop)
            void saveUiState()
          },
        },
        ...(isDev
          ? [
              { type: 'separator' },
              { role: 'reload' },
              { role: 'toggleDevTools' },
            ]
          : []),
      ],
    },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('desktop:pick-audio-files', async () => {
  const result = await showOpenDialog({
    title: 'Add Music',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: [...AUDIO_EXTENSIONS] }],
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const realPaths = []
  for (const filePath of result.filePaths) {
    try {
      const realPath = await fs.realpath(filePath)
      realPaths.push(realPath)
      allowedFiles.add(realPath)
    } catch {
      // Skip files that disappeared between the dialog and import.
    }
  }

  if (realPaths.length === 0) return null
  await saveAllowlist()
  return { tracks: await importAudioFiles(realPaths) }
})

ipcMain.handle('desktop:pick-audio-folder', async (event, options) => {
  const importOptions = options && typeof options === 'object' ? options : {}
  const albumName =
    typeof importOptions.albumName === 'string' ? importOptions.albumName : undefined
  const deepScan = importOptions.deepScan !== false
  const result = await showOpenDialog({
    title: 'Add Folder',
    properties: ['openDirectory', 'createDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) return null

  let root
  try {
    root = await fs.realpath(result.filePaths[0])
  } catch {
    return null
  }

  allowedRoots.add(root)
  await saveAllowlist()

  return importAudioFolder(root, {
    fallbackAlbum: albumName,
    deep: deepScan,
    onProgress: folderProgressReporter(event.sender),
  })
})

ipcMain.on('desktop:move-window', (_event, position) => {
  if (!mainWindow || !position) return
  const x = Number(position.x)
  const y = Number(position.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  mainWindow.setPosition(Math.round(x), Math.round(y), false)
})

ipcMain.on('desktop:set-minimized-mode', (_event, minimized) => {
  setWindowMinimizedMode(Boolean(minimized))
})

ipcMain.on('desktop:sync-menu-state', (_event, state) => {
  if (!state) return
  const shuffle = Boolean(state.shuffle)
  const repeat =
    state.repeat === 'one' || state.repeat === 'all' || state.repeat === 'off'
      ? state.repeat
      : 'off'
  if (shuffle === menuState.shuffle && repeat === menuState.repeat) return
  menuState = { shuffle, repeat }
  buildMenu()
})

ipcMain.on('desktop:resize-window', (_event, bounds) => {
  if (!mainWindow || !bounds) return

  const requestedWidth = Number(bounds.width)
  const requestedX = Number(bounds.x)
  const requestedY = Number(bounds.y)
  if (
    !Number.isFinite(requestedWidth) ||
    !Number.isFinite(requestedX) ||
    !Number.isFinite(requestedY)
  ) {
    return
  }

  const aspectRatio = minimizedMode ? COMPACT_ASPECT_RATIO : WINDOW_ASPECT_RATIO
  const minWidth = minimizedMode ? COMPACT_MIN_WIDTH : MIN_WINDOW_WIDTH
  const display = screen.getDisplayMatching({
    x: requestedX,
    y: requestedY,
    width: Math.max(1, requestedWidth),
    height: Math.max(1, Math.round(requestedWidth / aspectRatio)),
  })
  const maxWidth = Math.min(
    display.workAreaSize.width,
    Math.floor(display.workAreaSize.height * aspectRatio),
  )
  const width = Math.max(minWidth, Math.min(Math.round(requestedWidth), maxWidth))
  const height = Math.round(width / aspectRatio)
  mainWindow.setBounds(
    {
      x: Math.round(requestedX),
      y: Math.round(requestedY),
      width,
      height,
    },
    false,
  )
})

ipcMain.handle('desktop:close-window', () => {
  mainWindow?.close()
})

app.whenReady().then(async () => {
  app.setAboutPanelOptions({
    applicationName: 'iPod',
    applicationVersion: app.getVersion(),
    credits: 'A local-first iPod clone.',
  })

  await loadAllowlist()
  await loadUiState()
  registerProtocol()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
