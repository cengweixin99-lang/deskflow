/// <reference types="vite/client" />

interface DesktopApi {
  loadState: () => Promise<unknown>
  saveState: (state: import('./types').AppState) => Promise<import('./types').AppState>
  showNotification: (payload: { title: string; body: string }) => void
  fetchText: (url: string) => Promise<import('./types').FetchedText>
  openBrowser: (url: string) => Promise<void>
  setBrowserBounds: (bounds: import('./types').BrowserBounds) => void
  setBrowserResizing: (resizing: boolean) => void
  closeBrowser: () => void
  browserBack: () => void
  browserForward: () => void
  browserReload: () => void
  setWindowModalActive: (active: boolean) => void
  isWindowMaximized: () => Promise<boolean>
  minimizeWindow: () => void
  toggleMaximizeWindow: () => void
  closeWindow: () => void
  onWindowMaximizedChange: (handler: (maximized: boolean) => void) => () => void
  onBrowserNavigate: (handler: (url: string) => void) => () => void
}

declare global {
  interface Window {
    desktop: DesktopApi
  }
}

export {}
