const { BrowserWindow, WebContentsView } = require('electron')
const { BROWSER_USER_AGENT, parseWebUrl } = require('./network.cjs')

const browserViews = new Map()
const browserLoadIds = new Map()
const browserLoads = new Map()
const browserResizeStyleKeys = new Map()
const browserResizeStyleVersions = new Map()
const BROWSER_RESIZE_CURSOR = `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACFSURBVFhHxc4xDoAgFARRzsj974KxsPkDZMVkLF4z8je2MUb7E4INwYZgQ7Ah2BBsCDYEG4INwYZgQ7AhrPTeR2076XuEmXssHXx7g1A9Q8nYyR3CauSruh39QP2J+m0nvUOYSYaq9AZhJRk7eY9gQ7Ah2BBsCDYEG4INwYZgQ7Ah2BBsF2+WyE4lzIOWAAAAAElFTkSuQmCC") 16 16, col-resize`

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

async function updateBrowserResizing(win, view, resizing) {
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

async function openBrowser(sender, value) {
  const { win } = getBrowserView(sender)
  if (!win) throw new Error('Browser window is unavailable')
  const url = parseWebUrl(value).toString()
  const view = browserViews.get(win.id) || createBrowserView(win, sender)
  view.setVisible(false)
  await loadBrowserPage(win, view, url)
}

function setBrowserBounds(sender, bounds) {
  const { win, view } = getBrowserView(sender)
  if (!win || !view) return
  const { width: maxWidth, height: maxHeight } = win.getContentBounds()
  const x = Math.max(0, Math.floor(bounds.x || 0))
  const y = Math.max(0, Math.floor(bounds.y || 0))
  const width = Math.max(0, Math.min(Math.floor(bounds.width || 0), maxWidth - x))
  const height = Math.max(0, Math.min(Math.floor(bounds.height || 0), maxHeight - y))
  view.setBounds({ x, y, width, height })
}

function setBrowserResizing(sender, resizing) {
  const { win, view } = getBrowserView(sender)
  if (win && view) void updateBrowserResizing(win, view, Boolean(resizing))
}

function closeBrowser(sender) {
  const { win } = getBrowserView(sender)
  if (win) destroyBrowserView(win)
}

function goBack(sender) {
  const { view } = getBrowserView(sender)
  if (view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack()
}

function goForward(sender) {
  const { view } = getBrowserView(sender)
  if (view?.webContents.navigationHistory.canGoForward()) view.webContents.navigationHistory.goForward()
}

function reloadBrowser(sender) {
  const { view } = getBrowserView(sender)
  if (view) view.webContents.reload()
}

module.exports = {
  closeBrowser,
  destroyBrowserView,
  goBack,
  goForward,
  openBrowser,
  reloadBrowser,
  setBrowserBounds,
  setBrowserResizing,
}
