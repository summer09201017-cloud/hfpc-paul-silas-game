# 保羅西拉 · 在患難中讚美

馬太福音 14:22-33 的**節奏音樂闖關**（玩法類似《周五放課夜 / Friday Night Funkin'》）。
純 vanilla Canvas + ES modules、零執行期相依、Web Audio 即時合成音樂、可離線（PWA）、可嵌入。

> **狀態（2026-06-21）**：✅ 上線可玩！**線上玩**：<https://hfpc-paul-silas-game.netlify.app>（已在總入口大廳點亮卡片）。
> **待做**見 [`roadmap.md`](roadmap.md)（下一步＝PWA 安裝鈕 / 接進保羅大富翁）。
> GitHub：<https://github.com/summer09201017-cloud/hfpc-paul-silas-game> ｜ AI 接手指南：[`CLAUDE.md`](CLAUDE.md) ｜ 交接說明：`讀我-HANDOFF.txt`

## 玩法 = 信息

> **在患難中讚美 = 踩準節拍。**
> 四個箭頭音符（← ↓ ↑ →）順著節拍落到命中線，踩準了，彼得就穩穩走在水面；
> 漏拍代表「疑惑、低頭看風浪」——「讚美」條下降，彼得開始下沉。

- 🏃 **闖關 · 起風**：拍子快、判定嚴。讚美歸零會沉下去 →
  彼得喊「主啊，救我！」→ **耶穌趕緊伸手拉住他（太 14:31）** → 溫柔托起、繼續走。
  **沒有冷酷的 Game Over**——人人都會抵達耶穌，星數反映踩得多準。
- 🚶 **漫步 · 慢板**：慢、寬、永不沉沒，給小小孩或先安心走一遍。

抵達耶穌（一曲走完）→「他們上了船，風就住了…你真是　神的兒子了」（太 14:33）+ 反思。

## 操作

- 鍵盤：`← ↓ ↑ →` 或 `D F J K`
- 觸控：直接點四條軌道
- `Enter` / 點畫面開始；右下/左下角 🔊 可靜音

## 跑起來

**最簡單：雙擊 `玩遊戲.bat`** —— 會自動開伺服器、開瀏覽器。保持那個黑色視窗開著，玩完關掉它即可。
（需要電腦裝了 [Node.js](https://nodejs.org)；批次檔會自動偵測，沒裝會提示。）

其他方式（純靜態網站，沒有 build 也能跑）：

```bash
node scripts/serve.mjs      # 同 .bat 做的事（零相依、自動選埠、自動開瀏覽器）
# 或任一靜態伺服器：npx serve .
```

開發時在 localhost 會自動註銷 Service Worker（改了碼才看得到）。

## 上線 / 離線（教室用）

```bash
npm run build      # 把可離線靜態檔輸出到 site/（Node 24 安全：逐檔複製，不用遞迴 cpSync）
```

把 `site/` 丟到 Netlify（或任何靜態主機）即可手機安裝、離線開。

## 檔案結構（一檔一責）

```
index.html / main.js     外殼：建 canvas、new Game(canvas).boot()
styles.css               全螢幕版面 + 直向轉橫向提示
manifest.webmanifest     PWA（安裝到主畫面、鎖橫向）
sw.js                    離線快取（改版把 CACHE 版本號 +1）
scripts/bundle-static.mjs  輸出 site/
src/
  game.js      主迴圈 + 狀態機 + 節奏判定 + 讚美/救援 + 結算
  config.js    ★ 所有可調數值（BPM、下落速度、判定窗、難度）——調手感只動這裡
  chart.js     譜面：由 BPM 把「步格圖樣」展開成有時間戳的音符（與音樂同源）
  input.js     原始輸入（鍵盤軌道 + 觸控，帶音訊時間戳），不懂遊戲規則
  audio.js     Web Audio 合成：節拍音樂 + 命中/漏拍音效 + 隨讚美起伏的風聲
  renderer.js  所有繪製（夜海/閃電/彼得行與沉/耶穌伸手/音符高速公路/水花/各畫面）
  speak.js     經文語音朗讀（speechSynthesis，zh-TW，沒語音時靜默 fallback）
  content.js   經文 / 文案 / 反思（和合本，逐字）——非程式者可只改這個檔
```

流程：標題 →（踏出船）**開場故事**（四更天、耶穌行海、彼得求「你來吧」，輕點翻頁）→ 選難度 →
倒數 → 遊玩（踩準濺起水花）→ 過關（經文**語音朗讀**，可「🔊 再聽一次」）。
朗讀跟著靜音鈕走，沒有中文語音的裝置會安靜略過、遊戲照常。

## 調整

- 太難 / 太簡單：改 `src/config.js` 的 `DIFF`（`bpm`、`scroll`、`win` 判定窗、`missPenalty`、`faithStart`）。
- 換譜面：改 `src/chart.js` 的 `WALK` / `RUN` 圖樣（`'0'..'3'`=該軌音符、`'-'`=休止）。
- 改經文 / 反思文案：只動 `src/content.js`（和合本經文已逐字校對：太 14:22-33）。

零美術檔：彼得、耶穌、海、閃電都是 Canvas 向量畫的。
