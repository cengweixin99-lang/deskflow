const { contextBridge, ipcRenderer } = require('electron')

// 在页面的全局对象上挂一个名为 desktop 的对象。之后渲染进程里就能直接用，window.desktop.xxx()
contextBridge.exposeInMainWorld('desktop', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  showNotification: (payload) => ipcRenderer.send('notification:show', payload),
  fetchText: (url) => ipcRenderer.invoke('feed:fetch-text', url),
  openBrowser: (url) => ipcRenderer.invoke('browser:open', url),
  setBrowserBounds: (bounds) => ipcRenderer.send('browser:set-bounds', bounds),
  setBrowserResizing: (resizing) => ipcRenderer.send('browser:set-resizing', resizing),
  closeBrowser: () => ipcRenderer.send('browser:close'),
  browserBack: () => ipcRenderer.send('browser:back'),
  browserForward: () => ipcRenderer.send('browser:forward'),
  browserReload: () => ipcRenderer.send('browser:reload'),
  onBrowserNavigate: (handler) => {
    const listener = (_event, url) => handler(url)
    ipcRenderer.on('browser:navigate', listener)
    return () => ipcRenderer.removeListener('browser:navigate', listener)
  },
})
