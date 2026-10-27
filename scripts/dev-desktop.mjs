import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const url = 'http://127.0.0.1:5173'
const viteBin = fileURLToPath(new URL('../node_modules/.bin/vite', import.meta.url))

const vite = spawn(viteBin, ['--host', '127.0.0.1', '--strictPort'], {
  stdio: 'inherit',
  env: process.env,
})

let electron = null
let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  if (electron && !electron.killed) electron.kill('SIGTERM')
  if (!vite.killed) vite.kill('SIGTERM')
  process.exit(code)
}

async function waitForVite() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Vite did not start at ${url}`)
}

vite.on('exit', (code) => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1)
})

try {
  await waitForVite()

  const args = ['.']
  if (process.env.ELECTRON_DEBUG_PORT) {
    args.push(`--remote-debugging-port=${process.env.ELECTRON_DEBUG_PORT}`)
  }

  electron = spawn(electronPath, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url,
      ELECTRON_ENABLE_LOGGING: '1',
    },
  })

  electron.on('exit', (code) => shutdown(code ?? 0))
} catch (error) {
  console.error(error)
  shutdown(1)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0))
}
