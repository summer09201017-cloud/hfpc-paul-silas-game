// scripts/serve.mjs — 本機遊玩用的零相依靜態伺服器。
// 自動挑一個空閒埠、用正確 MIME（ES module 需要 text/javascript）、並自動開預設瀏覽器。
// 由「玩遊戲.bat」呼叫；也可直接 `node scripts/serve.mjs`。
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, dirname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = normalize(process.argv[2] ? process.argv[2] : join(here, '..'))
const PREF = +(process.argv[3] || 5599)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/' || p.endsWith('/')) p += 'index.html'
    const file = normalize(join(root, p))
    if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden') }
    const data = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('404 not found')
  }
})

function open(url) {
  if (process.env.NO_OPEN) return
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd, () => { /* 開不起來也不影響伺服器 */ })
}

function listen(port, triesLeft) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) listen(port + 1, triesLeft - 1)
    else { console.error('server error:', e.message); process.exit(1) }
  })
  server.listen(port, () => {
    const url = `http://localhost:${port}/`
    console.log('')
    console.log('  Peter Walks the Sea -- game server running')
    console.log('  ' + url)
    console.log('')
    console.log('  (Keep this window open while playing. Close it to stop.)')
    console.log('')
    open(url)
  })
}
listen(PREF, 20)
