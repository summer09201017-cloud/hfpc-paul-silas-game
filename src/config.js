// config.js — 所有可調數值。調手感只動這裡。
// 邏輯解析度固定 960×540，renderer 等比縮放置中。

export const VIEW = { W: 960, H: 540 }

export const LANES = 4

// 音符高速公路（note highway）幾何
export const HIGHWAY = {
  receptorY: 96,     // 接收圈（命中線）y
  laneW: 84,         // 每一軌寬
  gap: 16,           // 軌間距
  bottomY: 540,      // 音符出生在畫面底
}
HIGHWAY.totalW = LANES * HIGHWAY.laneW + (LANES - 1) * HIGHWAY.gap
HIGHWAY.x0 = (VIEW.W - HIGHWAY.totalW) / 2   // 第一軌左緣

// 軌道 → 鍵盤（FNF 預設 DFJK，外加方向鍵）
export const LANE_KEYS = [
  ['ArrowLeft', 'KeyD'],
  ['ArrowDown', 'KeyF'],
  ['ArrowUp', 'KeyJ'],
  ['ArrowRight', 'KeyK'],
]
export const LANE_DIR = ['left', 'down', 'up', 'right']
export const LANE_COLORS = ['#d36a93', '#46c8a6', '#4aa6e8', '#e8654a'] // 粉 綠 藍 紅

// 兩種難度（系列慣例：🚶漫步 / 🏃闖關）
export const DIFF = {
  walk: {
    bpm: 84,
    scroll: 300,                                   // px/s 音符下落速度
    win: { perfect: 0.13, good: 0.22, bad: 0.33 }, // 判定窗（秒，越大越寬鬆）
    faithStart: 0.72,
    gain: { perfect: 0.05, good: 0.035, bad: 0.02 },
    missPenalty: 0.03,
    floor: 0.10,        // 信心永不低於此 → 漫步不會真的沉
    canSink: false,
  },
  run: {
    bpm: 108,
    scroll: 430,
    win: { perfect: 0.09, good: 0.155, bad: 0.235 },
    faithStart: 0.55,
    gain: { perfect: 0.045, good: 0.03, bad: 0.015 },
    missPenalty: 0.08,
    floor: 0,
    canSink: true,
  },
}

export const SCORE = { perfect: 350, good: 200, bad: 50 }

// 信心條視覺門檻（低於 warn 開始示警 / 畫面壓暗）
export const FAITH = { warn: 0.30, danger: 0.16 }

// 下沉復活（rescue）
export const RESCUE = {
  resetFaith: 0.42,   // 被拉起後恢復到的信心
  holdSec: 2.6,       // 救援動畫時間
}

// 過關星等：依命中率與跌倒次數
export const STARS = [
  { acc: 0.92, stumbles: 0, n: 3 },
  { acc: 0.80, stumbles: 1, n: 2 },
  { acc: 0.0, stumbles: 99, n: 1 },
]

// 倒數（拍數）與起拍前導（譜面第一個音符前的空拍）
export const COUNT_BEATS = 3
export const LEAD_BEATS = 2
