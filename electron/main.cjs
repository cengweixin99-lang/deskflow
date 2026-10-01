const { app, BrowserWindow, WebContentsView, ipcMain, Menu, Notification, net } = require('electron')
const path = require('node:path')
const { isStatePayload, readStateFile, writeStateFile } = require('./state-store.cjs')

const isDev = !app.isPackaged
const browserViews = new Map()
const browserLoadIds = new Map()
const browserLoads = new Map()
const browserResizeStyleKeys = new Map()
const browserResizeStyleVersions = new Map()
const MAX_FEED_BYTES = 4 * 1024 * 1024
const BROWSER_USER_AGENT = app.userAgentFallback.replace(/\sElectron\/[^\s]+/, '')
const BROWSER_RESIZE_CURSOR = `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACFSURBVFhHxc4xDoAgFARRzsj974KxsPkDZMVkLF4z8je2MUb7E4INwYZgQ7Ah2BBsCDYEG4INwYZgQ7AhrPTeR2076XuEmXssHXx7g1A9Q8nYyR3CauSruh39QP2J+m0nvUOYSYaq9AZhJRk7eY9gQ7Ah2BBsCDYEG4INwYZgQ7Ah2BBsF2+WyE4lzIOWAAAAAElFTkSuQmCC") 16 16, col-resize`
const CURRENT_SCHEMA_VERSION = 1

function parseWebUrl(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only http and https URLs are supported')
  }
  return url
}

async function fetchText(value) {
  const url = parseWebUrl(value)
  const requestedUrl = url.toString()
  const response = await net.fetch(requestedUrl, {
    headers: {
      accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'user-agent': BROWSER_USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`请求失败：HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_FEED_BYTES) throw new Error('订阅内容超过 4 MB 限制')
  const chunks = []
  let totalBytes = 0
  if (response.body) {
    const reader = response.body.getReader()
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      totalBytes += chunk.byteLength
      if (totalBytes > MAX_FEED_BYTES) {
        await reader.cancel()
        throw new Error('订阅内容超过 4 MB 限制')
      }
      chunks.push(chunk)
    }
  }
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const contentType = response.headers.get('content-type') || ''
  const charset = /charset\s*=\s*["']?([^;"']+)/i.exec(contentType)?.[1]?.trim() || 'utf-8'
  let decoder
  try {
    decoder = new TextDecoder(charset)
  } catch {
    decoder = new TextDecoder('utf-8')
  }
  let resolvedUrl = requestedUrl
  try {
    resolvedUrl = parseWebUrl(response.url).toString()
  } catch {
    // Electron may expose an empty or non-http response URL after a redirect.
  }
  return {
    url: resolvedUrl,
    contentType,
    text: decoder.decode(bytes),
  }
}

function getBrowserView(sender) {
  const win = BrowserWindow.fromWebContents(sender)
  return win ? { win, view: browserViews.get(win.id) } : { win: null, view: null }
}

function destroyBrowserView(win, parentClosed = false) {
  const view = browserViews.get(win.id)
  if (!view) return
  browserResizeStyleVersions.set(win.id, (browserResizeStyleVersions.get(win.id) || 0) + 1)
  browserResizeStyleKeys.delete(win.id)
  browserLoadIds.set(win.id, (browserLoadIds.get(win.id) || 0) + 1)
  browserLoads.delete(win.id)
  browserViews.delete(win.id)
  if (!parentClosed && !win.isDestroyed()) win.contentView.removeChildView(view)
  if (!view.webContents.isDestroyed()) view.webContents.destroy()
}

async function setBrowserResizing(win, view, resizing) {
  const version = (browserResizeStyleVersions.get(win.id) || 0) + 1
  browserResizeStyleVersions.set(win.id, version)

  const previousStyleKey = browserResizeStyleKeys.get(win.id)
  browserResizeStyleKeys.delete(win.id)
  if (previousStyleKey && !view.webContents.isDestroyed()) {
    await view.webContents.removeInsertedCSS(previousStyleKey).catch(() => undefined)
  }
  if (!resizing || view.webContents.isDestroyed()) return

  const styleKey = await view.webContents.insertCSS(`html, body, body * { cursor: ${BROWSER_RESIZE_CURSOR} !important; }`).catch(() => '')
  if (!styleKey) return
  if (
    browserResizeStyleVersions.get(win.id) === version
    && browserViews.get(win.id) === view
    && !view.webContents.isDestroyed()
  ) {
    browserResizeStyleKeys.set(win.id, styleKey)
    return
  }
  if (!view.webContents.isDestroyed()) {
    await view.webContents.removeInsertedCSS(styleKey).catch(() => undefined)
  }
}

function navigationErrorCode(error) {
  return /\b(ERR_[A-Z_]+)\s*\((-?\d+)\)/.exec(error?.message || '')?.[1] || ''
}

async function loadBrowserPage(win, view, url) {
  const retryableErrors = new Set([
    'ERR_FAILED',
    'ERR_ABORTED',
    'ERR_CONNECTION_CLOSED',
    'ERR_CONNECTION_RESET',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_ADDRESS_UNREACHABLE',
    'ERR_NAME_NOT_RESOLVED',
    'ERR_NETWORK_CHANGED',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_TIMED_OUT',
    'ERR_HTTP2_PROTOCOL_ERROR',
    'ERR_QUIC_PROTOCOL_ERROR',
  ])
  const retryDelays = [500, 1500, 3500]
  const loadId = (browserLoadIds.get(win.id) || 0) + 1
  browserLoadIds.set(win.id, loadId)
  const previousLoad = browserLoads.get(win.id)
  if (previousLoad) {
    try {
      view.webContents.stop()
    } catch {
      // The old navigation may already have completed.
    }
    await Promise.race([
      previousLoad.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 250)),
    ])
  }

  const loadPromise = (async () => {
    for (let attempt = 0; ; attempt += 1) {
      if (win.isDestroyed() || browserViews.get(win.id) !== view || view.webContents.isDestroyed() || browserLoadIds.get(win.id) !== loadId) {
        throw new Error('页面打开已取消')
      }

      const revealView = () => {
        if (!win.isDestroyed() && browserViews.get(win.id) === view && browserLoadIds.get(win.id) === loadId) {
          view.setVisible(true)
        }
      }
      view.webContents.once('dom-ready', revealView)
      try {
        await view.webContents.loadURL(url, {
          extraHeaders: 'Cache-Control: no-cache\r\n',
        })
        view.webContents.removeListener('dom-ready', revealView)
        if (!win.isDestroyed() && browserViews.get(win.id) === view && browserLoadIds.get(win.id) === loadId) view.setVisible(true)
        return
      } catch (error) {
        view.webContents.removeListener('dom-ready', revealView)
        if (win.isDestroyed() || browserViews.get(win.id) !== view || view.webContents.isDestroyed() || browserLoadIds.get(win.id) !== loadId) {
          throw new Error('页面打开已取消')
        }

        const code = navigationErrorCode(error)
        if (!retryableErrors.has(code) || attempt >= retryDelays.length) {
          if (code) throw new Error(`网页连接失败（${code}），请检查网络后重试`)
          throw new Error('网页暂时无法打开，请检查网络后重试')
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]))
      }
    }
  })()
  browserLoads.set(win.id, loadPromise)
  try {
    await loadPromise
  } finally {
    if (browserLoads.get(win.id) === loadPromise) browserLoads.delete(win.id)
  }
}

function createBrowserView(win, sender) {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  browserViews.set(win.id, view)
  win.contentView.addChildView(view)
  view.setBorderRadius(8)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  view.setVisible(false)
  view.webContents.setUserAgent(BROWSER_USER_AGENT)
  view.webContents.on('did-fail-load', (_navigationEvent, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame) console.warn(`[browser] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`)
  })
  view.webContents.on('render-process-gone', (_event, details) => {
    console.warn(`[browser] render-process-gone ${details.reason}`)
  })
  view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    try {
      const safeUrl = parseWebUrl(targetUrl).toString()
      void loadBrowserPage(win, view, safeUrl)
    } catch {
      // Ignore unsupported popup URLs.
    }
    return { action: 'deny' }
  })
  view.webContents.on('will-navigate', (navigationEvent, targetUrl) => {
    try {
      parseWebUrl(targetUrl)
    } catch {
      navigationEvent.preventDefault()
    }
  })
  view.webContents.on('did-navigate', (_navigationEvent, targetUrl) => {
    if (!sender.isDestroyed()) sender.send('browser:navigate', targetUrl)
  })
  return view
}
const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const defaultState = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  tasks: [
    { id: 'welcome', title: '把今天最重要的一件事写下来', completed: false, priority: 'high', date: todayKey(), notes: '' },
    { id: 'deep-work', title: '完成 90 分钟不被打扰的深度工作', completed: false, priority: 'medium', date: todayKey(), notes: '' },
    { id: 'review', title: '整理收件箱，留下真正需要行动的事项', completed: true, priority: 'low', date: todayKey(), notes: '' },
  ],
  focusMinutes: 0,
  feeds: [],
  groups: [],
  articles: [],
  focusSessions: [],
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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f7f6f2',
      symbolColor: '#77766f',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => destroyBrowserView(win, true))

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
  ipcMain.handle('browser:open', async (event, value) => {
    const { win } = getBrowserView(event.sender)
    if (!win) throw new Error('Browser window is unavailable')
    const url = parseWebUrl(value).toString()
    const view = browserViews.get(win.id) || createBrowserView(win, event.sender)
    view.setVisible(false)
    await loadBrowserPage(win, view, url)
  })
  ipcMain.on('browser:set-bounds', (event, bounds) => {
    const { win, view } = getBrowserView(event.sender)
    if (!win || !view) return
    const { width: maxWidth, height: maxHeight } = win.getContentBounds()
    const x = Math.max(0, Math.floor(bounds.x || 0))
    const y = Math.max(0, Math.floor(bounds.y || 0))
    const width = Math.max(0, Math.min(Math.floor(bounds.width || 0), maxWidth - x))
    const height = Math.max(0, Math.min(Math.floor(bounds.height || 0), maxHeight - y))
    view.setBounds({ x, y, width, height })
  })
  ipcMain.on('browser:set-resizing', (event, resizing) => {
    const { win, view } = getBrowserView(event.sender)
    if (win && view) void setBrowserResizing(win, view, Boolean(resizing))
  })
  ipcMain.on('browser:close', (event) => {
    const { win } = getBrowserView(event.sender)
    if (win) destroyBrowserView(win)
  })
  ipcMain.on('browser:back', (event) => {
    const { view } = getBrowserView(event.sender)
    if (view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack()
  })
  ipcMain.on('browser:forward', (event) => {
    const { view } = getBrowserView(event.sender)
    if (view?.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward()
  })
  ipcMain.on('browser:reload', (event) => {
    const { view } = getBrowserView(event.sender)
    if (view) view.webContents.reload()
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
