// game.js — 主迴圈 + 狀態機 + 節奏判定 + 信心/救援 + 結算。
// 狀態：title → mode → count → play ⇄ sink(救援) → win
// 時鐘：命中判定用 AudioContext 時鐘（songPos）；動畫/特效用 rAF 的 game.time。

import { VIEW, HIGHWAY, DIFF, SCORE, STARS, COUNT_BEATS, RESCUE as RCFG, FAITH } from './config.js'
import { makeChart } from './chart.js'
import { Input } from './input.js'
import { Audio, TRACK_NAMES } from './audio.js'
import { Renderer } from './renderer.js'
import { initSpeech, speakScripture, stopSpeech } from './speak.js'
import * as C from './content.js'

const W = VIEW.W, H = VIEW.H
const QK = ['perfect', 'good', 'bad']
const PETER_X = 156, SEA_Y = 372   // 與 renderer 的場景座標一致（彼得腳底 / 海面）

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas
    this.embed = !!opts.embed
    this.onComplete = opts.onComplete || (() => {})
    this.startMode = opts.mode || 'run'

    this.audio = new Audio()
    this.input = new Input(canvas)
    this.renderer = new Renderer(canvas)

    // 給 renderer 讀的文案
    this.MODES = C.MODES; this.WIN = C.WIN; this.RESCUE = C.RESCUE
    this.SINK_CRY = C.SINK_CRY; this.COUNT_HINT = C.COUNT_HINT
    this.TITLE = C.TITLE
    this.storyIndex = 0
    this.splashes = []          // 命中時彼得腳邊的水花
    this._spokeRescue = false

    this.state = 'title'
    this.time = 0
    this.last = 0
    this.acc = 0
    this.stopped = false
    this.view = { scale: 1, ox: 0, oy: 0 }
    this.muted = false

    // 環境特效
    this.flash = 0; this.bolt = 0; this.boltX = 480; this.boltTimer = 3
    this.recvFlash = [0, 0, 0, 0]
    this.comboPop = 0; this.lastHitAge = 9
    this.judge = null; this.judgeAge = 9
    this.peterSink = 0
    this.progress = 0; this.faith = 0.7

    this.buttons = {
      start: { x: 350, y: 392, w: 260, h: 64, label: '開始讚美 ▶' },
      walk: { x: 80, y: 150, w: 380, h: 230 },
      run: { x: 500, y: 150, w: 380, h: 230 },
      again: { x: 298, y: 448, w: 204, h: 44, label: '🔁 再唱一次' },
      listen: { x: 514, y: 448, w: 150, h: 44, label: '🔊 再聽一次' },
      mute: { x: 10, y: H - 46, w: 38, h: 36 },
      pause: { x: 54, y: H - 46, w: 38, h: 36 },
      resume: { x: 380, y: 288, w: 200, h: 60, label: '▶ 繼續' },
    }
    this.hover = null
  }

  boot() {
    initSpeech()
    this.input.attach(() => this.audio.now())
    // 嵌入時也先進「選 10 首歌」畫面(走/跑由站點 mode 決定,跳過走/跑選單);選好一首再開打。
    // 之後失敗重來走 _restart() → 直接用已選的那首倒數,不再每次重選。
    if (this.embed) { this.audio.unlock(); this.state = 'song' }
    this.last = performance.now()
    requestAnimationFrame(t => this.loop(t))
  }

  loop(t) {
    if (this.stopped) return
    let dt = (t - this.last) / 1000; this.last = t
    if (dt > 0.1) dt = 0.1
    this.acc += dt
    const STEP = 1 / 60
    while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP }
    this.renderer.draw(this)
    requestAnimationFrame(tt => this.loop(tt))
  }

  // ===================== 更新 =====================
  step(dt) {
    this.time += dt
    this._fx(dt)
    this._pointers()
    if (this.input.takeEdge()) this._onEdge()

    if (this.state === 'count') this._stepCount(dt)
    else if (this.state === 'play') this._stepPlay(dt)
    else if (this.state === 'sink') this._stepSink(dt)
  }

  _fx(dt) {
    this.bolt *= 0.88; this.flash *= 0.85
    this.comboPop = Math.max(0, this.comboPop - dt * 3)
    this.lastHitAge += dt; this.judgeAge += dt
    for (let i = 0; i < 4; i++) this.recvFlash[i] = Math.max(0, this.recvFlash[i] - dt * 5)
    // 閃電（信心越低、風越大、越常打雷）
    this.boltTimer -= dt
    const danger = this.state === 'play' && this.faith < FAITH.warn ? 2.2 : 1
    if (this.boltTimer <= 0) {
      this.bolt = 1; this.flash = 0.7; this.boltX = 120 + Math.random() * 720
      this.boltTimer = (4 + Math.random() * 5) / danger
    }
    // 彼得下沉視覺：信心低 → 沉得深；命中後微微浮起
    const target = this.state === 'sink' ? 1 : Math.max(0, (FAITH.warn - this.faith) / FAITH.warn) * 0.9
    this.peterSink += (target - this.peterSink) * Math.min(1, dt * 4)
    // 風聲跟信心走
    if (this.state === 'play') this.audio.setWind(1 - this.faith)
    // 水花
    for (const s of this.splashes) { s.x += s.vx * dt; s.vy += 320 * dt; s.y += s.vy * dt; s.life -= dt }
    if (this.splashes.length) this.splashes = this.splashes.filter(s => s.life > 0)
  }

  _stepCount(dt) {
    this.countT += dt
    const beat = Math.floor(this.countT / this.spb)
    if (beat !== this._lastCountBeat && beat < COUNT_BEATS) { this._lastCountBeat = beat; this.audio.count(beat) }
    this.countNum = COUNT_BEATS - beat
    this.countFrac = 1 - (this.countT / this.spb - beat)
    if (this.countT >= COUNT_BEATS * this.spb) this._startPlay()
  }

  _stepPlay(dt) {
    this.songPos = this.audio.now() - this.songStart
    const win = this.diff.win
    // 漏拍判定
    for (const n of this.chart.notes) {
      if (n.hit || n.judged) continue
      if (n.time < this.songPos - win.bad) {
        n.judged = true; n.result = 3
        this.counts.miss++; this.combo = 0
        this.faith = Math.max(this.diff.floor, this.faith - this.diff.missPenalty)
        this._setJudge('miss', '#e0573f'); this.audio.miss()
      }
    }
    // 處理按鍵
    for (const p of this.input.drainLanes()) this._judgeLane(p.lane, p.t - this.songStart)
    // 命中動畫衰減
    for (const n of this.chart.notes) if (n.hit && n.anim > 0) n.anim = Math.max(0, n.anim - dt * 4)
    // 信心歸零 → 下沉（僅闖關）
    if (this.diff.canSink && this.faith <= 0.001) return this._enterSink()
    // 進度與過關
    this.progress = Math.max(0, Math.min(1, this.songPos / this.chart.endTime))
    if (this.songPos >= this.chart.endTime) this._win()
  }

  _judgeLane(lane, t) {
    const win = this.diff.win
    let best = null, bestAbs = Infinity
    for (const n of this.chart.notes) {
      if (n.lane !== lane || n.hit || n.judged) continue
      const d = Math.abs(n.time - t)
      if (d < bestAbs) { bestAbs = d; best = n }
    }
    if (!best || bestAbs > win.bad) return   // 空拍：對小孩友善，不罰
    best.hit = true; best.judged = true; best.anim = 1
    let q
    if (bestAbs <= win.perfect) { q = 0; this._setJudge('完美!', '#9fe8cf') }
    else if (bestAbs <= win.good) { q = 1; this._setJudge('好', '#bcd0ff') }
    else { q = 2; this._setJudge('差', '#e8a83f') }
    best.result = q
    this.faith = Math.min(1, this.faith + this.diff.gain[QK[q]])
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.comboPop = 1
    this.score += SCORE[QK[q]]; this.counts[QK[q]]++
    this.recvFlash[lane] = 1; this.lastHitAge = 0
    this.audio.hit(q)
    this._splash(q)
  }

  // 彼得腳邊濺起水花（強化「踏在水面」）
  _splash(q) {
    if (this.peterSink > 0.6) return
    const fx = PETER_X + this.progress * 78
    const fy = SEA_Y + 36 + this.peterSink * 78
    const n = q === 0 ? 6 : 4
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
      const sp = 60 + Math.random() * 90
      this.splashes.push({ x: fx + (Math.random() - 0.5) * 14, y: fy + 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.5, max: 0.5 })
    }
  }

  _setJudge(text, color) { this.judge = { text, color }; this.judgeAge = 0 }

  // ---- 下沉與救援（太 14:30-31）----
  _enterSink() {
    this.state = 'sink'; this.rescueT = 0; this.rescuePhase = 0; this._spokeRescue = false
    this.stumbles++
    this.audio.suspend()      // 凍結音樂與音訊時鐘
  }
  _stepSink(dt) {
    this.rescueT += dt
    this.rescuePhase = Math.min(1, this.rescueT / RCFG.holdSec)
    if (this.rescuePhase >= 0.5 && !this._spokeRescue) {
      this._spokeRescue = true
      speakScripture(this.RESCUE.word, { isMuted: () => this.muted, ref: this.RESCUE.ref })
    }
    if (this.rescuePhase >= 1) this._resume()
  }
  _resume() {
    this.faith = RCFG.resetFaith
    this.audio.resume()
    this.audio.rescue()
    // 寬恕：救援期間錯過的音符不罰、不算
    const sp = this.audio.now() - this.songStart
    for (const n of this.chart.notes) if (!n.judged && n.time <= sp + this.diff.win.bad) { n.judged = true; n.result = null }
    this.state = 'play'
  }

  // ===================== 流程 =====================
  _onEdge() {
    if (this.state === 'title') { this.audio.unlock(); this.storyIndex = 0; this.state = 'story' }
    else if (this.state === 'story') this._advanceStory()
    else if (this.state === 'win') this._restart()
  }

  _advanceStory() {
    this.storyIndex++
    if (this.storyIndex >= this.TITLE.story.length) { this.state = 'mode' }
  }

  _pointers() {
    // hover（桌面）
    const pl = this._toLogical(this.input.pointer.x, this.input.pointer.y)
    this.hover = this._hitButton(pl.x, pl.y)
    // 點擊
    for (const p of this.input.drainPointers()) {
      const L = this._toLogical(p.x, p.y)
      // 靜音鈕（任何狀態）
      if (inRect(L, this.buttons.mute)) { this.muted = !this.muted; this.audio.setMuted(this.muted); if (this.muted) stopSpeech(); continue }
      if (this.state === 'paused') { this._resumeFromPause(); continue }
      if (this.state === 'play' && inRect(L, this.buttons.pause)) { this._pause(); continue }
      if (this.state === 'title') { this.audio.unlock(); this.storyIndex = 0; this.state = 'story' }
      else if (this.state === 'story') { this.audio.unlock(); this._advanceStory() }
      else if (this.state === 'mode') {
        if (inRect(L, this.buttons.walk)) { this.audio.unlock(); this.startMode = 'walk'; this.state = 'song' }
        else if (inRect(L, this.buttons.run)) { this.audio.unlock(); this.startMode = 'run'; this.state = 'song' }
      } else if (this.state === 'song') {
        for (let i = 0; i < TRACK_NAMES.length; i++) { if (inRect(L, this.songRect(i))) { this._songIdx = i; this._startCountdown(this.startMode); break } }
      } else if (this.state === 'win') {
        if (inRect(L, this.buttons.again)) this._restart()
        else if (inRect(L, this.buttons.listen)) speakScripture(`${this.WIN.head}。${this.WIN.verse}。${this.WIN.refSpoken || ''}`, { isMuted: () => this.muted })
      } else if (this.state === 'play') {
        // 觸控：點高速公路 → 對應軌道（用按下時間戳）
        const lane = this._laneAt(L.x)
        if (lane >= 0) this._judgeLane(lane, p.t - this.songStart)
      }
    }
  }

  _hitButton(x, y) {
    const B = this.buttons
    if (inRect({ x, y }, B.mute)) return 'mute'
    if (this.state === 'play' && inRect({ x, y }, B.pause)) return 'pause'
    if (this.state === 'paused' && inRect({ x, y }, B.resume)) return 'resume'
    if (this.state === 'title' && inRect({ x, y }, B.start)) return 'start'
    if (this.state === 'mode') { if (inRect({ x, y }, B.walk)) return 'walk'; if (inRect({ x, y }, B.run)) return 'run' }
    if (this.state === 'song') { for (let i = 0; i < TRACK_NAMES.length; i++) if (inRect({ x, y }, this.songRect(i))) return 'song' + i }
    if (this.state === 'win' && inRect({ x, y }, B.again)) return 'again'
    if (this.state === 'win' && inRect({ x, y }, B.listen)) return 'listen'
    return null
  }

  _pause() {
    if (this.state !== 'play') return
    this.state = 'paused'
    this.audio.suspend()
  }

  _resumeFromPause() {
    if (this.state !== 'paused') return
    this.audio.resume()
    this.state = 'play'
  }

  _laneAt(x) {
    if (x < HIGHWAY.x0 - 10 || x > HIGHWAY.x0 + HIGHWAY.totalW + 10) return -1
    const lane = Math.floor((x - HIGHWAY.x0) / (HIGHWAY.laneW + HIGHWAY.gap))
    return Math.max(0, Math.min(3, lane))
  }

  songRect(i) {
    const n = TRACK_NAMES.length
    const cols = n > 6 ? 2 : 1
    const rows = Math.ceil(n / cols)
    const bw = cols === 2 ? 300 : 360, bh = 46, gy = 10, gx = 24
    const top = Math.max(96, (540 - (rows * (bh + gy) - gy)) / 2 + 24)
    const left = (960 - (cols * bw + (cols - 1) * gx)) / 2
    const col = i % cols, row = (i / cols) | 0
    return { x: left + col * (bw + gx), y: top + row * (bh + gy), w: bw, h: bh }
  }

  _startCountdown(mode) {
    this.mode = mode
    this.diff = DIFF[mode]
    this.spb = 60 / this.diff.bpm
    this.countT = 0; this._lastCountBeat = -1; this.countNum = COUNT_BEATS; this.countFrac = 1
    // 預備譜面但先不開始音樂
    this.chart = makeChart(mode, this.diff.bpm)
    this.scroll = this.diff.scroll
    this.faith = this.diff.faithStart
    this.combo = 0; this.maxCombo = 0; this.score = 0; this.stumbles = 0
    this.counts = { perfect: 0, good: 0, bad: 0, miss: 0 }
    this.progress = 0; this.songPos = 0
    this.state = 'count'
  }

  _startPlay() {
    this.songStart = this.audio.startSong(this.diff.bpm, this.chart.endBeats, this._songIdx || 0)
    this.songPos = 0
    this.state = 'play'
  }

  _win() {
    this.audio.stopSong(); this.audio.win()
    const total = (this.chart && this.chart.notes.length) || 1
    const acc = (this.counts.perfect + this.counts.good * 0.66 + this.counts.bad * 0.33) / total
    let stars = 1
    for (const s of STARS) { if (acc >= s.acc && this.stumbles <= s.stumbles) { stars = s.n; break } }
    this.result = { acc, maxCombo: this.maxCombo, stumbles: this.stumbles, stars, score: this.score }
    this.progress = 1
    this.state = 'win'
    speakScripture(`${this.WIN.head}。${this.WIN.verse}。${this.WIN.refSpoken || ''}`, { isMuted: () => this.muted })
    this.onComplete({ won: true, score: this.score, stars })
  }

  _restart() {
    stopSpeech()
    if (this.embed) { this._startCountdown(this.startMode) }
    else this.state = 'mode'
  }

  // ===================== 工具 =====================
  _toLogical(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect()
    const cssX = clientX - r.left, cssY = clientY - r.top
    return { x: (cssX - this.view.ox) / this.view.scale, y: (cssY - this.view.oy) / this.view.scale }
  }

  destroy() {
    this.stopped = true
    this.input.detach()
    this.audio.destroy()
    stopSpeech()
  }
}

function inRect(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h }
