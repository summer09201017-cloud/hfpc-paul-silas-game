// main.js — 外殼：建 Game、註冊/註銷 Service Worker。
import { Game } from './src/game.js'

const canvas = document.getElementById('game')
const game = new Game(canvas)
game.boot()
window.__game = game   // 供 Playwright 目視驗收 / QA 注入狀態

// 開發時（localhost）註銷 SW 以免看不到改動；正式環境才註冊（離線 / 安裝到主畫面）。
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname)
if ('serviceWorker' in navigator) {
  if (isLocal) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  } else {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}))
  }
}
