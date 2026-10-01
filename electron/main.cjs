const { app, BrowserWindow, ipcMain, Menu, Notification } = require('electron')
const path = require('node:path')
const {
  closeBrowser,
  destroyBrowserView,
  goBack,
  goForward,
  openBrowser,
  reloadBrowser,
  setBrowserBounds,
  setBrowserResizing,
} = require('./browser-view.cjs')
const { fetchText } = require('./network.cjs')
const { isStatePayload, readStateFile, writeStateFile } = require('./state-store.cjs')

const isDev = !app.isPackaged
const CURRENT_SCHEMA_VERSION = 3

const modalWindows = new WeakSet()
let quitting = false

function setWindowModalActive(win, active) {
  if (!win || win.isDestroyed()) return
  if (active) modalWindows.add(win)
  else modalWindows.delete(win)
}

function sendWindowMaximizedState(win) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
  win.webContents.send('window:maximized-state', win.isMaximized())
}

const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const defaultState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  tasks: [
    { id: 'welcome', title: '把今天最重要的一件事写下来', createdAt: new Date().toISOString(), completed: false, priority: 'high', date: todayKey(), notes: '' },
    { id: 'deep-work', title: '完成 90 分钟不被打扰的深度工作', createdAt: new Date().toISOString(), completed: false, priority: 'medium', date: todayKey(), notes: '' },
    { id: 'review', title: '整理收件箱，留下真正需要行动的事项', createdAt: new Date().toISOString(), completed: true, priority: 'low', date: todayKey(), notes: '' },
  ],
  focusMinutes: 0,
  feeds: [],
  groups: [],
  articles: [],
  focusSessions: [],
  activeTimer: null,
  dailyReflections: [],
}

let stateWriteQueue = Promise.resolve()

function stateFile() {
  return path.join(app.getPath('userData'), 'deskflow-state.json')
}

async function readState() {
  return readStateFile(stateFile(), defaultState)
}

async function writeState(state) {
  if (!isStatePayload(state, CURRENT_SCHEMA_VERSION)) throw new Error('Invalid application state')
  const write = stateWriteQueue.then(() => writeStateFile(stateFile(), state))
  stateWriteQueue = write.catch(() => undefined)
  return write
}

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#f7f6f2',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('close', (event) => {
    if (!quitting && modalWindows.has(win)) event.preventDefault()
  })
  win.on('maximize', () => sendWindowMaximizedState(win))
  win.on('unmaximize', () => sendWindowMaximizedState(win))
  win.on('closed', () => destroyBrowserView(win, true))
  win.webContents.on('did-start-loading', () => setWindowModalActive(win, false))
  win.webContents.on('render-process-gone', () => setWindowModalActive(win, false))

  if (isDev) {
    win.loadURL('http://127.0.0.1:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  // handle(双向)，渲染进程读存档
  ipcMain.handle('state:load', readState)
  // handle(双向)，渲染进程写存档
  ipcMain.handle('state:save', (_event, state) => writeState(state))
  ipcMain.handle('feed:fetch-text', (_event, url) => fetchText(url))
  ipcMain.handle('browser:open', (event, value) => openBrowser(event.sender, value))
  ipcMain.on('browser:set-bounds', (event, bounds) => setBrowserBounds(event.sender, bounds))
  ipcMain.on('browser:set-resizing', (event, resizing) => setBrowserResizing(event.sender, resizing))
  ipcMain.on('browser:close', (event) => closeBrowser(event.sender))
  ipcMain.on('browser:back', (event) => goBack(event.sender))
  ipcMain.on('browser:forward', (event) => goForward(event.sender))
  ipcMain.on('browser:reload', (event) => reloadBrowser(event.sender))
  ipcMain.on('window:set-modal-active', (event, active) => {
    if (typeof active !== 'boolean') return
    setWindowModalActive(BrowserWindow.fromWebContents(event.sender), active)
  })
  ipcMain.handle('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !modalWindows.has(win)) win.minimize()
  })
  ipcMain.on('window:toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || modalWindows.has(win)) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !modalWindows.has(win)) win.close()
  })
  // on(单向)，触发系统通知
  ipcMain.on('notification:show', (_event, { title, body }) => {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
