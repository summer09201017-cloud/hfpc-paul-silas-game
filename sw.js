// sw.js — 離線快取（app shell）。改版時把 CACHE 版本號 +1。
// v11(2026-08-13)：🔊 補上預烤曉臻人聲(tts/)。
//   ★ 由來：本站 speak.js 是從 hfpc-paul-game 複製過來的，**帶了「mp3 優先」的邏輯、
//     卻沒帶「烤 mp3」那一步** ⇒ tts/manifest.json 從上線起就 404 ⇒ 每次朗讀都靜靜
//     退回 Web Speech 機器聲（使用者 0730 明令禁止的那種）。零錯誤、零紅燈，
//     只有真的按下朗讀鍵的人聽得出來 —— 屬「不會亮紅燈的錯」那一族。
//   ★ mp3 進 ASSETS = 教室沒網路也有人聲（本站賣點就是離線可用）。
const CACHE = 'paul-silas-v14'
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './manifest.webmanifest',
  './icon.svg',
  './src/game.js',
  './src/config.js',
  './src/chart.js',
  './src/input.js',
  './src/audio.js',
  './src/renderer.js',
  './src/content.js',
  './src/speak.js',
  // 🔊 預烤曉臻人聲（檔名=ttsKey 雜湊，內容見 scripts/tts-verses.json）
  './tts/manifest.json',
  './tts/98b75c3e.mp3', // 腓立比書 4:4（患難中再揚聲歌唱）
  './tts/bfbddeca.mp3', // 使徒行傳 16:26（忽然，地大震動）
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone()
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
      return res
    }).catch(() => caches.match('./index.html')))
  )
})

// 🏷️ 版號回報(0820 全艦隊批次):頁尾徽章問「實際執行中的版本」,答案=本 SW 的快取名。
self.addEventListener('message', function (e) {
  if (e && e.data === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'SW_VERSION', v: CACHE });
});
