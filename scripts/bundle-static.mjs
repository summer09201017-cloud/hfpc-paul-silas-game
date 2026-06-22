// bundle-static.mjs — 把可離線的靜態檔複製到 site/（Netlify 部署目錄）。
// 本機是 Windows + Node 24：不用遞迴 cpSync/rmSync（會無聲被砍），改逐檔 copyFileSync。
import { mkdirSync, copyFileSync, readdirSync, statSync, rmSync, rmdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'site')

// 清掉舊 site（逐檔刪，避免遞迴地雷）
function wipe(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { wipe(p); rmdirSync(p) }
    else rmSync(p)
  }
}
wipe(out)
mkdirSync(out, { recursive: true })

const ROOT_FILES = ['index.html', 'styles.css', 'main.js', 'manifest.webmanifest', 'icon.svg', 'sw.js']
for (const f of ROOT_FILES) copyFileSync(join(root, f), join(out, f))

mkdirSync(join(out, 'src'), { recursive: true })
for (const f of readdirSync(join(root, 'src'))) {
  if (f.endsWith('.js')) copyFileSync(join(root, 'src', f), join(out, 'src', f))
}

console.log('✓ 已輸出到 site/（', ROOT_FILES.length, '個根檔 + src/*.js ）')
