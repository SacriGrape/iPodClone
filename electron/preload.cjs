const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ipodDesktop', {
  isDesktop: true,
  pickAudioFiles: () => ipcRenderer.invoke('desktop:pick-audio-files'),
  pickAudioFolder: (options) => ipcRenderer.invoke('desktop:pick-audio-folder', options),
  resizeWindow: (bounds) => ipcRenderer.send('desktop:resize-window', bounds),
  moveWindow: (position) => ipcRenderer.send('desktop:move-window', position),
  setMinimizedMode: (minimized) =>
    ipcRenderer.send('desktop:set-minimized-mode', minimized),
  syncMenuState: (state) => ipcRenderer.send('desktop:sync-menu-state', state),
  closeWindow: () => ipcRenderer.invoke('desktop:close-window'),
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action)
    ipcRenderer.on('desktop:menu-action', listener)
    return () => ipcRenderer.removeListener('desktop:menu-action', listener)
  },
  onFolderProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('desktop:folder-progress', listener)
    return () => ipcRenderer.removeListener('desktop:folder-progress', listener)
  },
})
