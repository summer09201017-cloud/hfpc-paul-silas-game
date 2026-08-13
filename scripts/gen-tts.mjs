// gen-tts.mjs —— 把「固定會唸的經文句」用 edge-tts(微軟曉臻神經語音,免費)預產成 mp3,
// 產出 tts/<key>.mp3 + tts/manifest.json;runtime 的 speak.js 會 mp3 優先、缺檔退回 Web Speech。
// 用法:  node scripts/gen-tts.mjs            # 讀 scripts/tts-verses.json(完整「最終唸出的字串」清單)
//
// 由來(2026-08-13):本站 speak.js 從 hfpc-paul-game 複製過來時**帶了「mp3 優先」的邏輯,
//   卻沒帶烤製這一步** ⇒ tts/manifest.json 從上線起就是 404 ⇒ 每次朗讀都靜靜退回 Web Speech
//   機器聲(使用者 0730 明令禁止的那種)。零錯誤、零紅燈,只有真的按下朗讀鍵的人才聽得出來。
//
// ★ key 用 src/ttsFix.js 的 ttsKey(去空白後 FNV-1a),和 runtime 完全同一套——字串差一個字就對不上。
// ★ 需要網路(打微軟端點);devDependency msedge-tts。產出的 mp3 進 git(零後端、離線可用)。
// ★ 餵給 edge-tts 的文字同樣先過 toSpeakable 破音字典(雙句號收斂成單句號,不影響 key)。
//
// ⚠ 本站沒有 public/:`scripts/bundle-static.mjs` 只複製 ROOT_FILES + src/*.js。
//   所以輸出目錄是**repo 根的 tts/**,而且 bundle-static 已加一段把 tts/ 複製進 site/。
//   ★★ 別把輸出改成 public/tts —— 那樣檔案會進版控卻**永遠進不了部署產物**
//      (2026-08-13 大廳的兩支 90 秒影片正是這樣 404 了九天)。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import { toSpeakable, ttsKey } from '../src/ttsFix.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'tts')
mkdirSync(OUT, { recursive: true })

// ⚠⚠ 逐層刪,**不可以用 rmSync({recursive:true})**——本機 Windows + Node 24 上遞迴版會
//   「無聲被砍」:整個 node 行程當場消失,exit 127、stdout 一個字都沒有,看起來像腳本壞了。
//   (這條 scripts/bundle-static.mjs 第 2 行早就寫著,我 0813 還是踩了一次才想起來
//    —— 知識寫在別的檔案的註解裡 = 沒有人會再看到它。)
{
  const { readdirSync, rmSync: rmFile, rmdirSync, statSync: st } = await import('node:fs')
  let swept = 0
  try {
    for (const n of readdirSync(OUT)) {
      if (!n.startsWith('_tmp_')) continue
      const d = join(OUT, n)
      try {
        for (const f of readdirSync(d)) rmFile(join(d, f))   // 暫存夾只有一層,不需遞迴
        if (st(d).isDirectory()) rmdirSync(d)
        swept++
      } catch { /* 這一個刪不掉就跳過,別讓清理擋住烤製 */ }
    }
  } catch { /* 目錄還不存在 */ }
  if (swept) console.log(`  🧹 掃掉 ${swept} 個上一輪殘留的暫存夾`)
}

const list = JSON.parse(readFileSync(join(root, 'scripts', 'tts-verses.json'), 'utf8'))
const manifestPath = join(OUT, 'manifest.json')
let manifest = {}
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) } catch { /* 第一次 */ }

const VOICE = 'zh-TW-HsiaoChenNeural' // 曉臻(女聲,唸經文柔和);男聲可換 zh-TW-YunJheNeural

const { renameSync, rmSync, statSync, readdirSync: readdirSync2, rmdirSync: rmdirSync2 } = await import('node:fs')
const saveManifest = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n', 'utf8')

let made = 0, skipped = 0, failed = 0
for (const entry of list) {
  const full = typeof entry === 'string' ? entry : entry.text
  const key = ttsKey(full)
  const file = `${key}.mp3`
  const fp = join(OUT, file)
  if (existsSync(fp)) { manifest[key] = `tts/${file}`; saveManifest(); skipped++; continue }
  const speech = toSpeakable(full).replace(/。+/g, '。')
  const tmpDir = join(OUT, `_tmp_${key}`)
  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    mkdirSync(tmpDir, { recursive: true })
    const { audioFilePath } = await tts.toFile(tmpDir, speech)
    renameSync(audioFilePath, fp)
    try { tts.close && tts.close() } catch { /* socket 已關 */ }
    const kb = (statSync(fp).size / 1024).toFixed(0)
    manifest[key] = `tts/${file}`
    saveManifest() // 逐句落盤:中途死也不丟已完成的
    made++
    console.log(`  ✓ ${file}(${kb}KB)← ${full.slice(0, 24)}…`)
  } catch (e) {
    failed++
    console.error(`  ✗ ${full.slice(0, 24)}… → ${e && e.message}`)
  } finally {
    // ⚠⚠ 0813:這裡原本是 rmSync(tmpDir,{recursive:true}) —— 就是它在 Windows+Node 24 上
    //   「無聲砍掉整個 node 行程」,而不是 msedge-tts 的錯。長年被記成「一次烤一句 node 就死
    //   (exit 127)」的那個現象,真兇是這一行。改逐層刪之後可以一口氣烤完整批。
    try {
      for (const f of readdirSync2(tmpDir)) rmSync(join(tmpDir, f))
      rmdirSync2(tmpDir)
    } catch { /* noop */ }
  }
}
const summary = (`✓ gen-tts:新產 ${made}、已存在 ${skipped}、失敗 ${failed};manifest 共 ${Object.keys(manifest).length} 句 → tts/`)
// ⚠⚠ 0813 實測踩到的坑,寫清楚免得下一手改壞:
//   原本是直接 `console.log(summary); process.exit(...)`。當**每一句都已存在**(第二次以後重跑)時,
//   整支腳本瞬間跑完,而 stdout 接的是管線(pipe)時 console.log 是**非同步**的
//   ⇒ process.exit() 會把還沒送出去的那行**整行截斷** ⇒ 畫面上什麼都沒有、離開碼還是 127。
//   ★ 後果很嚴重:這支腳本的**完成訊號就是「新產 0」那行字**(離開碼在這台機器不可信),
//     訊號被吞掉 = 看起來像「烤失敗了」,而其實六句全都好好的。
//   ⇒ 改成:把 summary 交給 write 的 callback,**確定送出去了才結束**;
//     而且只有真的開過 WebSocket(made>0)才需要強制 exit,否則讓 node 自然結束。
//   (同族:守門 #36 exit-after-fetch-guard——fetch/socket 之後 process.exit 會亂。)
process.exitCode = failed ? 1 : 0
process.stdout.write(summary + '\n', () => {
  if (made > 0) process.exit(failed ? 1 : 0) // WebSocket 不會自己關,只有這種情況要強制收尾
})
