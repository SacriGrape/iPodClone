const { execFileSync } = require('node:child_process')
const path = require('node:path')

// electron-builder skips signing when mac.identity is null. Apple Silicon still
// needs at least an ad-hoc signature for the packaged bundle to launch, and the
// universal lipo step invalidates Electron's prebuilt signatures anyway.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  // A universal build packs x64 and arm64 into `*-temp` directories, then
  // merges them. Signing those inputs would make @electron/universal reject
  // the differing CodeResources files before it can create the fat binary.
  if (context.appOutDir.endsWith('-temp')) return

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  )

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  })
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit',
  })
}
