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

// 🔊 預烤曉臻人聲(tts/*.mp3 + manifest.json)——speak.js 會 fetch('tts/manifest.json')。
// ★★ 2026-08-13:這一段是本站朗讀「不是機器聲」的命脈,少了它 mp3 只會躺在 repo 裡、
//    永遠進不了 site/ ⇒ 線上 manifest 404 ⇒ 靜靜退回 Web Speech 機器聲(零錯誤、零紅燈)。
//    同一天大廳的兩支 90 秒影片就是這樣 404 躺了九天(檔案在 repo 裡 ≠ 會被部署)。
//    ⇒ 加新的靜態資產時,**先問「它在不在這份複製清單裡」**。
const ttsDir = join(root, 'tts')
let ttsCount = 0
if (existsSync(ttsDir)) {
  mkdirSync(join(out, 'tts'), { recursive: true })
  for (const f of readdirSync(ttsDir)) {
    if (f.endsWith('.mp3') || f === 'manifest.json') {
      copyFileSync(join(ttsDir, f), join(out, 'tts', f)); ttsCount++
    }
  }
}

console.log('✓ 已輸出到 site/（', ROOT_FILES.length, '個根檔 + src/*.js + tts/', ttsCount, '檔 ）')
