// speak.js — 經文朗讀。能用就用，不能用就安靜略過（給還不識字的孩子）。
// 守則：能力偵測 + 靜默 fallback、跟靜音鈕走、一次一段可中斷、voices 非同步預熱。

function pickZh() {
  const vs = speechSynthesis.getVoices()
  return vs.find(v => /zh[-_]TW/i.test(v.lang))
    || vs.find(v => /^zh/i.test(v.lang))
    || null
}

export function initSpeech() {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => { /* 預熱清單 */ }
}

export function speakScripture(text, { isMuted = () => false, rate = 0.9, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window) || !text) return false
  if (isMuted()) return false
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ''))
    const v = pickZh()
    if (!v) return false
    u.voice = v; u.lang = v.lang; u.rate = rate; u.pitch = pitch
    speechSynthesis.speak(u)
    return true
  } catch { return false }
}

export function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
