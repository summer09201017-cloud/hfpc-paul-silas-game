// ttsFix.js —— 經文朗讀三件套:①破音字同音替換 ②斷句抑揚 ③中文語音排序。
// 正本(心法+維護說明)在 skills 合輯 web-speech-scripture/assets/tts-fix.js;兩邊改動要互相同步。
// ★ 鐵則:替換只影響「唸給引擎聽的字串」,絕不影響畫面顯示的經文。

// ① 破音字典(鍵=畫面上的詞,值=唸的字;同音正確字,引擎本來唸對時聽感中性,唸錯時被修正)
export const TTS_PHRASES = [
  ['使徒行傳', '使徒行撰'],
  ['行傳', '行撰'],
  ['便雅憫', '變雅憫'],
  ['重生', '崇生'],
  ['重新', '崇新'],
  ['供物', '貢物'],
  ['供奉', '貢奉'],
  ['數算', '屬算'],
  ['數點', '屬點'],
  ['差遣', '拆遣'],
  ['奉差', '奉拆'],
  ['尼布甲尼撒', '尼布甲尼灑'],
  ['曝曬', '瀑曬'],
].sort((a, b) => b[0].length - a[0].length)

export function toSpeakable(text) {
  let s = String(text || '')
  for (const [from, to] of TTS_PHRASES) s = s.split(from).join(to)
  return s
}

// 章節數字轉國字(「第14章」→「第十四章」)
export function numToZh(n) {
  n = Number(n)
  if (!Number.isFinite(n) || n < 0 || n > 999) return String(n)
  const D = '零一二三四五六七八九'
  if (n < 10) return D[n]
  if (n < 20) return '十' + (n % 10 ? D[n % 10] : '')
  if (n < 100) return D[Math.floor(n / 10)] + '十' + (n % 10 ? D[n % 10] : '')
  const rem = n % 100
  return D[Math.floor(n / 100)] + '百' + (rem === 0 ? '' : rem < 10 ? '零' + D[rem] : rem < 20 ? '一' + numToZh(rem) : numToZh(rem))
}

// ② 斷句抑揚:主要標點切短句,問句尾音升、感嘆稍強、末句放慢收尾(逐句 speak 天然停頓)
export function chunkClauses(text, { rate = 0.92, pitch = 1 } = {}) {
  const s = String(text || '').trim()
  if (!s) return []
  const parts = s.match(/[^。！？；!?;]+[。！？；!?;]?/g) || [s]
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i].trim()
    if (!t) continue
    const last = i === parts.length - 1
    let p = pitch, r = rate
    if (/[？?]$/.test(t)) p = pitch + 0.1
    else if (/[！!]$/.test(t)) { p = pitch + 0.06; r = rate + 0.03 }
    if (last) r -= 0.05
    out.push({ text: t, pitch: Math.min(2, p), rate: Math.max(0.5, r) })
  }
  return out
}

// ③ 中文語音排序:Edge Natural 神經語音 > Google 國語 > 傳統 SAPI;zh-TW 優先
export function scoreZhVoice(v) {
  let s = 0
  const lang = String(v.lang || ''), name = String(v.name || '')
  if (/zh[-_]TW/i.test(lang)) s += 100
  else if (/zh[-_]HK/i.test(lang)) s += 60
  else if (/^zh/i.test(lang)) s += 40
  else return -1
  if (/natural|neural/i.test(name)) s += 50
  if (/曉|Hsiao|Xiao/i.test(name)) s += 20
  if (/雲|Yun/i.test(name)) s += 10
  if (/google/i.test(name)) s += 25
  return s
}
export function pickZhVoice(voices) {
  const ranked = (voices || [])
    .map((v) => ({ v, s: scoreZhVoice(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
  return ranked.length ? ranked[0].v : null
}

// 預產 mp3 用的字串正規化 + 雜湊(FNV-1a,瀏覽器/node 同步可算,不需 crypto)
// key 對「最終唸出的完整字串」計(先去空白;不先過破音字典——字典是引擎端補救,mp3 端由產生器自己套)
export function ttsKey(text) {
  const s = String(text || '').replace(/\s+/g, '')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
