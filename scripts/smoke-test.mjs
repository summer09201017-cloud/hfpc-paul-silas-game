// scripts/smoke-test.mjs — 上課/上線前煙霧測試（零相依，Node 24）。
// 抓「會讓孩子在課堂上撞到」的錯：語法壞、譜面軌道越界/沒結尾、難度窗順序錯、經文文案缺。
// 通過 → exit 0；任何一項失敗 → exit 1（給 pre-push hook / ship-check 用）。
import { execSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let fails = 0
const ok = (m) => console.log('  ✓ ' + m)
const bad = (m) => { console.error('  ✗ ' + m); fails++ }

// 1) 每個 src/*.js 語法
let synErr = 0
for (const f of readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js'))) {
  try { execSync(`node --check "${join(root, 'src', f)}"`, { stdio: 'pipe' }) }
  catch (e) { bad(`語法錯誤 src/${f}: ${String(e.stderr || e).split('\n')[0]}`); synErr++ }
}
if (!synErr) ok('src/*.js 語法全過')

// 2) 譜面（chart）—— 與音樂同 BPM、軌道 0..3、有結尾、時間遞增
const { makeChart } = await import('../src/chart.js')
for (const mode of ['walk', 'run']) {
  const bpm = mode === 'walk' ? 84 : 108
  const c = makeChart(mode, bpm)
  let e = 0
  if (!c.notes.length) { bad(`${mode} 譜面沒有音符`); e++ }
  const off = c.notes.find((n) => !(n.lane >= 0 && n.lane <= 3))
  if (off) { bad(`${mode} 音符軌道越界: lane=${off.lane}`); e++ }
  const last = c.notes[c.notes.length - 1]
  if (last && !(c.endTime > last.time)) { bad(`${mode} endTime(${c.endTime}) 未超過最後音符`); e++ }
  let prev = -1, unsorted = false
  for (const n of c.notes) { if (n.time < prev - 1e-9) unsorted = true; prev = n.time }
  if (unsorted) { bad(`${mode} 音符時間未遞增`); e++ }
  if (!e) ok(`${mode} 譜面 OK（${c.notes.length} 音符 / ${c.endTime.toFixed(1)}s）`)
}

// 3) 難度設定 —— 判定窗 perfect<good<bad、bpm/scroll 正、faithStart 合理
const { DIFF } = await import('../src/config.js')
for (const mode of ['walk', 'run']) {
  const d = DIFF[mode]
  if (!d) { bad(`config.DIFF.${mode} 不存在`); continue }
  const w = d.win
  let e = 0
  if (!(w.perfect > 0 && w.perfect < w.good && w.good < w.bad)) { bad(`${mode} 判定窗順序不對`); e++ }
  if (!(d.bpm > 0 && d.scroll > 0)) { bad(`${mode} bpm/scroll 非正`); e++ }
  if (!(d.faithStart > 0 && d.faithStart <= 1)) { bad(`${mode} faithStart 越界`); e++ }
  if (!e) ok(`config.DIFF.${mode} 數值合理`)
}

// 4) 內容（經文/文案）—— 過關經文、開場故事、救援經文都在
const C = await import('../src/content.js')
if (!C.WIN || !C.WIN.verse || !C.WIN.verse.includes('「')) bad('WIN.verse 缺失或非經文')
else ok('WIN.verse 在')
if (!Array.isArray(C.TITLE?.story) || !C.TITLE.story.length) bad('TITLE.story 缺失')
else ok(`TITLE.story 在（${C.TITLE.story.length} 句）`)
if (!C.RESCUE?.word) bad('RESCUE.word 缺失')
else ok('RESCUE.word 在')

console.log('')
if (fails) { console.error(`✗ 煙霧測試失敗：${fails} 項`); process.exit(1) }
console.log('✓ 煙霧測試全過')
