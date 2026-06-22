// chart.js — 譜面：由 BPM 把「步格圖樣」展開成有時間戳的音符。
// 每個字元 = 一個步格：'0'..'3' = 該軌出一個音符；'-' = 休止。
// 音符 time（秒）= 拍數 × 每拍秒數，與 audio 的節拍同源 → 鼓點上落音符。

import { LEAD_BEATS } from './config.js'

// 漫步：四分音符格（每格 1 拍），稀疏、單顆、都落在拍點上。
// 一行 = 一小節（4 拍）。журney：踏出 → 漸強 → 高潮 → 夜更深 → 地震·監門開。
const WALK = [
  '0-1-',  // 輕聲起唱，安心
  '2-3-',
  '0-2-',
  '1-3-',
  '0123',  // 漸強，每拍一步
  '3210',
  '0-1-',
  '2-3-',
  '0202',  // 拍手相和
  '1313',
  '0123',  // 高潮
  '3-1-',
  '0-2-',
  '1-3-',
  '0---',  // 夜更深、站穩讚美
  '2---',  // 地震·監門開
]

// 闖關：八分音符格（每格 0.5 拍），含切分與連跑。
// 一行 = 一小節（8 個八分音符）。
const RUN = [
  '0-1-2-3-',  // 起步，拍點
  '1-2-1-2-',
  '0-3-0-3-',
  '0-1-2-3-',
  '0-0-3-3-',  // 漸強，成對
  '1-1-2-2-',
  '0-1-2-3-',
  '3-2-1-0-',
  '01231230',  // 高潮，連跑
  '32103210',
  '0123-321',
  '1230-012',
  '02130213',  // 同心齊唱，密集
  '13021302',
  '0123-32-',
  '1-0-2-3-',  // 夜更深，回到拍點
  '0---3---',  // 站穩讚美
  '2-------',  // 地震·監門開
]

// 把圖樣展開成音符陣列；stepBeats = 每格幾拍
function build(pattern, stepBeats, bpm) {
  const spb = 60 / bpm
  const notes = []
  let beat = LEAD_BEATS
  for (const row of pattern) {
    for (const ch of row) {
      if (ch >= '0' && ch <= '3') {
        notes.push({ time: beat * spb, lane: +ch, hit: false, judged: false, result: null, anim: 0 })
      }
      beat += stepBeats
    }
  }
  // 末尾留 4 拍尾音讓玩家站穩讚美、地震·監門開
  const endBeats = beat + 4
  return { notes, endBeats, endTime: endBeats * spb, bpm }
}

export function makeChart(mode, bpm) {
  return mode === 'run' ? build(RUN, 0.5, bpm) : build(WALK, 1, bpm)
}
