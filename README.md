# iPod

A local-first iPod clone inspired by the white click-wheel iPod on [Apple Music's 404 page](https://music.apple.com/us/jfdsalkfavsd).

It runs as a browser app or as a standalone macOS, Windows, or Linux app. Import your own audio, browse it through the click wheel, and play it back locally. Files are never uploaded.

## Download

Download the latest build from the [Releases page](https://github.com/SacriGrape/iPodClone/releases/latest).

### macOS

1. Download `iPod-<version>-mac-universal.dmg`.
2. Open the disk image and drag **iPod** into **Applications**.
3. Launch it from Applications.

The macOS build is universal (Apple Silicon and Intel) and is **not notarized** — no Apple Developer certificate is configured. It is ad-hoc signed so macOS can launch it, but Gatekeeper will ask the first time:

- macOS 15 and later: try to open the app, then go to **System Settings → Privacy & Security → Open Anyway**.
- Earlier macOS versions: right-click the app → **Open**.
- If macOS says the app is damaged: `xattr -dr com.apple.quarantine /Applications/iPod.app`.

If you would rather not bypass Gatekeeper, build it from source (below).

### Windows

1. Download `iPod-<version>-win-x64.exe`.
2. Run the installer. It installs for the current user and lets you choose the folder.
3. Launch **iPod** from the Start menu or desktop.

The Windows build is **not code-signed**, so Windows SmartScreen may show “Windows protected your PC” the first time. Click **More info → Run anyway**. The installer is x64; it also runs on Windows on ARM through x64 emulation.

Your library is kept when you uninstall the app.

### Linux

Download either format from the same release:

- **AppImage (x86_64)** — works on most distributions without installing:
  ```bash
  chmod +x iPod-<version>-linux-x86_64.AppImage
  ./iPod-<version>-linux-x86_64.AppImage
  ```
- **Debian/Ubuntu package** — `sudo apt install ./iPod-<version>-linux-amd64.deb`, then launch **iPod** from your app menu.

Ubuntu 24.04 and newer restrict unprivileged user namespaces. The `.deb` installs an AppArmor profile automatically, so use it if you can. If an AppImage refuses to start with a `chrome-sandbox` error, launch it with `--no-sandbox`:

```bash
./iPod-<version>-linux-x86_64.AppImage --no-sandbox
```

The transparent rounded window looks best with a compositing desktop (GNOME, KDE Plasma, and most modern environments enable this by default).

## Run it in the browser

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Run the desktop app

```bash
npm install
npm run desktop:dev
```

This launches a frameless, transparent window containing only the iPod. Use the native menu on macOS:

- **File → Add Music…** — choose audio files
- **File → Add Folder…** — choose a folder and optionally give untagged files an album name (for example `Burnout Paradise`)
- **Playback** — play/pause, previous/next, volume, shuffle, repeat
- **iPod → Settings…** — open the in-iPod settings

On Linux and Windows the native menu is hidden because the window is frameless. The same actions are available through keyboard shortcuts (`Ctrl+O` for music, `Ctrl+Shift+O` for a folder, `Ctrl+P` for play/pause), and **Add Music…** / **Add Folder…** are also available from the iPod's main menu. Dragging audio files onto the window works too.

**Deep folder search:** **Add Folder…** opens a sheet with **Deep search all subfolders** enabled. Select a parent folder of albums and every subfolder with audio becomes its own album playlist, so a whole artist folder or music drive can be added in one pass. It walks the whole tree, skips hidden and system folders, continues past unreadable directories, and reports folder/album/track progress. Leave the album name blank to keep each folder as a separate album; entering an override merges every untagged file into that one album and is cleared after the import.

The window is just the iPod. Drag the white body — anywhere outside the screen and wheel controls — to move it. Use the close button on hover, or ⌘W/⌘Q on macOS (Ctrl+W/Ctrl+Q on Linux and Windows).

Desktop imports stream from disk using an `ipod://` protocol. They are not copied into the repo or into IndexedDB; only the track list and file references are stored. Keep the external drive mounted to play those tracks.

Your library and settings live in `~/Library/Application Support/iPod` on macOS, `%APPDATA%\iPod` on Windows, and `~/.config/iPod` on Linux.

The browser version still uses IndexedDB blobs, so its library is separate from the desktop app.

## Build installers

Build on the platform you are packaging:

```bash
npm run desktop:package:mac    # release/iPod-<version>-mac-universal.dmg
npm run desktop:package:win    # release/iPod-<version>-win-x64.exe
npm run desktop:package:linux  # release/*.AppImage and release/*.deb
```

The macOS build is ad-hoc signed by `scripts/after-pack.cjs`; it is not notarized. To distribute a Gatekeeper-friendly build, configure an Apple Developer ID certificate and notarization in the release workflow.

To build and install an unpacked macOS app into your user Applications folder during development:

```bash
npm run desktop:build
npm run desktop:open
```

`npm run desktop:install` builds and copies it to `~/Applications/iPod.app`.

## Releases

The GitHub Actions workflow at `.github/workflows/release.yml` builds macOS, Windows, and Linux on every tag beginning with `v` and attaches the installers to a **draft** GitHub release. Review the draft, then publish it.

```bash
git tag v0.2.2
git push origin v0.2.2
```

Run the workflow manually from the Actions tab to produce downloadable build artifacts without creating a release.

## Add your music

- Click **Add music**, or drag audio files anywhere onto the page.
- In the desktop app, use the menu or the iPod's **Add Music…** row.
- To import a whole folder, type an optional album name and click **Load folder**. Untagged files use that album name (or the folder name), and names like `Artist - Title.opus` are parsed automatically.
- In the desktop app, **Add Folder… → Deep search all subfolders** scans nested folders recursively and adds the whole tree at once. Each subfolder with audio becomes its own album. Leave the album name blank to keep them separate, or set one override to merge every untagged file into a single album.
- The library is saved, so it survives reloads.
- Supported: MP3, M4A/AAC, FLAC, WAV, OGG/Opus, and anything else the browser can decode.
- Apple Music downloads (`.m4p`) are DRM-protected and cannot be played. Use unprotected files or your own rips.

## Controls

- Drag around the click wheel to scroll. Tap the center button to select.
- **MENU** goes back; the prev/next and play/pause buttons work as expected.
- Keyboard: click the iPod first, then use <kbd>↑</kbd>/<kbd>↓</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd>, and <kbd>Space</kbd>.
- In Now Playing, rotating the wheel adjusts volume and slides the progress area over to the in-screen volume slider. Use <kbd>←</kbd>/<kbd>→</kbd> to seek.

### Backlight color

Open **Settings → Backlight Color** to choose Ice, Warm, Mono, Aqua, Green, Amber, Rose, Violet, or Red. **Custom…** opens an RGB editor:

- Rotate the wheel to change the selected channel.
- Press the center button (or <kbd>Enter</kbd>) to switch between Red, Green, and Blue. Clicking a channel row also selects it.
- Use <kbd>↑</kbd>/<kbd>↓</kbd> for RGB values and <kbd>←</kbd>/<kbd>→</kbd> to switch channels.
- Press **MENU** (or <kbd>Esc</kbd>) when done.

The screen itself previews the color live. Backlight Off and timed dimming still use the neutral gray-green screen.

## What's inside

- React + TypeScript + Vite
- Electron for the desktop app, native menus, and file/folder dialogs
- HTMLAudioElement + Web Audio for playback, fades, and the clicker
- IndexedDB for browser audio; disk streaming for desktop imports
- `music-metadata` for tags, with filename/duration fallbacks
- Vitest for pure logic tests
- electron-builder + GitHub Actions for macOS, Windows, and Linux release builds

```bash
npm run typecheck
npm run lint
npm test
```

## Credits

- Screen font: [ChicagoKare](https://github.com/KingDuane/Chicago-Kare) by Duane King, MIT licensed. The license is included at `public/fonts/ChicagoKare-LICENSE.txt`.

## Notes

This is a tribute project, not affiliated with Apple. Apple's original component, catalog, and fonts are not included; the interface here is an original implementation.
