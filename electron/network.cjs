const { app, net } = require('electron')

const MAX_FEED_BYTES = 4 * 1024 * 1024
const BROWSER_USER_AGENT = app.userAgentFallback.replace(/\sElectron\/[^\s]+/, '')

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

module.exports = {
  BROWSER_USER_AGENT,
  fetchText,
  parseWebUrl,
}
