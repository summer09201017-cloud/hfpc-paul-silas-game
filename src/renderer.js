// renderer.js — 所有 Canvas 繪製。只讀 game 狀態，不改狀態。
// 版面（Option A）：音符高速公路是畫面中央一條半透明「光的橋」(x 288..672)，
// 彼得在左、耶穌在右，都在橋的左右兩側、不被音符蓋住。

import { VIEW, HIGHWAY, LANE_COLORS, LANE_DIR, FAITH } from './config.js'

const W = VIEW.W, H = VIEW.H
const SEA_Y = 372          // 海面基線
const PETER_X = 156
const JESUS_X = 824

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.stars = []
    for (let i = 0; i < 70; i++) {
      this.stars.push({ x: Math.random() * W, y: Math.random() * 300, r: Math.random() * 1.4 + 0.3, tw: Math.random() * 6 })
    }
    // 狂風暴雨:雨滴池 + 橫掃狂風弧線
    this.rain = []
    for (let i = 0; i < 150; i++) {
      this.rain.push({ x: Math.random() * (W + 120), sp: 0.55 + Math.random() * 0.85, len: 10 + Math.random() * 14, off: Math.random(), drift: 70 + Math.random() * 90 })
    }
    this.gusts = []
    for (let i = 0; i < 6; i++) {
      this.gusts.push({ x: Math.random() * (W + 300), y: 40 + Math.random() * (SEA_Y - 20), sp: 120 + Math.random() * 120, ph: Math.random() * 6 })
    }
    this.storm = 0.5   // 暴風強度(0..1),平滑趨近目標
    this._wt = 0
  }

  draw(game) {
    const c = this.canvas, ctx = this.ctx
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = c.clientWidth || W, ch = c.clientHeight || H
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) {
      c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, cw, ch)
    const scale = Math.min(cw / W, ch / H)
    const ox = (cw - W * scale) / 2, oy = (ch - H * scale) / 2
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)
    game.view = { scale, ox, oy }

    this._scene(game)

    const s = game.state
    if (s === 'play' || s === 'sink' || s === 'count' || s === 'paused') {
      this._highway(game)
      this._hud(game)
    }
    if (s === 'count') this._countdown(game)
    if (s === 'sink') this._rescueOverlay(game)
    if (s === 'title') this._title(game)
    if (s === 'story') this._story(game)
    if (s === 'mode') this._mode(game)
    if (s === 'win') this._win(game)
    if (s === 'play' || s === 'paused') this._pauseBtn(game)
    if (s === 'paused') this._pauseOverlay(game)

    if (game.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flash * 0.35})`; ctx.fillRect(0, 0, W, H) }
    this._muteBtn(game)
  }

  // ===================== 場景：腓立比監牢（半夜唱詩讚美） =====================
  _scene(game) {
    const ctx = this.ctx, t = game.time
    const FLOOR = SEA_Y + 70
    const win = game.state === 'win'
    const quake = win ? Math.sin(t * 28) * 2.4 : 0   // 過關：地大震動
    ctx.save(); ctx.translate(quake, 0)
    // 陰冷石牆
    const wall = ctx.createLinearGradient(0, 0, 0, H)
    wall.addColorStop(0, '#17120c'); wall.addColorStop(0.55, '#241b12'); wall.addColorStop(1, '#100b07')
    ctx.fillStyle = wall; ctx.fillRect(-12, 0, W + 24, H)
    // 石磚紋
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2
    for (let y = 44; y < FLOOR; y += 46) {
      ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(W + 12, y); ctx.stroke()
      const off = (((y / 46) | 0) % 2) ? 60 : 0
      for (let x = off; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 46); ctx.stroke() }
    }
    // 高處小鐵窗 + 斜射月光（半夜）
    const wx = JESUS_X, wy = 86
    ctx.fillStyle = '#0a1430'; roundRect(ctx, wx - 44, wy - 36, 88, 72, 6); ctx.fill()
    const moon = ctx.createLinearGradient(wx, wy, 360, FLOOR + 40)
    moon.addColorStop(0, 'rgba(150,180,235,0.16)'); moon.addColorStop(1, 'rgba(150,180,235,0)')
    ctx.fillStyle = moon
    ctx.beginPath(); ctx.moveTo(wx - 40, wy + 30); ctx.lineTo(wx + 40, wy + 30); ctx.lineTo(wx - 130, FLOOR + 60); ctx.lineTo(wx - 360, FLOOR + 60); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(wx + i * 22, wy - 34); ctx.lineTo(wx + i * 22, wy + 34); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(wx - 42, wy); ctx.lineTo(wx + 42, wy); ctx.stroke()
    // 地面
    ctx.fillStyle = '#0b0905'; ctx.fillRect(-12, FLOOR, W + 24, H - FLOOR)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-12, FLOOR); ctx.lineTo(W + 12, FLOOR); ctx.stroke()
    // 兩個囚犯：保羅（左）、西拉（右）——半夜禱告唱詩讚美
    const faith = game.faith == null ? 0.7 : game.faith
    this._prisoner(ctx, PETER_X, FLOOR, { faith, progress: game.progress, t, robe: '#6a4a30', robe2: '#503722', skin: '#e7bd92', hair: '#2c1d12', flip: false })
    this._prisoner(ctx, JESUS_X - 70, FLOOR, { faith, progress: game.progress, t: t + 1.3, robe: '#5a5040', robe2: '#43392c', skin: '#d8b08a', hair: '#3a2a1c', flip: true })
    // 讚美升起的音符（讚美越高越多）
    this._praiseNotes(game, faith)
    ctx.restore()
    // 過關：監門大開、鎖鏈鬆落的光
    if (win) {
      const gl = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 460)
      gl.addColorStop(0, 'rgba(255,240,200,0.20)'); gl.addColorStop(1, 'rgba(255,240,200,0)')
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H)
    }
  }

  // 一個囚犯：原點在腳底，身高約 100；★有眼睛＋表情（讚美越高越喜樂、手舉越高）
  _prisoner(ctx, x, floorY, o) {
    const dir = o.flip ? -1 : 1
    const beat = o.t * 2.6
    const joy = Math.max(0, Math.min(1, (o.progress || 0) * 0.6 + o.faith * 0.45 - 0.05))   // 越往後越高興興奮
    const bob = Math.abs(Math.sin(beat)) * (2 + joy * 7)   // 隨拍跳動
    const sway = Math.sin(beat) * (1 + joy * 3)
    ctx.save(); ctx.translate(x + sway, floorY - bob)
    // 腿（隨拍踏步、足蹈）
    const stepL = Math.max(0, Math.sin(beat)) * (1 + joy * 5)
    const stepR = Math.max(0, Math.sin(beat + Math.PI)) * (1 + joy * 5)
    ctx.strokeStyle = o.robe2; ctx.lineWidth = 10; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-7, -stepL); ctx.lineTo(-6, -26); ctx.moveTo(7, -stepR); ctx.lineTo(6, -26); ctx.stroke()
    // 腳鐐（木狗）＋鏈
    ctx.strokeStyle = '#6b6b73'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(-7, 2, 5, 0, 7); ctx.moveTo(12, 2); ctx.arc(7, 2, 5, 0, 7); ctx.stroke()
    ctx.strokeStyle = 'rgba(150,150,160,0.8)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-7, 5); ctx.lineTo(0, 9); ctx.lineTo(7, 5); ctx.stroke()
    // 袍身
    ctx.fillStyle = o.robe
    ctx.beginPath(); ctx.moveTo(-17, 2); ctx.lineTo(17, 2); ctx.lineTo(11, -54); ctx.lineTo(-11, -54); ctx.closePath(); ctx.fill()
    ctx.fillStyle = o.robe2; ctx.fillRect(-15, -32, 30, 5)   // 腰帶
    const shY = -56
    // 手臂：雙手隨拍舉起揮舞讚美（手臂加長、越興奮舉越高揮越大），手腕仍帶鐵鏈
    const up = 0.3 + joy * 0.7
    const aA = up + Math.sin(beat) * (0.15 + joy * 0.4)
    const aB = up + Math.sin(beat + Math.PI) * (0.15 + joy * 0.4)
    const ax1 = dir * (10 + aA * 22), ay1 = shY + 2 - aA * 44
    const ax2 = -dir * (10 + aB * 22), ay2 = shY + 2 - aB * 44
    ctx.strokeStyle = o.robe; ctx.lineWidth = 8; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(dir * 7, shY + 2); ctx.lineTo(ax1, ay1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-dir * 7, shY + 2); ctx.lineTo(ax2, ay2); ctx.stroke()
    ctx.fillStyle = o.skin
    ctx.beginPath(); ctx.arc(ax1, ay1, 4.5, 0, 7); ctx.fill()
    ctx.beginPath(); ctx.arc(ax2, ay2, 4.5, 0, 7); ctx.fill()
    ctx.strokeStyle = 'rgba(150,150,160,0.7)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(ax2, ay2, 6, 0, 7); ctx.stroke()
    // 頭
    const hx = 0, hy = shY - 14
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, 7); ctx.fill()
    ctx.fillStyle = o.hair
    ctx.beginPath(); ctx.arc(hx, hy - 3, 12, Math.PI, 2 * Math.PI); ctx.fill()   // 頭髮
    ctx.beginPath(); ctx.arc(hx, hy + 8, 7, 0.2, Math.PI - 0.2); ctx.fill()       // 鬍（較低）
    // ★ 臉：眼睛 + 眉毛 + 唱歌的嘴
    this._singFace(ctx, hx, hy, dir, joy)
    ctx.restore()
  }

  // 臉：兩眼（望天）＋眉（喜樂上揚）＋張口歌唱
  _singFace(ctx, hx, hy, dir, joy) {
    const ex = 4.4, ey = hy - 1
    if (joy > 0.5) { ctx.fillStyle = `rgba(232,120,90,${(joy - 0.5) * 0.6})`; ctx.beginPath(); ctx.arc(hx - 6.5, hy + 3, 2.6, 0, 7); ctx.arc(hx + 6.5, hy + 3, 2.6, 0, 7); ctx.fill() }
    for (const sx of [-ex, ex]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(hx + sx, ey, 2.6, 3 - joy * 0.8, 0, 0, 7); ctx.fill()
      ctx.fillStyle = '#241a12'; ctx.beginPath(); ctx.arc(hx + sx, ey - 0.6, 1.5, 0, 7); ctx.fill()
    }
    ctx.strokeStyle = '#241a12'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'
    const br = 1.4 + joy * 3.2
    ctx.beginPath(); ctx.moveTo(hx - ex - 2.6, ey - 4 - br * 0.3); ctx.lineTo(hx - ex + 2, ey - 5 - br); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(hx + ex - 2, ey - 5 - br); ctx.lineTo(hx + ex + 2.6, ey - 4 - br * 0.3); ctx.stroke()
    // 嘴：張口歌唱（越喜樂張越大）
    const mh = 2.4 + joy * 6.5
    ctx.fillStyle = '#3a1d1d'; ctx.beginPath(); ctx.ellipse(hx + dir * 0.5, hy + 4, 2.8 + joy * 1.8, mh, 0, 0, 7); ctx.fill()
  }

  // 讚美升起的音符（讚美越高越多越亮）
  _praiseNotes(game, faith) {
    const ctx = this.ctx, t = game.time
    const glyphs = ['♪', '♫', '♬']
    const n = Math.round(3 + faith * 6)
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '20px serif'
    for (let i = 0; i < n; i++) {
      const seed = i * 53.7
      const side = (i % 2) ? JESUS_X - 70 : PETER_X
      const rise = (t * (28 + (i % 3) * 10) + seed * 7) % 240
      const x = side + Math.sin(t * 1.2 + seed) * 26
      const y = SEA_Y + 30 - rise
      const a = Math.max(0, (240 - rise) / 240) * (0.25 + faith * 0.5)
      ctx.globalAlpha = a; ctx.fillStyle = '#ffe6a8'
      ctx.fillText(glyphs[i % 3], x, y)
    }
    ctx.restore()
  }

  _weather(game) {
    // 強度:玩時讚美越低越狂、下沉最猛、過關「風就住了」漸停、其餘畫面中等
    const s = game.state
    let target = 0.5
    if (s === 'play' || s === 'count') target = 0.45 + (1 - (game.faith == null ? 0.6 : game.faith)) * 0.55
    else if (s === 'sink') target = 1
    else if (s === 'win') target = 0.08
    if (this.reduce) target *= 0.5
    const dt = Math.min(0.05, Math.max(0, game.time - this._wt)); this._wt = game.time
    this.storm += (target - this.storm) * Math.min(1, dt * 1.6)
    const I = this.storm
    if (I <= 0.02) return
    const ctx = this.ctx, t = game.time
    ctx.save()
    ctx.lineCap = 'round'
    // 雨幕（斜掃，越狂越多越長）
    ctx.strokeStyle = `rgba(190,212,240,${0.22 * I})`
    ctx.lineWidth = 1.4
    ctx.beginPath()
    const shown = Math.floor(this.rain.length * Math.min(1, I))
    for (let i = 0; i < shown; i++) {
      const d = this.rain[i]
      const frac = (t * d.sp + d.off) % 1
      const y = frac * (H + 80) - 40
      let x = (d.x + t * d.drift) % (W + 120); x -= 60
      const len = d.len * (0.8 + I * 0.5)
      ctx.moveTo(x, y); ctx.lineTo(x + len * 0.45, y + len)
    }
    ctx.stroke()
    // 狂風橫掃（半透明弧線，被風吹過水面上方）
    ctx.strokeStyle = `rgba(214,228,250,${0.10 * I})`
    ctx.lineWidth = 2
    for (const g of this.gusts) {
      let gx = (g.x + t * g.sp) % (W + 300) - 150
      const gy = g.y + Math.sin(t * 0.8 + g.ph) * 8
      ctx.beginPath(); ctx.moveTo(gx, gy)
      ctx.quadraticCurveTo(gx + 90, gy - 10, gx + 200, gy + 4); ctx.stroke()
    }
    ctx.restore()
  }

  _splashes(game) {
    if (!game.splashes || !game.splashes.length) return
    const ctx = this.ctx
    for (const s of game.splashes) {
      const a = Math.max(0, s.life / s.max)
      ctx.fillStyle = `rgba(190,225,255,${a * 0.85})`
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.5 + a * 2.5, 0, 7); ctx.fill()
    }
  }

  _sea(game, back) {
    const ctx = this.ctx, t = game.time
    const layers = back
      ? [{ y: SEA_Y, amp: 8, k: 0.012, sp: 0.7, col: '#16305a' }, { y: SEA_Y + 26, amp: 12, k: 0.009, sp: 0.5, col: '#102444' }]
      : [{ y: SEA_Y + 50, amp: 14, k: 0.011, sp: 1.0, col: '#0c1c38' }, { y: SEA_Y + 92, amp: 18, k: 0.008, sp: 0.8, col: '#081427' }]
    for (const L of layers) {
      ctx.fillStyle = L.col
      ctx.beginPath(); ctx.moveTo(0, H)
      for (let x = 0; x <= W; x += 12) {
        const y = L.y + Math.sin(x * L.k + t * L.sp) * L.amp + Math.sin(x * 0.03 - t * 0.4) * 4
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill()
    }
    if (!back) {
      // 浪花高光
      ctx.strokeStyle = 'rgba(150,200,255,0.18)'; ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = 0; x <= W; x += 12) {
        const y = SEA_Y + 50 + Math.sin(x * 0.011 + t * 1.0) * 14
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  _bolt(game) {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = Math.min(1, game.bolt)
    ctx.strokeStyle = 'rgba(220,235,255,0.9)'; ctx.lineWidth = 2.5
    ctx.shadowColor = '#cfe2ff'; ctx.shadowBlur = 14
    ctx.beginPath()
    let x = game.boltX, y = 0
    ctx.moveTo(x, y)
    while (y < SEA_Y) { y += 26 + Math.random() * 22; x += (Math.random() - 0.5) * 60; ctx.lineTo(x, y) }
    ctx.stroke(); ctx.restore()
  }

  // ===================== 彼得 =====================
  _peter(game) {
    const ctx = this.ctx
    const sink = game.peterSink || 0
    const x = PETER_X + (game.progress || 0) * 78          // 隨進度微微往右挪
    const baseY = SEA_Y + 36 + sink * 78                   // 下沉 → 整個人下移，被前層海蓋住
    const bob = Math.sin(game.time * 4) * (2 + (1 - sink) * 2)
    const y = baseY + bob
    ctx.save()
    ctx.translate(x, y)
    // 腳邊水波（站在水面）
    if (sink < 0.5) {
      ctx.strokeStyle = `rgba(150,200,255,${0.4 * (1 - sink)})`; ctx.lineWidth = 2
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(0, 6, 14 * i + (game.time * 20 % 14), 4 * i, 0, 0, 7); ctx.stroke()
      }
    }
    const reach = (game.lastHitAge < 0.25) ? 1 : 0.4   // 命中後手伸得更前
    this._figure(ctx, {
      robe: '#3a5a86', robe2: '#2c466a', skin: '#e7bd92', hair: '#3a2a1c',
      reachR: reach, reachL: 0.15, faceRight: true, panic: sink > 0.45,
    })
    ctx.restore()
  }

  // ===================== 耶穌 =====================
  _jesus(game) {
    const ctx = this.ctx
    const x = JESUS_X, y = SEA_Y + 30 + Math.sin(game.time * 1.5) * 1.5
    // 榮光
    const gl = ctx.createRadialGradient(x, y - 40, 6, x, y - 40, 150)
    gl.addColorStop(0, 'rgba(255,244,210,0.55)')
    gl.addColorStop(0.5, 'rgba(255,228,170,0.18)')
    gl.addColorStop(1, 'rgba(255,228,170,0)')
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - 40, 150, 0, 7); ctx.fill()
    ctx.save(); ctx.translate(x, y)
    // 腳邊水波
    ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 2
    for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, 6, 16 * i, 5 * i, 0, 0, 7); ctx.stroke() }
    // 光環
    ctx.strokeStyle = 'rgba(255,240,200,0.85)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(0, -86, 16, 0, 7); ctx.stroke()
    this._figure(ctx, {
      robe: '#f3efe2', robe2: '#ddd6c2', skin: '#e7bd92', hair: '#5a4632',
      reachL: 1, reachR: 0.1, faceRight: false, glow: true,   // 伸左手向彼得
    })
    ctx.restore()
  }

  // 通用人形：直立袍人，可指定兩手伸展程度、面向、是否發光
  // 原點在「腳底（水面）」；身高約 96
  _figure(ctx, o) {
    const dir = o.faceRight ? 1 : -1
    if (o.glow) { ctx.shadowColor = 'rgba(255,240,200,0.8)'; ctx.shadowBlur = 12 }
    // 腿
    ctx.strokeStyle = o.robe2; ctx.lineWidth = 9; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-5, -34); ctx.moveTo(6, 0); ctx.lineTo(5, -34); ctx.stroke()
    // 袍身（梯形）
    ctx.fillStyle = o.robe
    ctx.beginPath()
    ctx.moveTo(-16, 2); ctx.lineTo(16, 2); ctx.lineTo(11, -52); ctx.lineTo(-11, -52); ctx.closePath(); ctx.fill()
    ctx.fillStyle = o.robe2
    ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(0, 2); ctx.lineTo(-3, -52); ctx.lineTo(-11, -52); ctx.closePath(); ctx.fill()
    // 腰帶
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-14, -30, 28, 5)
    // 肩
    const shY = -54
    // 兩隻手臂（伸展程度 reachR/reachL：0=垂下, 1=平伸向前）
    this._arm(ctx, o, dir, shY, o.reachR, true)   // 前側手
    this._arm(ctx, o, dir, shY, o.reachL, false)  // 後側手
    // 頭
    ctx.fillStyle = o.skin
    ctx.beginPath(); ctx.arc(0, shY - 14, 11, 0, 7); ctx.fill()
    // 頭髮/鬍
    ctx.fillStyle = o.hair
    ctx.beginPath(); ctx.arc(0, shY - 18, 11, Math.PI, 2 * Math.PI); ctx.fill()
    ctx.beginPath(); ctx.arc(0, shY - 9, 7, 0.1, Math.PI - 0.1); ctx.fill()   // 鬍
    // 表情（驚慌時嘴張）
    if (o.panic) { ctx.fillStyle = '#5a2a2a'; ctx.beginPath(); ctx.arc(dir * 2, shY - 10, 2.4, 0, 7); ctx.fill() }
    ctx.shadowBlur = 0
  }

  _arm(ctx, o, dir, shY, reach, front) {
    // reach 0→1：手由垂放擺到向前平伸（front 手用主面向，後手略低）
    const len = 26
    const ang = (reach) * (Math.PI / 2)        // 0=向下, 90°=水平
    const sx = dir * 6, sy = shY + 2
    const ex = sx + dir * Math.sin(ang) * len
    const ey = sy + Math.cos(ang) * len * (front ? 1 : 1) - (front ? 0 : 0)
    ctx.strokeStyle = o.robe; ctx.lineWidth = 7; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke()
    // 手掌
    ctx.fillStyle = o.skin
    ctx.beginPath(); ctx.arc(ex, ey, 4.2, 0, 7); ctx.fill()
  }

  _pauseBtn(game) {
    const ctx = this.ctx, b = game.buttons.pause
    ctx.save()
    ctx.fillStyle = 'rgba(10,14,28,0.55)'; roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill()
    ctx.strokeStyle = 'rgba(200,220,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = '#dce8ff'
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    if (game.state === 'paused') { ctx.beginPath(); ctx.moveTo(cx - 5, cy - 7); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx - 5, cy + 7); ctx.closePath(); ctx.fill() }
    else { ctx.fillRect(cx - 6, cy - 7, 4, 14); ctx.fillRect(cx + 2, cy - 7, 4, 14) }
    ctx.restore()
  }

  _pauseOverlay(game) {
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(4,6,15,0.64)'; ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'; ctx.font = '900 52px system-ui,sans-serif'
    ctx.fillText('⏸ 暫停', W / 2, 200)
    this._btn(game.buttons.resume, game.hover === 'resume')
    ctx.fillStyle = 'rgba(220,230,255,0.7)'; ctx.font = '500 16px system-ui,sans-serif'
    ctx.fillText('（點任何地方／按繼續鈕都可繼續）', W / 2, 384)
    ctx.restore()
  }

  // ===================== 音符高速公路 =====================
  _highway(game) {
    const ctx = this.ctx
    const x0 = HIGHWAY.x0, totalW = HIGHWAY.totalW
    // 半透明「光的橋」面板
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(10,18,40,0.50)')
    grad.addColorStop(1, 'rgba(10,18,40,0.18)')
    ctx.fillStyle = grad
    ctx.fillRect(x0 - 10, 0, totalW + 20, H)
    ctx.strokeStyle = 'rgba(150,190,255,0.15)'; ctx.lineWidth = 2
    ctx.strokeRect(x0 - 10, 0, totalW + 20, H)

    // 每軌
    for (let i = 0; i < 4; i++) {
      const cx = laneCenter(i)
      // 軌道導引線
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = HIGHWAY.laneW
      ctx.beginPath(); ctx.moveTo(cx, HIGHWAY.receptorY); ctx.lineTo(cx, H); ctx.stroke()
      // 接收圈
      const held = game.input && game.input.held[i]
      const flash = game.recvFlash[i] || 0
      this._tile(ctx, cx, HIGHWAY.receptorY, i, {
        receptor: true, alpha: 0.45 + flash * 0.55, scale: 1 + flash * 0.16, glow: flash, held,
      })
    }

    // 音符
    const now = game.songPos
    const scroll = game.scroll
    for (const n of game.chart.notes) {
      if (n.hit && n.anim <= 0) continue
      const dt = n.time - now
      const y = HIGHWAY.receptorY + dt * scroll
      if (y < -40 || y > H + 40) continue
      const cx = laneCenter(n.lane)
      if (n.hit) {
        // 命中後的爆光（往上飄散）
        this._tile(ctx, cx, HIGHWAY.receptorY - (1 - n.anim) * 30, n.lane, { alpha: n.anim * 0.8, scale: 1 + (1 - n.anim) * 0.5, pop: true })
      } else {
        this._tile(ctx, cx, y, n.lane, { alpha: 1, scale: 1 })
      }
    }
  }

  // 一個音符/接收圈磚塊（圓角方塊 + 白箭頭）
  _tile(ctx, cx, cy, lane, o) {
    const col = LANE_COLORS[lane]
    const sz = 34 * (o.scale || 1)
    ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha
    if (o.glow) { ctx.shadowColor = col; ctx.shadowBlur = 18 * o.glow }
    // 圓角方塊
    roundRect(ctx, -sz, -sz, sz * 2, sz * 2, 9)
    if (o.receptor && !o.held) {
      ctx.lineWidth = 3.5; ctx.strokeStyle = col; ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()
    } else {
      const g = ctx.createLinearGradient(0, -sz, 0, sz)
      g.addColorStop(0, lighten(col, 30)); g.addColorStop(1, col)
      ctx.fillStyle = g; ctx.fill()
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke()
    }
    // 箭頭
    ctx.shadowBlur = 0
    ctx.fillStyle = o.receptor && !o.held ? withAlpha(col, 0.8) : '#ffffff'
    this._arrow(ctx, LANE_DIR[lane], sz * 0.62)
    ctx.restore()
  }

  _arrow(ctx, dir, s) {
    ctx.save()
    const rot = { left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2, right: 0 }[dir]
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(s * 0.7, 0)
    ctx.lineTo(-s * 0.2, -s * 0.7)
    ctx.lineTo(-s * 0.2, -s * 0.28)
    ctx.lineTo(-s * 0.8, -s * 0.28)
    ctx.lineTo(-s * 0.8, s * 0.28)
    ctx.lineTo(-s * 0.2, s * 0.28)
    ctx.lineTo(-s * 0.2, s * 0.7)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  // ===================== HUD =====================
  _hud(game) {
    const ctx = this.ctx
    // 讚美條
    const bx = 28, by = 26, bw = 250, bh = 18
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(ctx, bx - 4, by - 4, bw + 8, bh + 8, 8); ctx.fill()
    const f = game.faith
    const col = f < FAITH.danger ? '#e0573f' : f < FAITH.warn ? '#e8a83f' : '#46c8a6'
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0)
    g.addColorStop(0, withAlpha(col, 0.7)); g.addColorStop(1, col)
    ctx.fillStyle = g; roundRect(ctx, bx, by, bw * f, bh, 6); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; roundRect(ctx, bx, by, bw, bh, 6); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('讚美', bx, by + bh + 16)
    if (f < FAITH.warn) { ctx.fillStyle = '#ffd0c0'; ctx.fillText('在患難中讚美！', bx + 44, by + bh + 16) }

    // 進度：讚美
    const px = W - 28
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 15px system-ui,sans-serif'
    ctx.fillText(`讚美 ${Math.round(game.progress * 100)}%`, px, 34)
    // 連擊
    if (game.combo >= 3) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'
      const pop = game.comboPop > 0 ? 1 + game.comboPop * 0.4 : 1
      ctx.font = `800 ${Math.round(30 * pop)}px system-ui,sans-serif`
      ctx.fillText(`${game.combo} 連`, W / 2, 60)
    }
    // 判定字
    if (game.judge && game.judgeAge < 0.5) {
      const a = 1 - game.judgeAge / 0.5
      ctx.textAlign = 'center'; ctx.globalAlpha = a
      ctx.font = '800 34px system-ui,sans-serif'
      ctx.fillStyle = game.judge.color
      ctx.fillText(game.judge.text, W / 2, 110 - a * 8)
      ctx.globalAlpha = 1
    }
  }

  // ===================== 各畫面 =====================
  _panel(x, y, w, h, a = 0.66) {
    const ctx = this.ctx
    ctx.fillStyle = `rgba(8,12,28,${a})`; roundRect(ctx, x, y, w, h, 18); ctx.fill()
    ctx.strokeStyle = 'rgba(150,190,255,0.25)'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 18); ctx.stroke()
  }
  _btn(b, hover) {
    const ctx = this.ctx
    ctx.fillStyle = hover ? 'rgba(70,200,166,0.95)' : 'rgba(70,200,166,0.78)'
    roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill()
    ctx.fillStyle = '#05281f'; ctx.font = '800 24px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2)
  }

  _title(game) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(4,6,15,0.45)'; ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'; ctx.font = '900 66px system-ui,sans-serif'
    ctx.shadowColor = 'rgba(120,180,255,0.6)'; ctx.shadowBlur = 18
    ctx.fillText('保羅西拉', W / 2, 150); ctx.shadowBlur = 0
    ctx.fillStyle = '#bcd0ff'; ctx.font = '600 24px system-ui,sans-serif'
    ctx.fillText('半夜監牢唱詩讚美 · 節奏闖關', W / 2, 200)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '500 17px system-ui,sans-serif'
    ctx.fillText('使徒行傳 16:25-34', W / 2, 232)
    ctx.fillStyle = '#fff'; ctx.font = '600 19px system-ui,sans-serif'
    ctx.fillText('用 ← ↓ ↑ → 或 D F J K 踩準每一拍', W / 2, 300)
    this._btn(game.buttons.start, game.hover === 'start')
    // 提示閃爍
    const a = 0.5 + 0.5 * Math.sin(game.time * 3)
    ctx.globalAlpha = a; ctx.fillStyle = '#cfe0ff'; ctx.font = '600 16px system-ui,sans-serif'
    ctx.fillText('（按 Enter 或點「開始讚美」開始）', W / 2, 470); ctx.globalAlpha = 1
  }

  _story(game) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(4,6,15,0.5)'; ctx.fillRect(0, 0, W, H)
    const lines = game.TITLE.story
    const i = Math.min(game.storyIndex, lines.length - 1)
    const line = lines[i]
    const last = i === lines.length - 1
    // 文字卡
    const pw = W - 200, px = 100, py = H / 2 - 70
    this._panel(px, py, pw, 140, 0.72)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = last ? '#ffe9b0' : '#fff'
    ctx.font = `${last ? '800 34' : '600 24'}px system-ui,sans-serif`
    wrapText(ctx, line, W / 2, H / 2 - (last ? 0 : 6), pw - 80, last ? 44 : 34)
    // 進度點
    const dotY = py + 140 + 26, n = lines.length
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = k === i ? '#9fe8cf' : 'rgba(255,255,255,0.3)'
      ctx.beginPath(); ctx.arc(W / 2 - (n - 1) * 9 + k * 18, dotY, 4, 0, 7); ctx.fill()
    }
    // 提示
    const a = 0.5 + 0.5 * Math.sin(game.time * 3)
    ctx.globalAlpha = a; ctx.fillStyle = '#cfe0ff'; ctx.font = '600 16px system-ui,sans-serif'
    ctx.fillText(last ? '輕點開始 ▸' : '輕點繼續 ▸', W / 2, py - 24); ctx.globalAlpha = 1
  }

  _mode(game) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(4,6,15,0.55)'; ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'; ctx.font = '800 34px system-ui,sans-serif'
    ctx.fillText('選擇難度', W / 2, 78)
    for (const key of ['walk', 'run']) {
      const b = game.buttons[key], m = game.MODES[key]
      const hov = game.hover === key
      this._panel(b.x, b.y, b.w, b.h, hov ? 0.85 : 0.66)
      ctx.fillStyle = '#fff'; ctx.font = '800 30px system-ui,sans-serif'
      ctx.fillText(`${m.icon}  ${m.name}`, b.x + b.w / 2, b.y + 46)
      ctx.fillStyle = '#bcd0ff'; ctx.font = '500 17px system-ui,sans-serif'
      wrapText(ctx, m.desc, b.x + b.w / 2, b.y + 84, b.w - 48, 24)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '500 15px system-ui,sans-serif'
    ctx.fillText('點一個難度開始（之後可隨時重玩）', W / 2, H - 30)
  }

  _countdown(game) {
    const ctx = this.ctx
    const n = game.countNum
    if (n == null) return
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const a = game.countFrac
    ctx.globalAlpha = 0.4 + a * 0.6
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(120 * (0.6 + a * 0.5))}px system-ui,sans-serif`
    ctx.shadowColor = 'rgba(120,180,255,0.6)'; ctx.shadowBlur = 20
    ctx.fillText(n > 0 ? String(n) : '走！', W / 2, H / 2)
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
    ctx.fillStyle = '#cfe0ff'; ctx.font = '600 22px system-ui,sans-serif'
    ctx.fillText(game.COUNT_HINT, W / 2, H / 2 + 90)
  }

  _rescueOverlay(game) {
    const ctx = this.ctx
    const p = game.rescuePhase   // 0..1
    ctx.fillStyle = `rgba(2,4,12,${0.55 - p * 0.35})`; ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (p < 0.5) {
      const a = 0.6 + 0.4 * Math.sin(game.time * 8)
      ctx.globalAlpha = a; ctx.fillStyle = '#ffd0c0'; ctx.font = '800 46px system-ui,sans-serif'
      ctx.fillText(game.SINK_CRY, W / 2, H / 2 - 10); ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = '#fff'; ctx.font = '700 26px system-ui,sans-serif'
      ctx.fillText(game.RESCUE.line, W / 2, H / 2 - 30)
      ctx.fillStyle = '#ffe9b0'; ctx.font = '800 30px system-ui,sans-serif'
      ctx.fillText(`「${game.RESCUE.word}」`, W / 2, H / 2 + 14)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '500 17px system-ui,sans-serif'
      ctx.fillText(game.RESCUE.ref, W / 2, H / 2 + 50)
    }
  }

  _win(game) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(4,6,15,0.62)'; ctx.fillRect(0, 0, W, H)
    const px = 110, pw = W - 220
    this._panel(px, 36, pw, H - 90, 0.82)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    // 星
    const stars = game.result.stars
    ctx.font = '40px system-ui,sans-serif'
    ctx.fillStyle = '#ffd86b'
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(3 - stars), W / 2, 54)
    ctx.fillStyle = '#9fe8cf'; ctx.font = '800 30px system-ui,sans-serif'
    ctx.fillText(game.WIN.head, W / 2, 112)
    ctx.fillStyle = '#fff'; ctx.font = '600 19px system-ui,sans-serif'
    wrapText(ctx, game.WIN.verse, W / 2, 152, pw - 90, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '500 15px system-ui,sans-serif'
    ctx.fillText(game.WIN.ref, W / 2, 214)
    // 反思
    ctx.fillStyle = '#ffe9b0'; ctx.font = '800 21px system-ui,sans-serif'
    ctx.fillText(game.WIN.reflect.head, W / 2, 250)
    ctx.fillStyle = 'rgba(230,238,255,0.92)'; ctx.font = '500 17px system-ui,sans-serif'
    let yy = 286
    for (const line of game.WIN.reflect.body.split('\n')) { ctx.fillText(line, W / 2, yy); yy += 26 }
    // 數據
    ctx.fillStyle = 'rgba(180,205,255,0.9)'; ctx.font = '600 16px system-ui,sans-serif'
    ctx.fillText(`命中率 ${Math.round(game.result.acc * 100)}%　最大連擊 ${game.result.maxCombo}　跌倒 ${game.result.stumbles} 次`, W / 2, yy + 8)
    // 重玩 / 再聽一次
    this._btn(game.buttons.again, game.hover === 'again')
    const b = game.buttons.listen, hov = game.hover === 'listen'
    ctx.fillStyle = hov ? 'rgba(74,166,232,0.95)' : 'rgba(74,166,232,0.78)'
    roundRect(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill()
    ctx.fillStyle = '#04263e'; ctx.font = '700 19px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2)
  }

  _muteBtn(game) {
    const ctx = this.ctx, b = game.buttons.mute
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(game.muted ? '🔇' : '🔊', b.x + b.w / 2, b.y + b.h / 2 + 1)
    ctx.restore()
  }
}

// ---- helpers ----
function laneCenter(i) { return HIGHWAY.x0 + i * (HIGHWAY.laneW + HIGHWAY.gap) + HIGHWAY.laneW / 2 }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function withAlpha(hex, a) { const c = hx(hex); return `rgba(${c.r},${c.g},${c.b},${a})` }
function lighten(hex, amt) { const c = hx(hex); return `rgb(${Math.min(255, c.r + amt)},${Math.min(255, c.g + amt)},${Math.min(255, c.b + amt)})` }
function hx(hex) { const n = parseInt(hex.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } }
function wrapText(ctx, text, cx, y, maxW, lh) {
  const chars = [...text]; let line = ''; let yy = y
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, cx, yy); line = ch; yy += lh }
    else line += ch
  }
  if (line) ctx.fillText(line, cx, yy)
  return yy
}

export const _laneCenter = laneCenter
