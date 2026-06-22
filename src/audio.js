// audio.js — Web Audio 即時合成（零音檔、可離線）。
// 音樂用「向前看排程器」(lookahead scheduler) 按拍排程，與譜面同一個 BPM／同一個起拍時間
// → 鼓點上落音符，命中時間用 AudioContext 時鐘判定，無音檔延遲。

const A4 = 440
const mtof = (m) => A4 * Math.pow(2, (m - 69) / 12)

// 5 首「真的不一樣」的歌:各自不同的和弦進行 + 音色(波形)+ 琶音密度 + 旋律八度。
// 選哪首就「整首」播那首(不輪替),所以 5 首聽起來明顯不同。情緒:患難中歡然讚美。
const C = { root: 60, triad: [0, 4, 7] }, G = { root: 55, triad: [0, 4, 7] }, F = { root: 53, triad: [0, 4, 7] }
const Am = { root: 57, triad: [0, 3, 7] }, Dm = { root: 50, triad: [0, 3, 7] }, Em = { root: 52, triad: [0, 3, 7] }
const Bb = { root: 58, triad: [0, 4, 7] }, D = { root: 62, triad: [0, 4, 7] }
const END = C
const SONGS = [
  { name: '平安喜樂', prog: [C, G, Am, F],  wave: 'triangle', arpN: 2, melOct: 24 }, // 明亮抒情
  { name: '黑夜歌聲', prog: [Am, Em, F, C], wave: 'sine',     arpN: 1, melOct: 12 }, // 小調起、低柔、稀疏
  { name: '患難讚美', prog: [Dm, Bb, F, C], wave: 'square',   arpN: 3, melOct: 19 }, // 方波、三連音感
  { name: '信靠盼望', prog: [F, C, G, Am],  wave: 'triangle', arpN: 2, melOct: 24 }, // 溫暖盼望
  { name: '得勝凱歌', prog: [C, F, G, C],   wave: 'sawtooth', arpN: 4, melOct: 24 }, // 鋸齒、快琶音、凱旋
  { name: '半夜禱告', prog: [Em, C, G, D],  wave: 'sine',     arpN: 2, melOct: 19 }, // 安靜、小調起
  { name: '監牢頌讚', prog: [F, Dm, Bb, C], wave: 'square',   arpN: 3, melOct: 24 }, // 厚實、借用和弦
  { name: '釋放之歌', prog: [G, D, Em, C],  wave: 'triangle', arpN: 4, melOct: 24 }, // 明亮、快、釋放
  { name: '同心合一', prog: [C, Am, Dm, G], wave: 'sine',     arpN: 2, melOct: 12 }, // 溫暖低柔
  { name: '頌讚到底', prog: [G, Em, C, D],  wave: 'sawtooth', arpN: 3, melOct: 24 }, // 驅動、堅持讚美
]
export const TRACK_NAMES = SONGS.map((s) => s.name)

export class Audio {
  constructor() {
    this.ctx = null
    this.master = null
    this.unlocked = false
    this.wind = null
    this.windGain = null
    this._timer = null
    this.songStart = 0
    this.spb = 0.5
    this.beat = 0
    this.endBeat = 0
    this.muted = false
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
      this._makeWind()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    this.unlocked = true
  }

  now() { return this.ctx ? this.ctx.currentTime : 0 }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.9 }

  // ---- 風聲（白噪 → 帶通），隨信心起伏 ----
  _makeWind() {
    const ctx = this.ctx
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf; src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7
    const g = ctx.createGain(); g.gain.value = 0
    src.connect(bp); bp.connect(g); g.connect(this.master)
    src.start()
    this.wind = bp; this.windGain = g
  }
  // level 0..1（越大風越強），game 依信心倒推
  setWind(level) {
    if (!this.windGain) return
    const g = Math.max(0, Math.min(0.5, level * 0.5))
    this.windGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.25)
    if (this.wind) this.wind.frequency.setTargetAtTime(420 + level * 500, this.ctx.currentTime, 0.3)
  }

  // ---- 通用音色 ----
  _tone(freq, t, dur, { type = 'triangle', gain = 0.2, atk = 0.005, rel = 0.12, dest = null } = {}) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel)
    o.connect(g); g.connect(dest || this.master)
    o.start(t); o.stop(t + dur + rel + 0.02)
  }

  // ================= 音樂排程 =================
  startSong(bpm, endBeats, songStart = 0) {
    if (!this.ctx) return 0
    this._songIdx = songStart | 0
    this.spb = 60 / bpm
    this.beat = 0
    this.endBeat = endBeats
    this.songStart = this.ctx.currentTime + 0.18    // 小緩衝
    this._nextBeatTime = this.songStart
    this._timer = setInterval(() => this._schedule(), 25)
    return this.songStart
  }

  _schedule() {
    if (!this.ctx) return
    const ahead = this.ctx.currentTime + 0.14
    while (this._nextBeatTime < ahead && this.beat <= this.endBeat + 2) {
      this._scheduleBeat(this.beat, this._nextBeatTime)
      this.beat++
      this._nextBeatTime += this.spb
    }
  }

  _scheduleBeat(beat, t) {
    if (this.muted) return
    const bar = Math.floor(beat / 4)
    const inBar = beat % 4
    // 結尾兩小節解到 C，給「上船、風住了」的安定
    const endBars = Math.floor(this.endBeat / 4)
    const song = SONGS[this._songIdx || 0] || SONGS[0]   // 整首播選的那首(不輪替)
    const prog = song.prog
    const chord = bar >= endBars - 1 ? END : prog[bar % prog.length]
    const spb = this.spb

    // 低音：每拍踩根音（第 1、3 拍重）
    const bassMidi = chord.root - 12
    this._tone(mtof(bassMidi), t, spb * 0.9, {
      type: 'sine', gain: inBar % 2 === 0 ? 0.26 : 0.16, rel: 0.08,
    })

    // 琶音：每拍 arpN 個音(密度因歌而異)，用該首的音色(波形)
    const tones = chord.triad
    const n = song.arpN || 2
    for (let i = 0; i < n; i++) {
      const tt = t + (i * spb) / n
      const tone = tones[(beat * n + i) % tones.length]
      this._tone(mtof(chord.root + 12 + tone), tt, spb * (0.85 / n), {
        type: song.wave, gain: 0.11, rel: 0.1,
      })
    }

    // 鋪底和弦（每小節頭，柔）
    if (inBar === 0) {
      for (const tone of chord.triad) {
        this._tone(mtof(chord.root + tone), t, spb * 4 * 0.95, {
          type: 'sine', gain: 0.05, atk: 0.05, rel: 0.4,
        })
      }
    }

    // 旋律：每小節第 1、3 拍一點高音線，用該首音色+八度，結尾上揚
    if (inBar === 0 || inBar === 2) {
      const lift = bar >= endBars - 2 ? 12 : 0
      const top = chord.root + (song.melOct || 24) + chord.triad[(bar + (inBar === 2 ? 1 : 0)) % chord.triad.length] + lift
      this._tone(mtof(top), t, spb * 1.4, { type: song.wave, gain: 0.09, atk: 0.02, rel: 0.25 })
    }
  }

  stopSong() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    this.setWind(0)
  }

  // 凍結/解凍音訊時鐘（救援時用，凍結時 now() 不前進 → 與音樂保持同步）
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend() }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume() }

  // ================= 音效 =================
  hit(quality) {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime
    const base = quality === 0 ? 880 : quality === 1 ? 660 : 480
    this._tone(base, t, 0.06, { type: 'triangle', gain: 0.22, rel: 0.07 })
    this._tone(base * 1.5, t, 0.05, { type: 'sine', gain: 0.12, rel: 0.06 })
  }
  miss() {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime
    this._tone(150, t, 0.16, { type: 'sawtooth', gain: 0.16, rel: 0.1 })
    this._tone(96, t, 0.2, { type: 'sine', gain: 0.12, rel: 0.12 })
  }
  count(n) {  // 倒數嗶聲，最後一聲高
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime
    this._tone(n === 0 ? 784 : 523, t, 0.12, { type: 'square', gain: 0.16, rel: 0.08 })
  }
  rescue() {  // 被拉起：溫暖上行
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const ch = [60, 64, 67, 72]
    ch.forEach((m, i) => this._tone(mtof(m), t + i * 0.09, 0.5, { type: 'triangle', gain: 0.16, atk: 0.02, rel: 0.4 }))
  }
  win() {  // 上船、風住了：明亮分解和弦
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const seq = [60, 64, 67, 72, 76, 79]
    seq.forEach((m, i) => this._tone(mtof(m), t + i * 0.11, 0.6, { type: 'triangle', gain: 0.18, atk: 0.01, rel: 0.5 }))
    // 鋪一個 C 大三和弦
    ;[48, 55, 64].forEach(m => this._tone(mtof(m), t, 1.6, { type: 'sine', gain: 0.08, atk: 0.05, rel: 1.0 }))
  }

  destroy() {
    this.stopSong()
    if (this.ctx) { try { this.ctx.close() } catch (e) { /* noop */ } }
    this.ctx = null
  }
}
