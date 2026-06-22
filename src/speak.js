// speak.js —— 經文朗讀(瀏覽器內建 speechSynthesis,零音檔、離線可用、免費)。
// 能用就用,不能用就「安靜略過」——絕不報錯、不卡關。心法見 skill web-speech-scripture。
// 系列預設:每一關過關/失敗都自動朗讀經文 +「經文出處」(經文出自…第幾章第幾節)。沒中文語音→靜默 fallback。
let voicesReady = false

function pickZh() {
  const vs = speechSynthesis.getVoices()
  return (
    vs.find((v) => /zh[-_]TW/i.test(v.lang)) ||
    vs.find((v) => /^zh/i.test(v.lang)) ||
    null
  )
}

// 把 ref(如「士師記 14:5-6」「約拿書 1:17–2:10」)轉成口語出處「經文出自士師記第14章第5到6節」。
// 解析不出來就退回「經文出自<原字串>」。跨書/跨章(1:17–2:10)只讀起點章節 + 「等」。
export function spokenRef(ref) {
  if (!ref) return ''
  const s = String(ref).trim()
  // 書名 章:節[-節] 或 章:節–章:節
  const m = s.match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)(?:\s*[-–—~]\s*(\d+)(?:\s*[:：]\s*(\d+))?)?/)
  if (!m) return '經文出自' + s.replace(/\s+/g, '')
  const book = m[1].replace(/\s+/g, '')
  const ch = m[2], v1 = m[3], v2 = m[4], v2ch = m[5]
  if (v2 && v2ch) return `經文出自${book}第${ch}章第${v1}節等` // 跨章(如 1:17–2:10)
  return `經文出自${book}第${ch}章第${v1}${v2 ? '到' + v2 : ''}節`
}

export function initSpeech() {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => {
    voicesReady = true
  }
}

// opts.ref 有給就在經文後面接「經文出處」一起朗讀。
export function speakScripture(text, { isMuted = () => false, rate = 0.92, pitch = 1, ref = '' } = {}) {
  if (!('speechSynthesis' in window) || !text) return false
  if (isMuted()) return false
  try {
    speechSynthesis.cancel()
    const full = ref ? `${text}。${spokenRef(ref)}` : String(text)
    const u = new SpeechSynthesisUtterance(full.replace(/\s+/g, ''))
    const v = pickZh()
    if (!v) return false
    u.voice = v
    u.lang = v.lang
    u.rate = rate
    u.pitch = pitch
    speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
