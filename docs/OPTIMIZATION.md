# PIRLS QuestionCraft 進度表 + 後續優化路線圖

> 對應檔案：`H:\GemPIRLS`
> 最近更新：**2026-05-03（晚上）**
> 同層搭配：`USAGE.md`

本文件分 6 大段：
1. **§1 目前狀態（live）** — 線上資源 / 安全 / 月費
2. **§2 已完成的工作** — 完整時間軸（2026-05-03 一日衝刺）
3. **§3 後續優化路線圖** — P0/P1/P2 排序
4. **§4 全新功能開發方向（P3 願景）** — 想到再做的長期選項
5. **§5 30 天建議優先順序** — 4 週分週任務清單
6. **§6 配套 skill 串接** — 11 個自動觸發對照表

---

# § 1. 目前狀態（live）

## 🌐 線上資源

| 資源 | 連結 | 狀態 |
|---|---|---|
| 網站本體 | https://cagoooo.github.io/pirls-questioncraft/ | ✅ Live |
| 老師端儀表板 | `/dashboard/?id=xxx` | ✅ Live |
| GitHub Repo | https://github.com/cagoooo/pirls-questioncraft | ✅ Public |
| Firebase 專案 | `pirls-questioncraft` (asia-east1) | ✅ Blaze |
| Cloud Functions | 6 個 endpoint | ✅ Node 22 |
| Firestore | `sharedQuizzes` + `submissions` + `rateLimits` | ✅ TTL 全開 |
| Cloudflare Turnstile | 三層護欄（Turnstile + 5 RPM/IP + maxInstances=10） | ✅ |
| LINE 通知 | Flex 卡片含 action button + 班級即時統計 | ✅ |
| Service Worker | `/sw.js` 分策略快取 + `version.json` polling + 更新 banner | ✅ |
| 雙週健康檢查 routine | [trig_01H29qS4ypK34i4uW9yBc1EP](https://claude.ai/code/routines/trig_01H29qS4ypK34i4uW9yBc1EP) | ⏰ 5/17 早上 |

## 🛡️ 安全性現況

| 項目 | 狀態 | 備註 |
|---|---|---|
| Gemini Key Rotate + Restriction | ✅ | UID `98604e6e`, 限制 Generative Language API |
| Cloudflare Turnstile | ✅ | site key 在 GitHub Actions yml、secret key 在 Firebase Secret Manager |
| Firestore Rules | ✅ 全鎖死 | 全部 admin SDK，client 進不來 |
| 三層護欄 | ✅ | Turnstile + 速率限制（5/min/IP） + maxInstances=10 |
| Cloud Functions Secret 管理 | ✅ 全 Secret Manager | GEMINI_API_KEY / TURNSTILE_SECRET / PIRLS_LINE_* |
| Service Worker 更新流程 | ✅ skipWaiting + clients.claim + version.json polling | |
| **AI Studio 舊 key 清理** | ⚠️ 待你手動 | 上 [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) 找 `AIzaSyDY...` 刪掉 |
| **Budget Alert** | ⚠️ 建議補 | 5 USD 警戒，5 分鐘設好（見 §3.B.1） |

## 💰 月度估算

實測費用 **< $0.25 USD/月**（約 7 元台幣，幾乎全部來自 Cloud Run / Artifact Registry 微小費用）。Gemini / Functions / Firestore / GitHub Pages 全在免費層內。

## 🎨 品牌資產

| 檔案 | 用途 |
|---|---|
| `public/icons/favicon.svg` | 主 favicon（藍紫漸層書本 + 4 色 PIRLS 條 + sparkle） |
| `public/icons/{favicon-32, apple-touch-icon, icon-192, icon-512}.png` | 多尺寸 PNG |
| `public/images/social-preview.png` | OG 1200×630（FB / LINE 分享卡） |
| `tools/generate-assets.mjs` | 一鍵重生（`npm run generate:assets`） |

---

# § 2. 已完成的工作（2026-05-03 — 一日完整衝刺）

按時間軸整理今天做的所有事：

## 📦 階段 A：路線 B 重構（上午完成）

| # | 項目 |
|---|---|
| 1 | 安全清理：撤銷外洩 Service Account key、刪 Downloads JSON |
| 2 | 啟用 Firestore + 6 個 GCP API + 建 `(default)` database (asia-east1) |
| 3 | 部署 firestore.rules（全鎖死）+ TTL Policy（expiresAt） |
| 4 | `next.config.ts`：`output:'export'` + basePath + env 暴露 |
| 5 | 動態路由 `/quiz/[quizId]` → `/quiz?id=xxx`（Suspense + useSearchParams） |
| 6 | 建 `functions/`：Genkit + firebase-functions v2 + cors + zod |
| 7 | Server Action → 4 個 onRequest endpoint（CORS + secret 注入） |
| 8 | API Route → Cloud Functions（payload size guard） |
| 9 | `src/lib/api.ts` fetch wrapper + OutputType 集中地 |
| 10 | 全 repo `from '@/ai/flows/...'` → `from '@/lib/api'` |
| 11 | basePath 路徑前綴修正（logo / favicon / OG / PDF 字型） |
| 12 | Gemini Key rotate + pipe 進 Secret Manager（pipe-not-paste pattern） |
| 13 | 部署 4 個 Cloud Functions |
| 14 | 建 GitHub Repo + push + 啟用 GitHub Pages（Actions 模式） |
| 15 | 端到端測試（curl Cloud Function + 前端打開 + FB Debugger） |
| 16 | 自製 SVG favicon + 1200×630 OG 卡（`tools/generate-assets.mjs`） |

## 🛡️ 階段 B：安全性 + AI 品質（下午完成）

| # | 項目 |
|---|---|
| 17 | **B.4** Turnstile 後端寫好（rate-limit.ts + turnstile.ts + withProtection 中介層） |
| 18 | **B.4** 前端 widget（最初用 @marsidev 失敗 → 改 vanilla CF API + 100ms polling） |
| 19 | **B.4** Cloudflare 註冊 + site key 寫進 GitHub Actions yml + secret 進 Firebase |
| 20 | **B.4** 三層護欄全部生效：Turnstile + 5 RPM/IP + maxInstances=10 |
| 21 | **B.5** Cloud Functions runtime nodejs20 → **nodejs22**（清掉 deprecation 警告） |
| 22 | **B.6** firebase-functions 6.x → **7.2.5**（清掉 outdated 警告） |
| 23 | **B.15** AI 自由發揮修正：`gemini-2.5-flash-lite` → **`gemini-2.5-flash`** |
| 24 | **B.15** Prompt 改 input-first 結構 + 自我檢查 list + articleContent fallback 強制覆蓋 |
| 25 | 端到端驗證 B.15：8 題 PIRLS 完美 2/2/2/2 分布、全圍繞輸入內容 |

## 📊 階段 C：學生作答儀表板（下午完成）

| # | 項目 |
|---|---|
| 26 | **B.16** 新增 2 個 Cloud Functions：submitQuizAnswer / getSubmissions |
| 27 | **B.16** 新增 `/dashboard/?id=xxx` 老師端頁面（Recharts + KPI + Bar + Radar + 表格 + CSV） |
| 28 | **B.16** QuizView 加 quizId prop、學生交卷自動寫 Firestore（best-effort） |
| 29 | **B.16** 分享 dialog 加「📊 開啟儀表板」按鈕 |

## 🔔 階段 D：LINE 通知大升級（下午完成）

| # | 項目 |
|---|---|
| 30 | **B.14** notify-line.ts Flex 卡片 helper（4 種狀態色彩 + 純文字 fallback） |
| 31 | **B.14** 4 個 endpoint 接 LINE 推播（成功/失敗 / 分享 / 學生交卷） |
| 32 | **B.14** 用阿凱老師既有共用 LINE Bot Channel（PIRLS_ 前綴隔離） |
| 33 | **B.14+** 加 action button 支援（最多 3 顆按鈕進 footer） |
| 34 | **B.14+** 卡片內容大升級：文章摘要 + PIRLS 分布 + IP + 個人/班級弱項層次 |
| 35 | **B.14+** 分享卡片含 2 顆 button（「👨‍🎓 開學生連結」「📊 老師儀表板」） |
| 36 | **B.14+** 學生交卷卡標題「🎉 第 N 位學生剛交卷」+ 班級即時平均 + Quiz 標題 |

## 🔄 階段 E：SW 自動更新機制（晚上完成）

| # | 項目 |
|---|---|
| 37 | **B.18** `tools/generate-version.mjs` 寫 git sha + 時戳到 `public/version.json` |
| 38 | **B.18** `public/sw.js` 分策略快取（HTML network-first / chunks cache-first / version.json no-store） |
| 39 | **B.18** `<VersionUpdateBanner>` 元件：5 分鐘 poll + visibilitychange + 藍紫漸層 banner |
| 40 | **B.18** SW 註冊 + controllerchange 自動 reload + skipWaiting message channel |
| 41 | **B.18** `npm prebuild` 自動產 version.json，`.gitignore` 排除 |

## 🧱 階段 F：元件 refactor + Skill 萃取

| # | 項目 |
|---|---|
| 42 | **B.8 (部分)** 抽 `<ShareDialog>` 元件（page.tsx 1067 → 1019 行） |
| 43 | 修正過時警告文案（之前說「伺服器記憶體+重啟即失」已不正確） |
| 44 | 入庫 skill **`firebase-studio-static-migration`**（11 步 SOP + 14 大雷區） |
| 45 | 入庫 skill **`cloudflare-turnstile-integration`**（vanilla wrapper + 4 大雷區） |

## 🤖 階段 G：背景 agent 排程

| # | 項目 |
|---|---|
| 46 | 排程 5/17 雙週健康檢查 routine（Gemini 棄用 check + 端到端煙霧測試 + 自動開 Issue） |

---

**今天完成的 P0/P1 項目共 8 個（B.4 / B.5 / B.6 / B.8 部分 / B.14 / B.15 / B.16 / B.18），加上品牌資產、Skill 入庫、健康檢查 agent 排程。專案從「能用」躍升到「好用、有品牌、可擴展、有 Ops」。**

---

# § 3. 後續優化路線圖

## 標記說明

- 🔴 **P0**：影響穩定性 / 安全 / 體驗，**兩週內**處理
- 🟡 **P1**：明顯加分項，**一個月內**有時間就做
- 🟢 **P2**：較進階優化或長期願景，看實際用量決定

---

## P0 — 立刻做 🔴

### B.1 補上 Budget Alert（5 分鐘）

> 雖然用量在免費層，但「萬一被 DDoS」的保險。

操作：[Cloud Console → Budgets](https://console.cloud.google.com/billing/0119C9-C416DD-660DE3/budgets) → Create Budget → Scope `pirls-questioncraft` → Amount **$5 USD** → 50%/90%/100% email alert → recipient `ipad@mail2.smes.tyc.edu.tw`。

### B.2 補 og:url + 確認 FB 分享預覽乾淨（10 分鐘）

FB Debugger 警告「缺 og:url」可加：

```ts
// src/app/layout.tsx
openGraph: {
  url: productionDomain,
  ...
}
```

`fb:app_id` 不打算做 FB 登入就忽略。

### B.3 把 build 時 TS / ESLint 錯誤打開（1-3 小時）

`next.config.ts` 目前：

```ts
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

**改成 `false`** 後 build 會吐錯，逐步修：

- `src/lib/use-toast` 的 `Toast` 沒 export → 補 export
- `jspdf` API spread argument tuple 錯誤 → 改用單個 arg 或加 `as const`
- `FileUpload.tsx` ClipboardEvent type assertion → 用 `unknown as ...`

### B.7 清理 AI Studio 舊 Gemini Key（5 分鐘・你手動）

`AIzaSyDY8wVCq...` 不在我能 list 的 GCP project 裡，可能是 [AI Studio](https://aistudio.google.com/app/apikey) 上的。請手動上去刪除。

### B.24（新）Cloudflare Turnstile Secret 定期 rotate（10 分鐘）

之前你把 secret key 貼進 chat 過，雖然只在私人對話內，**最佳實踐是定期 rotate**：

1. [Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile) → 你的 widget → **Rotate Secret**
2. 拿到新 secret 用 `--data-file` 灌進 Firebase：
   ```bash
   node -e "require('fs').writeFileSync('.tmp_ts', '新的 secret')" && \
   firebase --account=ipad@mail2.smes.tyc.edu.tw functions:secrets:set TURNSTILE_SECRET \
     --project=pirls-questioncraft --data-file=.tmp_ts && rm -f .tmp_ts && \
   firebase deploy --only functions
   ```

建議每 3-6 個月 rotate 一次。

---

## P1 — 兩週到一個月 🟡

### B.8 拆剩下的超大元件（半天）

✅ 已完成：`<ShareDialog>`

剩下：

| 檔 | 行數 | 拆法建議 |
|---|---|---|
| `src/app/page.tsx` | 1019 | 抽 `<InputPanel>`（image+text tab + RadioGroup）、`<ExportButtons>`（5 顆下載按鈕）、`hooks/useGenerateQuestions.ts` |
| `src/components/QuizView.tsx` | 752 | 抽 `<QuizQuestion>`、`<QuizProgress>`、`<QuizResult>` |
| `src/components/FileUpload.tsx` | 522 | 抽 `usePasteImage.ts`、`useDropZone.ts`、`<ImageThumbnail>` |

**為什麼重要**：拆完後加新功能、改 bug 速度會快 2-3 倍，AI 對程式的修改成功率明顯提升。

### B.9 字型瘦身（30 分鐘）

`public/fonts/NotoSansTC-*.ttf` 6 個檔約 **42MB**。每次老師按下載 PDF，瀏覽器都要載這麼大的字型檔到 jsPDF 嵌入。

**做法 A（簡單）**：只留 Regular + Bold 兩個檔（~14MB）。
**做法 B（最佳）**：用 [Noto Sans TC subset OTF](https://github.com/notofonts/noto-cjk/tree/main/Sans/Subset)，從 7MB → 1.5MB。
**做法 C（最徹底）**：改用 [pdf-lib](https://pdf-lib.js.org/) + 子集化，最終 PDF 只內嵌實際用到的字 ≈ 50-100KB。

### B.10 模型版本管理 + 自動 health check（1 小時）

歷史 commit 顯示模型棄用造成多次中斷。

1. 抽到 Firebase secret：
   ```bash
   firebase functions:secrets:set GEMINI_MODEL  # 預設值 googleai/gemini-2.5-flash
   ```
2. `functions/src/flows/*.ts` 改 `model: process.env.GEMINI_MODEL ?? 'googleai/gemini-2.5-flash'`
3. **5/17 雙週 routine 已會自動檢查棄用**，這條只是把切換成本降到「改 secret + redeploy」

### B.11 圖片移到 Firebase Storage（半天）

目前 `imageFilesDataURIs` base64 直接塞 Firestore，1 MiB doc 上限是真實限制。

**做法**：
1. `createSharedQuiz` 收圖片 → 上傳 Firebase Storage `quiz-images/{quizId}/{n}.jpg`
2. Firestore 只存 https URL
3. `getSharedQuiz` 回傳 URL → 學生瀏覽器直接從 Storage 拉

**好處**：4 張高解析照片不再撞 1 MiB 上限。

### B.12 HEIC 圖片支援（1 小時）

iPhone / iPad 拍照預設 HEIC，目前 OCR 失敗率高。

```bash
npm install heic2any
```

`FileUpload.tsx` 偵測副檔名自動轉 JPEG。

### B.13 自動化測試（1 天）

```bash
npm install -D vitest @testing-library/react playwright
```

最該優先寫的：
1. `lib/generatePaGamOQuizGroupExcel.ts` 純函式測試（之前 PaGamO 標題對不上踩過雷）
2. Playwright e2e：上傳圖片 → 出題 → 下載 PDF 三條主線
3. Functions emulator + supertest：4 個 endpoint 在 payload 過大 / 缺 secret 時的錯誤處理

### ~~B.25 Sentry 前後端錯誤監控~~ ❌ 決定不做（2026-05-03）

評估後發現：
- 單人教學工具量太小，Sentry 5K errors/月 永遠用不完，配置成本不划算
- 已有 LINE 即時通知（出錯立刻響）
- Cloud Functions Logs 已可在 Firebase Console 搜尋
- 改走更輕量替代方案：見 §B.27 LINE 週報

### B.27（新・取代 Sentry）LINE 週報摘要（1-2 小時）

**痛點**：LINE 即時通知很方便但訊息很零散；缺一個「過去一週概況」的視角。

**做法**：
1. 新增 Cloud Function `weeklyDigest`（用 [skill `schedule`](.) 排 cron 每週日 21:00 觸發）
2. 用 Cloud Logging API 撈過去 7 天 functions log，統計：
   - 出題總次數（圖片 vs 文字）
   - 失敗率 + 失敗原因 top 3
   - 平均回應時間（看 Gemini 是不是慢了）
   - 學生作答總數、班級平均
3. 組成 LINE Flex 卡片推給管理員，標題「📊 PIRLS 本週摘要」

**價值**：
- 不用每天看 console，週日晚上一張卡片看完
- 失敗率變高會立刻警覺（取代 Sentry trend 功能）
- 比 Sentry 更貼合教學場景（有「學生作答數」這種教育指標）

### B.26（新）使用量統計 dashboard（1 天）

當前無法回答「上週老師用了幾次出題？哪些圖片大小最常見？哪些時段尖峰？」

**做法**：
- 新 collection `usage` 在每次 generate 時寫一筆（時間 / 模式 / 字數 / 耗時 / IP hash）
- 老師端 `/admin/?key=xxx` 頁，用 Recharts 顯示：
  - 每日出題次數曲線
  - 圖片 vs 文字模式比例
  - 平均回應時間趨勢（Gemini 慢就會看出來）
  - 失敗率 / 失敗類型分布
- key 用環境變數簡單保護

---

## P2 — 中長期願景 🟢

### B.16+ 學生答題儀表板進化版（1-2 天）

**已完成**：基本 KPI + 各題答對率 + PIRLS 雷達 + CSV 匯出

**還能加**：
- ✏️ **每題詳細答案分布**（A 25%、B 60%、C 10%、D 5%）老師看誤答模式
- 🎯 **個人答題時間統計**（從進入到提交多少秒）→ 看誰太快可能亂猜
- 🏆 **班級即時排行榜**（依答對率排序，可擇優公布）
- 📊 **多次測驗成績趨勢**（同學生過去 N 次平均答對率折線）
- 📥 **匯出班級成績 PDF**（一鍵生家長通知書）

### B.17 多老師帳號 + 私人題庫（2 天）

目前任何人都能用、quizId 隨機字串。升級：

1. Firebase Auth + Google OAuth（限 `@mail2.smes.tyc.edu.tw` 或更廣 `*.edu.tw`）
2. 題庫掛在老師 uid 下：`quizzes/{uid}/{quizId}`
3. 老師端 `/my-quizzes` 看歷史出題
4. 關鍵字搜尋過去出過的題
5. 一鍵「重出練習版」（保留文章但讓 AI 重新出題）

**長遠**：累積 3 個月後可做「相似題自動推薦」。

### B.18+ PWA 完整化（半天）

**已完成**：基礎 SW + 版本更新 banner

**還能加**：
- `manifest.json` 讓 iPad / 手機加到主畫面
- 離線時顯示「離線中，請連網」優雅頁面
- iOS Safari `apple-mobile-web-app-capable` 全螢幕模式

> 搭配 skill `pwa-cache-bust` 避免快取地獄

### B.19 i18n 多語系 UI（半天）

prompt 已支援中英，UI 還沒。用 [`next-intl`](https://next-intl.dev/)：
- 多語言 UI（中、英、日韓越南）
- 適合東南亞華語學校
- 商業上：可變成「東南亞華語學校教師工具」

### B.20 出題品質回饋迴路（1 天）

- 每題加 👍 / 👎 / 「改寫此題」按鈕
- 收集到 Firestore `quizFeedback`
- 每月用 BigQuery / Looker 看高頻 👎 題的 PIRLS 層次分布
- 改 prompt 或微調 model

### B.21 與既有平台整合

- **PaGamO API 直接串接**：取代下載 Excel 再上傳的人工流程
- **Google Classroom API**：老師按一下「指派給三年一班」
- **LINE Notify / LINE Bot**：學生交卷時老師收 LINE 通知（已部分做）

### B.22 自訂網域 `pirlss.smes.tyc.edu.tw`（1 小時）

1. **GitHub Pages**：Repo Settings → Pages → Custom domain → 填網域 + 勾 Enforce HTTPS
2. **`public/CNAME`** 檔內容寫 `pirlss.smes.tyc.edu.tw`
3. **DNS**：CNAME `pirlss` → `cagoooo.github.io`
4. **`.github/workflows/deploy-pages.yml`**：把 `NEXT_PUBLIC_BASE_PATH` 改成空字串
5. **`functions/src/index.ts`** CORS 收緊（可選）：
   ```ts
   const cors = corsLib({
     origin: [
       'https://cagoooo.github.io',
       'https://pirlss.smes.tyc.edu.tw',
       /^http:\/\/localhost:\d+$/,
     ],
   });
   ```
6. **Cloudflare Turnstile** Hostnames 補 `pirlss.smes.tyc.edu.tw`

### B.23 UI 細節（1-2 天累積）

- 暗色模式切換（CSS 變數已寫好 `.dark`）
- **「再出一次某題」**（單題重生）
- **「鎖定文章但重出題」**（節省 API 費用）
- 載入動畫換成 PIRLS 角色（教學感）
- 學生作答頁加倒數計時器（限時模式）
- 教師現場投影模式（大字 + 全畫面題目）

---

# § 4. 全新功能開發方向（P3 — 願景）🌱

不在原本路線圖內、但用過幾次後可能想做的東西。**靠時間累積資料才會看出價值**。

## 4.1 從「出題工具」演化成「教學備課平台」

目前定位：圖片/文字 → PIRLS 題目。

**升級方向**：
- 一張課本照片 → 出題 + 課程目標 + 教學流程 + 學習單 + 課後反思
- 整合 [skill `lesson-prep`](.) 與 [skill `teaching-cockpit`](.) 變成「PIRLS 課文 → 互動教學駕駛艙」

## 4.2 影音內容出題（Gemini 多模態招牌能力）

現在只支援文字 + 圖片。

**下一代**：
- 上傳 YouTube 連結 / 影片檔 → AI 自動轉文字 → PIRLS 出題
- Gemini 2.5 已支援多模態（影片直接餵）

**情境**：英語聽力測驗、社會課影片導讀、自然觀察影片回饋題。

## 4.3 學生個人化學習路徑

每位學生作答資料累積後（B.17 老師帳號完成後）：

- 弱項層次（如「評估與批判」常錯）→ 推薦該層次的補強練習
- 用 Vertex AI Embedding 找出「跟你弱點類似的同學常出錯的題」做為練習
- Firestore + Vector Search

## 4.4 班級即時連線測驗（Kahoot 風）

Functions + Firebase Realtime Database：
- 老師開連線房間 → 學生掃 QR Code 加入
- 同步顯示題目 → 倒數答題 → 即時排行榜
- 結束後自動產生班級報告

## 4.5 教師社群題庫

- 老師可選「公開分享某次出題」
- 其他老師看到 → 「採用 / fork」
- 用過幾次後再評星
- 高分題庫變成「精選題庫」推薦給新老師

## 4.6 與 LINE 老師群組整合

`skill: line-messaging-firebase` 已存在。情境：

- 老師在 LINE 群組丟一張課本照片 → 私訊 Bot
- 30 秒後 Bot 回傳 PDF + 連結 + QR Code
- **老師完全不用打開網頁**

## 4.7 IRT（試題反應理論）難度分析

收集足夠多學生作答後，用 Item Response Theory 算每題真實難度：
- AI 出題說「這是評估與批判」但實際全班都答對 → 難度被高估
- 結合 [skill `data-context-extractor`](.) 自動產出班級難度報告

## 4.8 開源 / 共筆模式

repo 已 public，可加：

- 完整 README + 一鍵部署按鈕
- 提供「fork 此 repo + 改成你學校用」的 SOP
- 投到台灣教育科技開源社群（[LearnMode 學習吧](https://www.learnmode.net/)、[均一教育平台](https://www.junyiacademy.org/)）

## 4.9（新）PIRLS 弱項補強練習自動生成

學生交卷後系統知道他的弱項層次。**自動生成補強練習**：

1. 讀 student.pirlsLevelStats → 找最弱層次
2. 用同一篇文章 prompt AI 出 4 題該層次的「練習版」
3. 推送個人化 PDF / 線上連結
4. **真實價值**：差異化教學自動化，老師不用為每位學生客製

## 4.10（新）家長端通知（一週成績摘要 LINE 推播）

- 學生綁定家長 LINE → 每週日晚上自動推卡片
- 「您的孩子王小明本週完成 3 次測驗，平均答對率 78%（班級平均 72%），『詮釋整合』表現優秀，『評估批判』可加強。」
- 配合 `cron` 排程 + LINE Flex 卡片

## 4.11（新）老師備課 LINE Bot 互動模式

老師 LINE 私訊 Bot：
- 「我要 8 題」+ 上傳圖片 → 自動回 PDF
- 「分享班級」→ 回 QR code 圖
- 「儀表板」→ 回班級即時統計
- 完全不用開網頁，課堂直接運作

---

# § 5. 接下來 30 天建議優先順序

```
Week 1 (這週)
├── B.1   Budget Alert（5 min）⭐
├── B.7   清 AI Studio 舊 key（5 min）⭐
├── B.2   補 og:url（10 min）
├── B.24  Turnstile secret rotate（10 min）⭐
└── B.22  上自訂網域 pirlss.smes.tyc.edu.tw（1 hr）⭐⭐

Week 2
├── B.10  模型 env 化（30 min）
├── B.3   打開 build TS / lint（1-3 hr）
└── B.9   字型瘦身（30 min）

Week 3
├── B.8   拆剩下元件（半天）
└── B.13  自動化測試（1 天）

Week 4
├── B.11  圖片改 Firebase Storage（半天）
├── B.27  LINE 週報摘要（1-2 hr）⭐ (取代 Sentry，更貼合教學場景)
└── B.26  使用量統計 dashboard（1 天）⭐
```

⭐ = 個人推薦最有感的
⭐⭐ = 強烈推薦最先做（自訂網域對教育用途**形象提升巨大**）

---

# § 6. 配套 skill 串接清單

當下次想做某件事，直接在 chat 提到對應關鍵字，Claude 會自動觸發對應 skill：

| 想做什麼 | 對應 skill |
|---|---|
| 加 LINE 通知 / 告警 | `line-messaging-firebase` |
| API Key rotate / 加限制 | `gcp-api-key-secure-create` |
| 處理 GitHub Actions CI 失敗 | `firebase-ci-troubleshooter` |
| Functions 部署常踩雷 | `firebase-stack-automation` |
| 在這個專案再加新 sub-app | `firebase-multi-app-safety` |
| Gemini 模型棄用又中斷 | `gemini-api-integration` |
| 確認費用永遠 $0 | `gemini-free-tier-first` |
| OG 中文方塊 | `og-social-preview-zh` |
| PDF 匯出問題 | `pdf-export-print-best-practice` |
| 部署完看到舊版本 | `pwa-cache-bust` |
| 重新跑一次 Firebase Studio→GitHub Pages 遷移 | **`firebase-studio-static-migration`** ⭐ 今天新建 |
| Turnstile 整合 / 防 bot | **`cloudflare-turnstile-integration`** ⭐ 今天新建 |
| 排程任務（每月查模型棄用 / 每週 metric review） | `schedule` |

---

# § 7. 今天累積學到的最佳實踐（防再踩雷）

## 7.1 Cloud Functions / Firebase 部署
- 第一次 deploy 多 functions 時 500 錯誤是常見，**重試一次 `--force`** 就好
- secret 一律 **`--data-file=.tmp_xxx`** 模式，避開 Windows printf CRLF 雷
- secret 為 `PLACEHOLDER_NOT_CONFIGURED` 時程式 fail-open，讓 deploy 不被擋
- Cloud Run API call 失敗時 fail-closed（不能讓攻擊者繞過）

## 7.2 Next 15 + React 19 + static export
- `output: 'export'` 後 dynamic route `[param]` 改成 `?id=xxx` query string
- `useSearchParams()` 必須包 `<Suspense>`
- `next/image` `unoptimized: true` 下不自動加 basePath
- basePath 子路徑下所有硬路徑都要加 `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/...`
- Git Bash on Windows 把 leading-slash env var 當路徑改寫，**不要從 env 傳 basePath**

## 7.3 第三方套件選擇
- **不要用 `@marsidev/react-turnstile`**（時序競態）→ 改 vanilla CF API + 100ms polling
- next/script 必須 `strategy="beforeInteractive"`，否則 widget 來不及 mount

## 7.4 AI Prompt 設計
- 文章/輸入 **放最前面**（model 對開頭內容記得最牢）
- 加「自我檢查 list」要求 model 出題前確認
- backend 加 fallback 強制覆蓋（如 `output.articleContent = input.text`）
- 短輸入 + flash-lite 模型 = 容易自由發揮，**升級到 flash 顯著改善**

## 7.5 LINE Flex 卡片
- 4 種狀態色（綠/紅/橘/藍）+ 統一 emoji 圖示語意
- color 必須 6-digit hex（`#888` LINE 直接拒收）
- Flex 失敗一律 fallback 純文字（雙保險）
- footer 加 action button 是巨大 UX 提升

## 7.6 SW + 版本更新
- HTML network-first / chunks cache-first / version.json no-store 三策略缺一不可
- skipWaiting + clients.claim + controllerchange reload 三組合
- `npm prebuild` 自動寫 version.json，比手動忘記強

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/)
