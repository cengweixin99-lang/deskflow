const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const electron = require('electron')

// Use the same DOMParser as the app without installing a second DOM implementation.
if (typeof electron === 'string') {
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'deskflow-feed-tests-'))
  const report = path.join(testDirectory, 'report.json')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(electron, [__filename, report, ...process.argv.slice(2)], {
    env, stdio: 'inherit', windowsHide: true,
  })
  child.on('error', (error) => { console.error(error); process.exitCode = 1 })
  child.on('close', (code) => {
    if (fs.existsSync(report)) console.log(fs.readFileSync(report, 'utf8'))
    else console.error('Electron did not produce a test report')
    process.exitCode = code || (fs.existsSync(report) ? 0 : 1)
  })
} else {
  const { app, BrowserWindow, net } = electron
  const report = process.argv[2]
  const profile = path.join(path.dirname(report), 'profile')
  fs.mkdirSync(profile, { recursive: true })
  app.setPath('userData', profile)
  const timeout = setTimeout(() => {
    fs.writeFileSync(report, JSON.stringify({ error: 'Feed tests timed out' }))
    app.exit(1)
  }, process.argv.includes('--live') ? 300000 : 30000)
  app.whenReady().then(async () => {
    try {
      const { build } = await import('vite')
      const built = await build({
        configFile: false, publicDir: false, logLevel: 'silent',
        build: { write: false, minify: false, lib: {
          entry: path.join(__dirname, '../src/lib/feeds.ts'), formats: ['cjs'],
        } },
      })
      const bundle = Array.isArray(built) ? built[0] : built
      const compiled = bundle.output.find((entry) => entry.type === 'chunk').code
      const livePages = []
      if (process.argv.includes('--live')) {
        for (let page = 1; page <= 30; page += 1) {
          const url = new URL('https://sinyalee.com/blog/?feed=rss2')
          if (page > 1) url.searchParams.set('paged', String(page))
          const response = await net.fetch(url.toString(), {
            headers: { 'user-agent': app.userAgentFallback.replace(/\sElectron\/[^\s]+/, '') },
            signal: AbortSignal.timeout(15000),
          })
          console.log(`RSS page ${page}: HTTP ${response.status}`)
          if (response.status === 404 && page > 1) {
            livePages.push({ error: '请求失败：HTTP 404' })
            break
          }
          if (!response.ok) throw new Error(`Live RSS page ${page}: HTTP ${response.status}`)
          livePages.push({ url: url.toString(), contentType: response.headers.get('content-type'), text: await response.text() })
        }
      }
      const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
      await win.loadURL('about:blank')
      const result = await win.webContents.executeJavaScript(`(async () => {
        const module = { exports: {} };
        const exports = module.exports;
        ${compiled}
        return await (${runTests.toString()})(module.exports, ${JSON.stringify(livePages)});
      })()`)
      fs.writeFileSync(report, JSON.stringify(result, null, 2))
      clearTimeout(timeout)
      win.destroy()
      app.exit(0)
    } catch (error) {
      fs.writeFileSync(report, JSON.stringify({ error: error.stack || String(error) }, null, 2))
      clearTimeout(timeout)
      app.exit(1)
    }
  })
}

async function runTests({ fetchParsedFeed, MAX_FEED_ARTICLES }, livePages) {
  const checks = []
  function assert(condition, message) {
    if (!condition) throw new Error(message)
  }
  function response(ids, generator = 'https://wordpress.org/?v=7.1.2') {
    return {
      url: 'https://example.com/blog/?feed=rss2', contentType: 'application/rss+xml',
      text: `<rss version="2.0"><channel><title>Test feed</title><link>https://example.com/blog/</link><description>Archive</description><generator>${generator}</generator>${ids.map((id) => `<item><title>Post ${id}</title><link>https://example.com/blog/?p=${id}</link><description>Article ${id}</description></item>`).join('')}</channel></rss>`,
    }
  }
  async function fetchWith(pages, url = 'https://example.com/blog/?feed=rss2', startPage = 1) {
    const calls = []
    window.desktop = { fetchText: async (request) => {
      calls.push(request)
      const page = Number(new URL(request).searchParams.get('paged') || 1)
      const result = typeof pages === 'function' ? pages(page) : pages[page - startPage]
      if (!result) throw new Error('Unexpected extra page request')
      if (result.error) throw new Error(result.error)
      return result
    } }
    const result = await fetchParsedFeed({ id: 'source', title: '', url, siteUrl: '', description: '', lastFetched: null, lastError: null })
    return { result, calls }
  }
  const missing = { error: "Error invoking remote method 'feed:fetch-text': Error: 请求失败：HTTP 404" }
  let outcome = await fetchWith([response([1, 2]), response([2, 3, 3]), missing])
  assert(outcome.result.articles.length === 3 && outcome.calls.length === 3, 'Pagination must deduplicate and stop at 404')
  checks.push('Multiple pages, duplicate entries, last-page HTTP 404')

  outcome = await fetchWith([response([1]), response([1])])
  assert(outcome.result.articles.length === 1 && outcome.calls.length === 2, 'Repeated pages must stop')
  outcome = await fetchWith([response([1]), response([])])
  assert(outcome.calls.length === 2, 'Empty page must stop')
  outcome = await fetchWith([response([])])
  assert(outcome.calls.length === 1, 'Empty first page must not request more pages')
  checks.push('Repeated/empty pages terminate without looping')

  outcome = await fetchWith([response([1]), missing], 'https://example.com/blog/feed/?category=7')
  assert(new URL(outcome.calls[1]).searchParams.get('category') === '7', 'Pagination must preserve feed filters')
  outcome = await fetchWith([response([1]), missing], 'https://example.com/blog/?feed=rss2&paged=3', 3)
  assert(new URL(outcome.calls[1]).searchParams.get('paged') === '4', 'Pagination must continue after the requested page')
  checks.push('WordPress /feed/ URLs, filters, non-default start page')

  outcome = await fetchWith([response([1], 'Other feed generator')])
  assert(outcome.calls.length === 1, 'Ordinary RSS must stay single-page even with feed=rss2')
  checks.push('Ordinary RSS remains single-page')

  for (const error of ['TypeError: fetch failed', '请求失败：HTTP 403', '请求失败：HTTP 500']) {
    let failure
    try { await fetchWith([response([1]), { error }]) } catch (caught) { failure = caught }
    assert(failure?.message.includes('第 2 页加载失败'), `Must surface page failure: ${error}`)
  }
  let failure
  try { await fetchWith([response([1]), { url: 'https://example.com', text: '<html>error</html>' }]) } catch (caught) { failure = caught }
  assert(failure, 'Malformed later pages must not become successful partial refreshes')
  checks.push('Network/403/500/invalid XML errors are not archive completion')

  outcome = await fetchWith((page) => response(Array.from({ length: 17 }, (_, index) => page * 100 + index)))
  assert(outcome.result.articles.length === MAX_FEED_ARTICLES && outcome.calls.length === 18, 'Article limit must stop requests at 300')
  outcome = await fetchWith((page) => response([page]))
  assert(outcome.calls.length === 30, 'Page count must be bounded')
  checks.push('300-article and 30-request limits')

  let live
  if (livePages.length) {
    outcome = await fetchWith(livePages, 'https://sinyalee.com/blog/?feed=rss2')
    assert(outcome.result.articles.length > 10, 'Live WordPress archive must contain older pages')
    live = {
      title: outcome.result.title, articles: outcome.result.articles.length,
      requests: outcome.calls.length,
      newest: outcome.result.articles[0].publishedAt,
      oldest: outcome.result.articles.at(-1).publishedAt,
      end: livePages.at(-1).error || 'Request limit',
    }
  }
  return { passed: checks, live }
}
