// input.js — 原始輸入，不懂遊戲規則。
// 鍵盤軌道按下、觸控按下都帶「音訊時間戳」(由 game 注入 clock) → 節奏判定精準。
// 提供具名處理器與 detach()，嵌入卸載時移得乾淨。

import { LANE_KEYS } from './config.js'

const KEY_TO_LANE = {}
LANE_KEYS.forEach((keys, lane) => keys.forEach(k => { KEY_TO_LANE[k] = lane }))

export class Input {
  constructor(canvas) {
    this.canvas = canvas
    this.clock = () => 0           // game 注入：回傳音訊時間（秒）
    this.laneQueue = []            // [{lane, t}] 待判定的軌道按下
    this.pointerQueue = []         // [{x, y, t}] client 座標的點擊
    this.pointer = { x: 0, y: 0, down: false }
    this.anyEdge = false           // 任意「按下」邊緣（用於開始/續關）
    this.held = [false, false, false, false]
    this._down = new Set()
  }

  attach(clock) {
    if (clock) this.clock = clock
    this._onKeyDown = (e) => {
      if (e.repeat) return
      const lane = KEY_TO_LANE[e.code]
      if (lane != null) {
        e.preventDefault()
        if (!this._down.has(e.code)) {
          this._down.add(e.code)
          this.held[lane] = true
          this.laneQueue.push({ lane, t: this.clock() })
        }
      }
      // 開始/續關鍵
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
        e.preventDefault(); this.anyEdge = true
      }
    }
    this._onKeyUp = (e) => {
      const lane = KEY_TO_LANE[e.code]
      if (lane != null) { this._down.delete(e.code); this.held[lane] = laneStillHeld(this._down, lane) }
    }
    this._onPointerDown = (e) => {
      this.pointer.down = true
      this._setPointer(e)
      this.pointerQueue.push({ x: e.clientX, y: e.clientY, t: this.clock() })
      this.anyEdge = true
    }
    this._onPointerUp = () => { this.pointer.down = false }
    this._onPointerMove = (e) => this._setPointer(e)
    this._onBlur = () => { this._down.clear(); this.held = [false, false, false, false]; this.pointer.down = false }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    this.canvas.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('pointerup', this._onPointerUp)
    window.addEventListener('pointermove', this._onPointerMove)
    window.addEventListener('blur', this._onBlur)
  }

  _setPointer(e) { this.pointer.x = e.clientX; this.pointer.y = e.clientY }

  // game 每幀取走佇列
  drainLanes() { const q = this.laneQueue; this.laneQueue = []; return q }
  drainPointers() { const q = this.pointerQueue; this.pointerQueue = []; return q }
  takeEdge() { const e = this.anyEdge; this.anyEdge = false; return e }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    this.canvas.removeEventListener('pointerdown', this._onPointerDown)
    window.removeEventListener('pointerup', this._onPointerUp)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('blur', this._onBlur)
  }
}

function laneStillHeld(downSet, lane) {
  for (const code of downSet) if (KEY_TO_LANE[code] === lane) return true
  return false
}
