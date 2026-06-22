# CLAUDE.md — 保羅西拉（給 AI 接手的專案指南）

> 給「另一台 PC 的 AI」：這是一個**已可玩、已上 GitHub**的獨立小遊戲。先讀本檔與 `roadmap.md`，
> 再動手。**改手感只動 `src/config.js`、改譜只動 `src/chart.js`、改文案只動 `src/content.js`。**

## 一句話
**保羅西拉 · 在患難中讚美**——馬太福音 14:22-33 的節奏音樂闖關（玩法類似《周五放課夜 / FNF》）。
純 vanilla ES modules + Canvas、零相依、Web Audio 即時合成音樂、可離線（PWA）、可嵌入。
作者是台灣牧師（HFPC），主日學用；預設繁體中文 + 和合本經文。

## 現況（2026-06-21）— 已完成 vs 待做
**✅ 已完成（可玩、別重做）**：四箭頭節奏核心（鍵盤 ←↓↑→/DFJK + 觸控）、讚美條、命中判定
（完美/好/差/miss）、連擊、下沉→「主啊救我」→耶穌伸手拉住（太14:31）溫柔救援、過關結算（★星等）、
兩難度（🚶漫步永不沉 / 🏃闖關會沉有救援）、開場四幕故事、命中水花、過關經文語音朗讀、
Web Audio 合成節拍音樂+風聲、PWA 離線、雙擊 `玩遊戲.bat` 啟動、`npm test` 煙霧測試、已上 GitHub、
**已部署 Netlify（<https://hfpc-paul-silas-game.netlify.app>）並在大廳 `hfpc-bible-games` 點亮卡片（2026-06-21）**。
**🔜 待做**：見 `roadmap.md`（已按 CP 值 × 開發時間排序）。下一順位＝PWA 安裝鈕 / 接進保羅大富翁 / call-and-response。

## 玩法核心 = 信息
**在患難中讚美 = 踩準節拍。** 音符順拍落到命中線，踩準→彼得穩穩行在水面；漏拍（疑惑、低頭看風浪）
→「讚美」條下降→開始下沉。讚美歸零（闖關模式）→ 彼得喊「主啊救我」→ 耶穌伸手拉住、溫柔托起續關
（**不是冷酷 Game Over**，合系列「神給第二次機會」調性）。過關＝抵達耶穌＝「風就住了…你真是神的兒子了」(太14:33)。

## ★ 三個會生死攸關的同步陷阱（節奏遊戲成敗就在這）
1. **判定用音訊時鐘，不是 rAF**：`songPos = audio.now() - songStart`；音符位置 `= receptorY + (note.time - songPos)*scroll`。rAF 會漂、會被分頁節流。
2. **譜面 ⇄ 音樂共用 BPM + 起拍時間**：Web Audio 向前看排程器給已知拍格，音符 `time = 拍數×每拍秒數` → 鼓點上落音符、零音檔延遲。
3. **暫停 = `ctx.suspend()/resume()`**：凍結音訊時鐘，救援後完美接回，不要自己另開一條可暫停的時鐘（會和仍在跑的音樂漸漸對不上）。
（完整心法見跨專案 skill **`rhythm-beat-minigame`**。）

## 一檔一責（`src/`）
| 檔 | 責任 |
|---|---|
| `game.js` | 主迴圈（固定步長）+ 狀態機 `title→story→mode→count→play⇄sink→win` + 節奏判定 + 讚美/救援 + 結算 |
| `config.js` | ★ 所有可調數值：`DIFF.{walk,run}`(bpm/scroll/判定窗/faithStart/gain/missPenalty/floor/canSink)、HIGHWAY 幾何、LANE_KEYS、COUNT/LEAD_BEATS |
| `chart.js` | 譜面：把步格圖樣字串（`'0'..'3'`=軌、`'-'`=休止）展開成有時間戳的音符；WALK 四分格、RUN 八分格 |
| `input.js` | 原始輸入（鍵盤軌道 + 觸控，**帶音訊時間戳**），不懂規則；`attach(clock)/detach()` |
| `audio.js` | Web Audio 合成：節拍音樂（lookahead 排程器）+ 命中/漏拍音效 + 隨讚美起伏的風聲 + `suspend()/resume()` |
| `renderer.js` | 只讀狀態繪製：夜海/閃電/彼得行與沉/耶穌伸手/「光的橋」音符高速公路/水花/HUD/各畫面 |
| `content.js` | 經文/文案/反思（和合本逐字）——非程式者可只改這個檔 |
| `speak.js` | 經文語音朗讀（speechSynthesis，zh-TW，沒語音時靜默 fallback，跟靜音鈕走） |

外殼：`index.html` / `main.js`（暴露 `window.__game` 供 Playwright 驗收）/ `styles.css` / `manifest.webmanifest` / `sw.js`。

## 跑 / 測 / 建置
- **玩**：雙擊 `玩遊戲.bat`（或 `node scripts/serve.mjs`，自動選埠+開瀏覽器）。
- **測**：`npm test`（`scripts/smoke-test.mjs`：語法+譜面+難度窗+經文文案）。
- **建置離線版**：`npm run build` → `site/`（逐檔複製，Node 24 安全）。

## 本機地雷（重要）
- **這台 Windows + Node 24**：獨立小遊戲**別用 `vite build`**（遞迴 cpSync/rmSync 會無聲被殺）→ 用 `scripts/bundle-static.mjs`。
- **`.bat` 必須純 ASCII + CRLF**（中文會亂碼、LF 會讓 cmd 解析 goto 閃退）；中文路徑用 `"%~dp0."` 避開尾端反斜線+引號的解析 bug。
- **Service Worker 在 localhost 自動註銷**（改了碼才看得到）；正式環境才註冊。
- **Playwright 驗收的節流陷阱**：分頁失焦時 setInterval/rAF 被節流，「自動完美玩家」會假性漏拍→沉沒——**不是 bug**。驗 win 用 walk 模式或直接 `window.__game._win()`。

## 經文出處
馬太福音 14:22-33（和合本 1919，public domain），已用本地 `cuv` MCP 逐字核對。改經文前**務必再查一次**（見 skill `cuv-scripture-mcp`），牧者審核通過前不上線（skill `pastor-review`）。

## 相關跨專案 skill
`rhythm-beat-minigame`（本遊戲的藍圖）、`arcade-game-kit`、`procedural-bgm`、`reverse-rpg-design`、
`embed-minigame`、`web-speech-scripture`、`ship-game-online`、`classroom-game-deploy`。一鍵裝齊見 `hfpc-claude-skills` repo。
