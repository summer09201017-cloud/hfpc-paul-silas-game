// speak.js —— 經文朗讀(瀏覽器內建 speechSynthesis,零音檔、離線可用、免費)。
// 能用就用,不能用就「安靜略過」——絕不報錯、不卡關。心法見 skill web-speech-scripture。
// 系列預設:每一關過關/失敗都自動朗讀經文 +「經文出處」(經文出自…第幾章第幾節)。沒中文語音→靜默 fallback。
// 2026-07-04 朗讀三層改進(對外 API 不變):
//   ① 預錄 mp3 優先:public/tts/manifest.json 有這句(edge-tts 曉臻神經語音預產,scripts/gen-tts.mjs)就播 mp3;
//     沒有/載入失敗 → 自動退回 Web Speech(嵌入契約與離線性不變,mp3 已入 PWA precache)。
//   ② Web Speech 路徑升級:破音字同音替換(toSpeakable,只影響唸、不動畫面)+ 斷句抑揚(chunkClauses,
//     問句尾音升/感嘆稍強/末句放慢)+ 選聲排序(pickZhVoice:Edge Natural > Google 國語 > 傳統 SAPI)。
//   共用邏輯在 src/ttsFix.js(正本:skills 合輯 web-speech-scripture/assets/tts-fix.js)。
import { toSpeakable, chunkClauses, pickZhVoice, numToZh, ttsKey } from './ttsFix.js'

let _queue = []      // [{ text, pitch, rate }] 逐短句佇列
let _speaking = false
let _audio = null    // 進行中的 mp3
let _manifest = null // { "<ttsKey>": "tts/xxxx.mp3" };null=還沒載,false=載入失敗
let _manifestLoading = false

function pickZh() {
  return pickZhVoice(speechSynthesis.getVoices())
}

// 把 ref(如「士師記 14:5-6」「約拿書 1:17–2:10」)轉成口語出處「經文出自士師記第十四章第五到六節」。
// 解析不出來就退回「經文出自<原字串>」。跨書/跨章(1:17–2:10)只讀起點章節 + 「等」。數字轉國字防引擎亂斷。
export function spokenRef(ref) {
  if (!ref) return ''
  const s = String(ref).trim()
  const m = s.match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)(?:\s*[-–—~]\s*(\d+)(?:\s*[:：]\s*(\d+))?)?/)
  if (!m) return '經文出自' + s.replace(/\s+/g, '')
  const book = m[1].replace(/\s+/g, '')
  const ch = numToZh(m[2]), v1 = numToZh(m[3]), v2 = m[4] ? numToZh(m[4]) : '', v2ch = m[5]
  if (m[4] && v2ch) return `經文出自${book}第${ch}章第${v1}節等` // 跨章(如 1:17–2:10)
  return `經文出自${book}第${ch}章第${v1}${v2 ? '到' + v2 : ''}節`
}

export function initSpeech() {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => {}
  _loadManifest()
}

function _loadManifest() {
  if (_manifest !== null || _manifestLoading) return
  _manifestLoading = true
  fetch('tts/manifest.json')
    .then((r) => (r.ok ? r.json() : false))
    .then((j) => { _manifest = j || false })
    .catch(() => { _manifest = false })
    .finally(() => { _manifestLoading = false })
}

function _stopAll() {
  _queue = []
  _speaking = false
  if (_audio) { try { _audio.pause() } catch { /* noop */ } _audio = null }
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel() } catch { /* noop */ } }
}

function _speakNext() {
  if (!_speaking || !_queue.length) { _speaking = false; return }
  const item = _queue.shift()
  let u
  try { u = new SpeechSynthesisUtterance(item.text.replace(/\s+/g, '')) } catch { _speaking = false; return }
  const v = pickZh()
  if (!v) { _speaking = false; return }
  u.voice = v
  u.lang = v.lang
  u.rate = item.rate
  u.pitch = item.pitch
  u.onend = () => { if (_speaking) _speakNext() }
  u.onerror = () => { if (_speaking) _speakNext() }
  try { speechSynthesis.speak(u) } catch { _speaking = false }
}

// 以 Web Speech 唸整段(破音字替換 + 斷句抑揚)
function _speakWeb(full, rate, pitch) {
  if (!('speechSynthesis' in window)) return false
  if (!pickZh()) return false
  _queue = chunkClauses(toSpeakable(full), { rate, pitch })
  if (!_queue.length) return false
  _speaking = true
  _speakNext()
  return true
}

// mp3 優先;失敗自動退回 Web Speech(onerror 時 fallback)
function _speakSmart(full, rate, pitch) {
  _stopAll()
  const key = ttsKey(full)
  const hit = _manifest && _manifest[key]
  if (hit) {
    try {
      _audio = new Audio(hit)
      _audio.onerror = () => { _audio = null; _speakWeb(full, rate, pitch) }
      const p = _audio.play()
      if (p && p.catch) p.catch(() => { _audio = null; _speakWeb(full, rate, pitch) })
      return true
    } catch { _audio = null }
  }
  return _speakWeb(full, rate, pitch)
}

// opts.ref 有給就在經文後面接「經文出處」一起朗讀。
export function speakScripture(text, { isMuted = () => false, rate = 0.92, pitch = 1, ref = '' } = {}) {
  if (!text) return false
  if (isMuted()) return false
  if (!('speechSynthesis' in window) && !(_manifest && Object.keys(_manifest).length)) return false
  try {
    _loadManifest()
    const full = ref ? `${text}。${spokenRef(ref)}` : String(text)
    return _speakSmart(full, rate, pitch)
  } catch {
    return false
  }
}

// 朗讀一般文字(非經文)——給「語音玩法簡介」用(回應兒主老師:不識字的幼兒聽得懂怎麼玩)。
// 同樣零音檔、離線、免費;沒中文語音→靜默 fallback(回 false,不報錯不卡關)。可被 🔊 鈕重複呼叫。
export function speakText(text, { isMuted = () => false, rate = 0.95, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window) || !text) return false
  if (isMuted()) return false
  try {
    _stopAll()
    return _speakWeb(String(text), rate, pitch)
  } catch {
    return false
  }
}

export function stopSpeech() {
  _stopAll()
}
