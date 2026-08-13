// verify-tts.mjs —— 驗「遊戲執行時真的會播到 mp3」,不是只驗「檔案在」。
//
// ★ 為什麼需要這支:mp3 有、manifest 有、檔案 200,**但只要 ttsKey 對不上就照樣播機器聲**,
//   而且完全沒有錯誤訊息 —— 這正是本站 0813 之前的病(檔案根本沒烤)的近親。
//   所以這裡不看檔案在不在,而是**重跑 runtime 那條路**:
//     ① 用 content.js 的真資料 + speak.js 的真 spokenRef 組出「實際會唸的字串」
//     ② 用 ttsFix.js 的真 ttsKey 算 key(和 runtime 同一支函式)
//     ③ 去 tts/manifest.json 查得到,且對應的 mp3 真的在磁碟上、不是 0 byte
//
// 用法:node scripts/verify-tts.mjs   (exit 0=全綠;非 0=有句子會退回機器聲)
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const imp = (p) => import(pathToFileURL(join(root, p)).href)

const { spokenRef } = await imp('src/speak.js')
const { ttsKey } = await imp('src/ttsFix.js')
const C = await imp('src/content.js')

// ⚠ 這兩條必須跟 src/game.js 的 call site 一字不差(speak.js:127 的 full 組法):
//   game.js:202  speakScripture(RESCUE.word, { ref: RESCUE.ref })   → `${text}。${spokenRef(ref)}`
//   game.js:248/330  speakScripture(`${WIN.head}。${WIN.verse}。${WIN.refSpoken||''}`)  → 無 ref,原樣
const expected = [
  { where: 'game.js:202 救援金句', full: `${C.RESCUE.word}。${spokenRef(C.RESCUE.ref)}` },
  { where: 'game.js:248/330 過關經文', full: `${C.WIN.head}。${C.WIN.verse}。${C.WIN.refSpoken || ''}` },
]

// ⚠ 讀不到 manifest 要「判紅」而不是「拋例外」——0813 之前本站正是這個狀態(檔案根本不存在),
//   拋例外會讓人以為是腳本壞了;它其實是本站當時最該被抓到的那個紅燈。
let manifest
try {
  manifest = JSON.parse(readFileSync(join(root, 'tts', 'manifest.json'), 'utf8'))
} catch {
  console.error('  ✗ tts/manifest.json 讀不到或不是合法 JSON ⇒ 全部句子都會退回機器聲(這正是 0813 修掉的那個狀態)')
  console.error('✗ verify-tts:未烤製,請跑 node scripts/gen-tts.mjs 直到印「新產 0」')
  process.exitCode = 1
  manifest = null
}
if (manifest === null) process.exit(1)
let bad = 0
for (const { where, full } of expected) {
  const key = ttsKey(full)
  const rel = manifest[key]
  if (!rel) { console.error(`  ✗ ${where}:manifest 沒有 key ${key} ⇒ 會退回機器聲`); bad++; continue }
  const fp = join(root, rel)
  if (!existsSync(fp)) { console.error(`  ✗ ${where}:manifest 指到 ${rel} 但檔案不在 ⇒ 會退回機器聲`); bad++; continue }
  const kb = statSync(fp).size / 1024
  if (kb < 5) { console.error(`  ✗ ${where}:${rel} 只有 ${kb.toFixed(1)}KB,疑似烤壞`); bad++; continue }
  console.log(`  ✓ ${where}:${key} → ${rel}(${kb.toFixed(0)}KB)`)
}

// 孤兒檢查:manifest 裡有、但沒有任何 call site 會唸到的 key(gen-tts 的 manifest 是累加式)
const wanted = new Set(expected.map((e) => ttsKey(e.full)))
const orphans = Object.keys(manifest).filter((k) => !wanted.has(k))
if (orphans.length) console.error(`  ⚠ 孤兒 ${orphans.length} 支(manifest 有、沒人唸):${orphans.join(', ')}`)

console.log(bad ? `✗ verify-tts:${bad} 句會退回機器聲` : `✓ verify-tts:${expected.length} 句全部對得到 mp3、孤兒 ${orphans.length}`)
process.exitCode = bad ? 1 : 0
