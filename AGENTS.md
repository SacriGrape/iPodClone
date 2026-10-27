# AGENTS.md

## Project

A local-first iPod clone inspired by the white click-wheel iPod on Apple Music's 404 page. It runs as a browser app and as a frameless Electron app for macOS and Linux. Users import their own audio; browser audio is stored in IndexedDB, while desktop audio streams from disk through a local custom protocol. No server, no uploads, no Apple Music API or DRM.

Reference: https://music.apple.com/us/jfdsalkfavsd (the URL is intentionally invalid; it is the 404 page that mounts Apple's iPod).

## Commands

Package manager: npm (`package-lock.json`).

- `npm install`
- `npm run dev` — Vite at http://localhost:5173
- `npm run typecheck` — `tsc -b`
- `npm run lint` — oxlint
- `npm test` — Vitest, node environment
- `npx vitest run src/lib/queue.test.ts` — run one test file
- `npm run test:watch`
- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — serve the production build
- `npm run desktop:dev` — Vite + Electron development window with native menus
- `npm run desktop:build` — build the unsigned `.app` at `release/mac-arm64/iPod.app`
- `npm run desktop:package:mac` — build `release/iPod-<version>-mac-universal.dmg`
- `npm run desktop:package:linux` — build the AppImage and `.deb` (run on Linux for a native build)
- `npm run desktop:open` — open the built app
- `npm run desktop:install` — build and copy the app to `~/Applications/iPod.app`

Run typecheck, lint, tests, and `npm run build` when changing bundling, dependencies, or the Electron shell. Rebuild the `.app` after changing `electron/` or the renderer.

## Architecture

- `src/App.tsx` wires the library, settings, player, drag-and-drop, and hidden file input.
- `src/components/Ipod.tsx` owns the view stack (`NavEntry[]`), menu construction, keyboard controls, and backlight. The menu is a state machine, not routes. Keep menu items in `buildMenu`.
- `src/components/ClickWheel.tsx` maps pointer angle to 15° steps on the inner textured scroll disc; four clipped outer-ring buttons handle menu/previous/next/play. `MenuList.tsx` shows six rows; `NowPlaying.tsx` is text-only (no album art). Holding the center button for 5 seconds on About opens the hidden Brick game.
- `src/components/BrickGame.tsx` renders the monochrome Brick canvas and owns the game loop. Pure paddle/ball/brick physics and level progression live in `src/lib/brick.ts`, covered by `brick.test.ts`. Brick uses wheel rotation or ←/→ to steer, center/Enter/Space to launch, and menu/Escape to exit.
- `src/components/WindowResizeHandles.tsx` overlays invisible handles at the four visible iPod body corners. They send `resizeWindow` through the preload bridge; `electron/main.js` clamps the size and locks 439:716. Native window-edge resizing also works, but the body-corner handles keep corner drags from moving the window.
- Match the reference hardware proportions: 415×692 body, 289×239 screen (including the 8px bezel), 350px wheel, 276px inner scroll disc, and 100px center button. The wheel is not a flat disc: the four outer-ring buttons are clipped triangles separated by diagonal dividers, and the inner disc has a noise texture. Keep the curved lowercase `menu` SVG text on the top arc and muted gray icons.
- Wheel icon artwork follows the reference: play/pause is one fixed combined 24×12 glyph (not swapped between play and pause), back/forward are 23×12, with 9.5px top, 6px side, and 12px bottom button padding.
- The scroll ring accepts the physical mouse wheel/trackpad with a non-passive native listener and accumulates deltas into the same step callback as drag rotation; it must prevent the page from scrolling. It works in menus, Now Playing, and Brick. In compact mode the same listener is attached to `.screen-bezel`, so hovering the screen steps the iPod while the wheel itself is hidden. Middle-clicking on the wheel area or anywhere on the screen maps to center Select and suppresses middle-click autoscroll. Settings → Scroll Wheel opens a one-shot calibration screen: one wheel notch is measured after a short idle, clamped to 1–240px, saved as `settings.wheelStep`, and used directly as the step threshold; default 36px. Calibration suppresses menu navigation while the screen is open.
- Side mouse buttons 3 and 4 are captured on `mouseup` and mapped through Settings → Mouse Buttons. Defaults are Side Button 1 = Back and Side Button 2 = Next Track; options are Back, Next Track, Previous Track, Play/Pause, and None. Mappings persist in `settings.mouseSide1`/`mouseSide2`; side-button mousedown/auxclick defaults are suppressed so browser history navigation does not fire.
- Double-clicking blank screen/bezel space toggles minimized mode. The shell becomes a screen-only panel with an 18px white border, the wheel is hidden outright and made `inert`, and Electron derives the compact window size and position from the current screen rectangle. The screen keeps the same global top-left and size while the white body/wheel space shrinks or grows around it; double-clicking again restores the wheel and full shell. Do not animate the wheel scale/fade across the compact transition — it overlaps the screen; hide the wheel immediately instead. Ignore menu rows, buttons, inputs, Brick, and calibration so those interactions are not hijacked. Keyboard controls remain available while minimized.
- The compact window is resizable from its corners with a compact 344:294 aspect and 236px minimum. `WindowResizeHandles` picks that ratio from the `is-minimized` class, and `electron/main.js` applies the matching aspect/minimum in `desktop:resize-window`. `screenMetrics()` mirrors the CSS geometry (2.7335% app padding, 1px body border, normal/compact screen width ratios 69.98%/88.923%, top ratios 7.23%/5.538%) so the screen stays anchored; keep those constants in sync with `index.css`. The compact shell keeps the screen’s internal scale consistent with the full-size iPod by laying `.screen-content` out at 78.8% and scaling it 1.269× to fill the screen; this prevents the font/chrome from shrinking relative to the display.
- The screen uses the bundled ChicagoKare pixel font (`public/fonts/ChicagoKare-Regular.woff2`, MIT) at 26px, weight 400, with `font-synthesis: none` and antialiased smoothing. Keep its license file; do not substitute the font embedded in Apple's component. The battery and chevrons use the reference CSS geometry (smooth, not pixel-art SVGs). The screen is neutral gray-green when the backlight is off or timed out, and blue-white (`.is-backlit`) while the backlight is active. The backlight timer drives that state.
- `src/lib/player.ts` exposes the `getPlayer()` singleton. React reads it with `useSyncExternalStore`. It owns the `HTMLAudioElement`, Web Audio gain/fade, queue order, shuffle/repeat, and object-URL cache.
- `src/lib/metadata.ts` uses `music-metadata`'s browser `parseBlob` (`duration: true`, `skipCovers: true`). It falls back to `Artist - Title` filename parsing, an optional folder-import album name, the top-level folder name, and `<audio>` duration.
- `src/lib/db.ts` stores tracks and blobs in IndexedDB (`ipod-clone` / `tracks`). `src/hooks/useLibrary.ts` imports up to four files concurrently and persists added tracks. Folder import uses a `webkitdirectory` input; `trackKey` includes `webkitRelativePath` so same-named files in different folders do not collide.
- `src/lib/library.ts` derives Artists and Playlists (All Songs, Recently Added, one per album). `src/lib/settings.ts` persists settings at `localStorage["ipod-clone:settings"]`.
- Pure logic lives in `navigation.ts`, `queue.ts`, `library.ts`, `format.ts`, and `brick.ts`, covered by adjacent `*.test.ts` files.
- `electron/main.js` owns the frameless, resizable 439×716 transparent window locked to that aspect ratio on macOS (300px minimum width), native application menu (system menu bar on macOS; hidden in the frameless Linux window), `ipod://app` asset/media protocol, media allowlist, and file/folder dialogs. The Playback menu mirrors persisted Shuffle/Repeat state via `syncMenuState`; Shuffle is a checkbox and Repeat is an Off/One/All radio submenu so enabled states carry native checkmarks. View → Always on Top is persisted in `ui-state.json` under Electron’s userData and restored before the window is created. `electron/preload.cjs` exposes the typed `window.ipodDesktop` bridge declared in `src/desktop.d.ts`.
- Desktop window dragging is custom, not CSS app-region: pointer-down on the iPod body outside the screen/wheel sends `moveWindow` through the preload bridge; screen and wheel remain interactive. The 12px transparent margin is proportional (`2.7335%` of window width), so the 415×692 iPod scales inside the resizable window. Keep `setAspectRatio(439 / 716)` and the desktop CSS padding in sync when changing window dimensions.
- `electron/media.js` scans folders and parses tags/durations with Node `music-metadata`. Desktop tracks have `sourceUrl` (`ipod://app/media/...`) and no blob; browser tracks still have blobs. `Player.getUrl` prefers `sourceUrl`.
- Desktop mode is enabled by the preload bridge: `main.tsx` adds `html.desktop`, `App` adds `.is-desktop`, and CSS hides the web header/library/footer so only the iPod remains. Native menu actions arrive through `ipodDesktop.onMenuAction`; Settings and volume use the `ipod:show-settings` / `ipod:volume` DOM events.

## Gotchas

- Do not add a "load once" ref guard to `useLibrary`'s mount effect. React StrictMode cancels the first effect; the second pass must run or the panel stays on "Opening your library…".
- `getPlayer()` is a singleton. Do not create another audio element or `MediaElementAudioSourceNode` per render. The `AudioContext` is created on a user gesture; keep it that way for autoplay policy.
- Settings drive the player through effects (volume, shuffle, repeat, clicker, scroll-wheel calibration). Do not write player state back into settings or you will create a loop.
- Audio blobs live in IndexedDB. `URL.createObjectURL` URLs are session-only and cached inside `Player`; never persist object URLs. Desktop imports must stay as `sourceUrl` tracks and stream from disk; do not copy them into IndexedDB or the repo.
- The `ipod://` scheme must be registered as privileged before `app.whenReady()`. The handler checks every media path against the persisted allowlist (`~/Library/Application Support/iPod/media-allowlist.json`). Keep range/CORS headers when changing the media protocol.
- `ipod://app` and the browser dev server have different origins, so their IndexedDB libraries are separate. The media allowlist is shared through userData.
- Electron uses `sandbox: true` and `contextIsolation: true`; keep Node access in the main process and expose only the preload API. The `.app` is intentionally unsigned (`mac.identity: null`) but `scripts/after-pack.cjs` applies an ad-hoc signature so Apple Silicon can launch it; it is not notarized. macOS releases are universal dmgs. Linux releases are x64 AppImage + deb; the deb installs an AppArmor profile for Ubuntu 24.04+, while the AppImage may need `--no-sandbox` there. The app icon lives at `build/icon.icns` with the Linux 1024px PNG at `build/icon.png`.
- `.github/workflows/release.yml` builds and tests both platforms on a `v*` tag and attaches the installers to a draft GitHub release. `desktop:package:*` scripts are the same commands the workflow uses.
- Reject `.m4p` (DRM) and video files (including `video/webm`). Accept unprotected MP3/AAC/M4A/FLAC/WAV/OGG/Opus and similar. Covers are intentionally skipped during import.
- Do not assume embedded tags exist. The Burnout folder is untagged; folder import relies on filename parsing and the optional album override. Keep audio imported from `/Volumes/External/...` out of the repo.
- Keyboard controls require the iPod to have focus; clicking or tapping focuses it. Wheel buttons and drag must keep working on touch. Preserve six visible menu rows and 15° wheel steps.
- `NowPlaying` uses the real `audio.duration`, not stored metadata duration. Do not use catalog duration for the progress bar.
- In Now Playing, wheel rotation adjusts volume and slides the progress panel over to the in-screen volume slider; it must not seek. Keep volume inside the iPod, not in the library panel. Keyboard ↑/↓ adjust volume; ←/→ seek.
- Brick is intentionally hidden: enter Settings → About and hold the center button for 5 seconds. In Brick, wheel/←/→ steers, center/Enter/Space launches or restarts, and menu/Escape exits. Do not add a visible Brick menu item.
- Brick stays bright regardless of the backlight timer; otherwise the game would turn gray while the ball is in play. Backlight Off still shows the gray-green screen.
- The desktop window is resizable from its corners but locked to 439:716. Do not reintroduce a fixed `width: 415px` on `.app.is-desktop .ipod`; the desktop layout must remain proportional so the screen, wheel, and drag margin scale together. Keep the body-corner handles in sync with the proportional padding (`2.7335vw`) if the window chrome changes.
- Do not add `-webkit-app-region: drag` back to the desktop shell. Chromium's drag-region hit map can go stale after a programmatic resize, making the whole window draggable and blocking the screen/wheel; use `moveWindow` IPC instead. Resize handles must not use pointer capture for the same reason.
- The browser shell has a 320px minimum width, but the desktop shell must override it (`html.desktop`/`body`/`.app.is-desktop` use `min-width: 0` and `overflow: hidden`) so the 300px minimum window does not develop scrollbars.
- oxlint flags synchronous `setState` inside effects. The backlight derives dimming from `lastActivityAt`/`now` in `Ipod.tsx` instead of setting state directly; follow that pattern.

## Tests

- Vitest runs in node with no jsdom. Tests cover navigation, queue behavior, library grouping, formatting, filename parsing, audio-file filtering, and Brick physics/level progression.
- Add pure functions under `src/lib` and test them there. Check browser-only behavior (wheel, audio, IndexedDB) with Playwright against `npm run dev`.
- Electron behavior was verified manually: native menus, folder import from `/Volumes/External/YTDownloader`, disk playback through `ipod://app/media`, and the packaged cold start. No automated Electron test suite exists; test the media scanner with `electron/media.js` directly if changing it.

## Reference notes

- Apple's 404 page lazy-loads `<web-music-ipod>` from `https://music.apple.com/includes/ipod/web-music-ipod.esm.js`; it is Svelte + shadow DOM, not a static image. Its device chrome is CSS and its screen is text-only.
- It fetches `/includes/ipod/data/{storefront}/{language}.json` (`schemaVersion: 3`; defaults `us` / `en-US`) containing `songs[]`, `artists[]`, and `playlists[]`. Each song plays its `previewUrl` through `new Audio()`.
- The reference also implements Settings, About, backlight, clicker, and a Brick game. This clone implements all of those; it still defers Apple-style i18n.
- Do not commit or ship Apple's component, catalog, or fonts. Use the shape only as an interoperability reference. A private self-host path is possible by serving the element at `/includes/ipod/web-music-ipod.esm.js` and a schema-v3 JSON at `/includes/ipod/data/us/en-US.json`; keep those files in gitignored `reference/`.
