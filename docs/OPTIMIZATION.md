# PIRLS QuestionCraft 進度表 + 後續優化路線圖

> 對應檔案：`H:\GemPIRLS`
> 最近更新：**2026-05-03（完整一日衝刺結束）**
> 同層搭配：`USAGE.md`

本文件分 7 大段：
1. **§1 目前狀態（live）** — 線上資源 / 安全 / 月費
2. **§2 已完成的工作** — 完整時間軸（2026-05-03 一日衝刺）
3. **§3 後續優化路線圖** — P0/P1/P2 排序
4. **§4 全新功能開發方向（P3 願景）** — 想到再做的長期選項
5. **§5 30 天建議優先順序** — 4 週分週任務清單
6. **§6 配套 skill 串接** — 13 個自動觸發對照表
7. **§7 今天累積的最佳實踐** — 防再踩雷的口袋指南

---

# § 1. 目前狀態（live）

## 🌐 線上資源

| 資源 | 連結 | 狀態 |
|---|---|---|
| 網站本體 | https://cagoooo.github.io/pirls-questioncraft/ | ✅ Live |
| 老師端班級成績儀表板 | `/dashboard/?id=xxx` | ✅ Live |
| **🆕 老師端使用統計 admin** | `/admin/`（密碼：你的設定） | ✅ Live |
| GitHub Repo | https://github.com/cagoooo/pirls-questioncraft | ✅ Public |
| Firebase 專案 | `pirls-questioncraft` (asia-east1) | ✅ Blaze |
| Cloud Functions | **9 個 endpoint**（Node 22） | ✅ |
| Firestore | `sharedQuizzes` + `submissions` + `rateLimits` + **`usageStats`** | ✅ TTL 全開 |
| Cloudflare Turnstile | 三層護欄（Turnstile + 5 RPM/IP + maxInstances=10） | ✅ |
| LINE 通知 | 即時 Flex 卡 + **每週日 21:00 自動週報** | ✅ |
| Service Worker | `/sw.js` 分策略快取 + `version.json` polling + 更新 banner | ✅ |
| **🆕 Budget Alert** | $50/月警戒（50%/90%/100% email） | ✅ |
| 雙週健康檢查 routine | [trig_01H29qS4ypK34i4uW9yBc1EP](https://claude.ai/code/routines/trig_01H29qS4ypK34i4uW9yBc1EP) | ⏰ 5/17 |

## ☁️ 9 個 Cloud Functions 全圖

```
✅ generateFromImages     AI 圖片出題（gemini-2.5-flash + Turnstile）
✅ generateFromText       AI 文字出題（gemini-2.5-flash + Turnstile）
✅ createSharedQuiz       產生學生分享連結
✅ getSharedQuiz          學生讀取測驗
✅ submitQuizAnswer       學生交卷 + 寫 submissions
✅ getSubmissions         老師端班級成績儀表板資料
✅ getAdminStats          老師端使用統計（Bearer auth + 5 RPM 限速）
✅ weeklyDigest           每週日 21:00 自動推 LINE 週報
✅ triggerWeeklyDigestNow 手動觸發週報（測試用）
```

## 🛡️ 安全性現況

| 項目 | 狀態 | 備註 |
|---|---|---|
| Gemini Key Rotate + Restriction | ✅ | UID `98604e6e`，限制 Generative Language API |
| Cloudflare Turnstile | ✅ | site key 在 GitHub Actions yml、secret 在 Firebase Secret Manager |
| Firestore Rules | ✅ 全鎖死 | client 進不來、全部走 admin SDK |
| 三層護欄 | ✅ | Turnstile + 5 RPM/IP + maxInstances=10 |
| Admin endpoint 加速率限制 | ✅ | 即使密碼簡短也擋暴力破解（5/min/IP） |
| Cloud Functions Secret 管理 | ✅ | 全 Secret Manager（GEMINI_API_KEY / TURNSTILE / LINE / ADMIN）|
| Service Worker 更新流程 | ✅ skipWaiting + clients.claim + version.json polling | |
| Budget Alert | ✅ | $50/月，50%/90%/100% email |
| **AI Studio 舊 key 清理** | ⚠️ 待你手動 | 上 [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) 找 `AIzaSyDY...` 刪掉 |

## 💰 月度估算

實測 **< $0.25 USD/月**（約 7 元台幣，幾乎全部來自 Cloud Run / Artifact Registry 微小費用）。Gemini / Functions / Firestore / GitHub Pages 全在免費層。$50 Budget Alert 給了 200x 的安全餘量。

## 🎨 品牌資產

| 檔案 | 用途 |
|---|---|
| `public/icons/favicon.svg` | 主 favicon（藍紫漸層書本 + 4 色 PIRLS 條 + sparkle） |
| `public/icons/{favicon-32, apple-touch-icon, icon-192, icon-512}.png` | 多尺寸 PNG |
| `public/images/social-preview.png` | OG 1200×630（FB / LINE 分享卡） |
| `tools/generate-assets.mjs` | 一鍵重生 |

---

# § 2. 已完成的工作（2026-05-03 — 完整一日衝刺）

按時間軸整理今天做的所有事，分 9 階段。

## 📦 階段 A：路線 B 重構（上午）

從 Firebase Studio Server Action App → GitHub Pages 純靜態 + Cloud Functions。16 步完整流程詳見早先版本。

## 🛡️ 階段 B：安全 + AI 品質（中午到下午初）

| # | 完成項目 |
|---|---|
| ✅ B.4 | Cloudflare Turnstile 三層護欄（含 vanilla wrapper 修 @marsidev 雷區） |
| ✅ B.5 | Cloud Functions runtime nodejs20 → **nodejs22** |
| ✅ B.6 | firebase-functions 6.x → **7.2.5** |
| ✅ B.15 | AI 自由發揮修正：`gemini-2.5-flash-lite` → **`gemini-2.5-flash`** + input-first prompt + 自我檢查 list |

## 📊 階段 C：學生作答儀表板（下午）

| # | 完成項目 |
|---|---|
| ✅ B.16 | `/dashboard/?id=xxx` 老師端班級成績儀表板（KPI + Recharts Bar/Radar + CSV 匯出） |
| ✅ B.16 | 2 個新 Cloud Functions（submitQuizAnswer / getSubmissions） |
| ✅ B.16 | 分享 Dialog 加「📊 開啟儀表板」按鈕 |

## 🔔 階段 D：LINE 通知大升級（下午）

| # | 完成項目 |
|---|---|
| ✅ B.14 | LINE Flex 卡片 helper（4 色狀態 + 純文字 fallback） |
| ✅ B.14 | 4 個 endpoint 接 LINE 推播（成功/失敗/分享/交卷） |
| ✅ B.14+ | Action button 支援（最多 3 顆按鈕進 footer） |
| ✅ B.14+ | 卡片內容大升級：文章摘要 + PIRLS 分布 + IP + 個人/班級弱項 |

## 🔄 階段 E：SW 自動更新機制（傍晚）

| # | 完成項目 |
|---|---|
| ✅ B.18 | `public/sw.js` 分策略快取（HTML network-first / chunks cache-first / version.json no-store） |
| ✅ B.18 | `<VersionUpdateBanner>` 元件 + `tools/generate-version.mjs` |
| ✅ B.18 | `npm prebuild` 自動產 version.json |

## 🧱 階段 F：元件 refactor + Skill 萃取（傍晚）

| # | 完成項目 |
|---|---|
| ✅ B.8 (部分) | 抽 `<ShareDialog>` 元件（page.tsx 1067 → 1019 行） |
| ✅ Skill | 新 skill **`firebase-studio-static-migration`** 入庫 |
| ✅ Skill | 新 skill **`cloudflare-turnstile-integration`** 入庫 |

## 🤖 階段 G：背景 agent 排程（傍晚）

| # | 完成項目 |
|---|---|
| ✅ Routine | 排程 5/17 雙週健康檢查（Gemini 棄用 check + 端到端煙霧測試 + 自動開 Issue） |

## 📈 階段 H：使用量分析 + 週報（晚上）⭐ 新

| # | 完成項目 |
|---|---|
| ✅ B.27 | LINE 週報摘要（每週日 21:00 自動推） |
| ✅ B.27 | `usage-tracker.ts` 每日計數器（`usageStats/{YYYY-MM-DD}` 原子遞增 + 90 天 TTL） |
| ✅ B.27 | `weekly-digest.ts` 純函式 + onSchedule cron + manual HTTP trigger |
| ✅ B.27 | 智慧狀態色（無使用→warning / 失敗率>10%→failed / 班均<60%→提示） |
| ✅ B.26 | `/admin/` 老師端使用統計頁（password 登入 + sessionStorage） |
| ✅ B.26 | 4 KPI + Recharts AreaChart / PieChart / RadarChart + 30 天詳表 |
| ✅ B.26 | Bearer token Firebase Secret Manager + 5 RPM 限速防暴破 |
| ✅ B.1 | $50/月 Budget Alert（你動手） |

## ✨ 階段 I：UX 微調收尾（晚上後段）⭐ 新

| # | 完成項目 |
|---|---|
| ✅ — | 「提供使用回饋」按鈕 URL 改至 `cagoooo.github.io/Akai/wish/` |
| ✅ — | LINE 週報「線上儀表板」按鈕修正指向 `/admin/` |
| ✅ — | **進度條 UX 大改造**：ease-out 曲線 + 7 段任務感訊息輪播 |
| ✅ — | 圖片壓縮分張顯示進度（`已處理 1/3 張`） |
| ❌ B.25 | Sentry 經評估後不做（量太小、LINE 已涵蓋即時通知） |

---

**整日累計：13 個 P0/P1 完成項目 + 2 個新 skill + 1 個雙週 routine。專案從「能用」躍升到「好用、有品牌、可擴展、有 Ops、有資料分析」。**

---

# § 3. 後續優化路線圖

## 標記說明

- 🔴 **P0**：影響穩定性 / 安全 / 體驗，**兩週內**處理
- 🟡 **P1**：明顯加分項，**一個月內**有時間就做
- 🟢 **P2**：較進階優化或長期願景，看實際用量決定
- ❌ **已決定不做**：留紀錄避免下次又考慮

---

## P0 — 立刻做 🔴

### B.2 補 og:url（10 分鐘）

FB Debugger 警告「缺 og:url」可加：

```ts
// src/app/layout.tsx
openGraph: {
  url: productionDomain,
  ...
}
```

### B.3 把 build 時 TS / ESLint 錯誤打開（1-3 小時）

`next.config.ts` 目前 `ignoreBuildErrors: true` / `ignoreDuringBuilds: true`，**改成 `false`** 後 build 會吐錯，逐步修：

- `src/lib/use-toast` 的 `Toast` 沒 export → 補 export
- `jspdf` API spread argument tuple 錯誤 → 改用單個 arg 或加 `as const`
- `FileUpload.tsx` ClipboardEvent type assertion → 用 `unknown as ...`

### B.7 清理 AI Studio 舊 Gemini Key（5 分鐘・你手動）

`AIzaSyDY8wVCq...` 不在我能 list 的 GCP project 裡，可能是 [AI Studio](https://aistudio.google.com/app/apikey) 上的。請手動上去刪除。

### B.24 Cloudflare Turnstile Secret 定期 rotate（10 分鐘）

[Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile) → 你的 widget → **Rotate Secret**，每 3-6 個月一次。

```bash
node -e "require('fs').writeFileSync('.tmp_ts', '新的 secret')" && \
firebase functions:secrets:set TURNSTILE_SECRET --data-file=.tmp_ts && rm -f .tmp_ts && \
firebase deploy --only functions
```

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

### B.9 字型瘦身（30 分鐘）

`public/fonts/NotoSansTC-*.ttf` 6 個檔約 **42MB**，每次老師按下載 PDF 瀏覽器都要載這麼大。

**做法**：只留 Regular + Bold（~14MB），或用 [Noto Sans TC subset OTF](https://github.com/notofonts/noto-cjk/tree/main/Sans/Subset)（~1.5MB Bold）。

### B.10 模型版本管理 + 自動 health check（1 小時）

把模型抽到 Firebase secret：

```bash
firebase functions:secrets:set GEMINI_MODEL  # 預設 googleai/gemini-2.5-flash
```

`functions/src/flows/*.ts` 改 `model: process.env.GEMINI_MODEL ?? 'googleai/gemini-2.5-flash'`。

### B.11 圖片移到 Firebase Storage（半天）

目前 `imageFilesDataURIs` base64 直接塞 Firestore，1 MiB doc 上限是真實限制。改傳 Firebase Storage，Firestore 只存 https URL。

### B.12 HEIC 圖片支援（1 小時）

```bash
npm install heic2any
```

`FileUpload.tsx` 偵測副檔名自動轉 JPEG。

### B.13 自動化測試（1 天）

```bash
npm install -D vitest @testing-library/react playwright
```

最該優先寫的：
1. `lib/generatePaGamOQuizGroupExcel.ts` 純函式測試
2. Playwright e2e：上傳圖片 → 出題 → 下載 PDF 三條主線
3. Functions emulator + supertest：測 9 個 endpoint

### B.28（新）真實串流進度 SSE（半天）

**進化 B.18 的「模擬進度」**：目前進度條是 ease-out 曲線假裝爬升，無法反映 model 真實速度。下一代用 [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) 串流：

- Cloud Functions 改用 streaming response（Genkit 1.33 支援）
- 邊收 token 邊寫 SSE event 給前端
- 前端用 `EventSource` 收，按 token 數推算真實進度
- AI 真的快慢使用者一目了然

**價值**：使用者體感 Gemini 真實速度，遇到 quota 變慢能立刻發現。

### B.29（新）Admin「30 天記住我」選項（30 分鐘）

目前 admin 登入存 sessionStorage（關分頁就清），不方便。加：

```tsx
<Checkbox checked={remember} onChange={...}>30 天免登入</Checkbox>
```

勾選後存到 localStorage 加上時間戳，30 天後過期自動清。對教學場景：老師早上開 admin 看完關掉，下午又要看時不用重打密碼。

### B.30（新）LINE 週報強化（1 小時）

目前週報只有總計數字。可加：

- **Top 3 quiz**（這週被分享最多次的測驗 + 標題）
- **時段熱力圖**（哪個時段最常使用 → 知道老師備課時間）
- **新使用者數**（這週首次出現的 IP，估算「擴散」速度）
- **平均回應時間**（看 Gemini 是不是慢了）

需要在 `usage-tracker.ts` 多記幾個欄位。

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

1. Firebase Auth + Google OAuth（限 `@mail2.smes.tyc.edu.tw` 或 `*.edu.tw`）
2. 題庫掛在老師 uid 下：`quizzes/{uid}/{quizId}`
3. 老師端 `/my-quizzes` 看歷史出題
4. 一鍵「重出練習版」（保留文章但讓 AI 重新出題）

### B.18+ PWA 完整化（半天）

**已完成**：基礎 SW + 版本更新 banner

**還能加**：
- `manifest.json` 讓 iPad / 手機加到主畫面
- 離線時顯示「離線中，請連網」優雅頁面
- iOS Safari `apple-mobile-web-app-capable` 全螢幕模式

### B.19 i18n 多語系 UI（半天）

prompt 已支援中英，UI 還沒。用 [`next-intl`](https://next-intl.dev/)。

### B.20 出題品質回饋迴路（1 天）

- 每題加 👍 / 👎 / 「改寫此題」按鈕
- 收集到 Firestore `quizFeedback`
- 每月看高頻 👎 題的 PIRLS 層次分布

### B.21 與既有平台整合

- **PaGamO API 直接串接**：取代下載 Excel 再上傳
- **Google Classroom API**：老師按一下「指派給三年一班」
- **LINE Bot 互動**：老師私訊 Bot → 回 PDF / QR

### B.22 自訂網域 `pirlss.smes.tyc.edu.tw`（1 小時）⭐⭐ 強推

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

**為什麼強推**：學生家長看到 `pirlss.smes.tyc.edu.tw` 比 `cagoooo.github.io/pirls-questioncraft` **形象提升 10 倍**。

### B.23 UI 細節（1-2 天累積）

- 暗色模式切換
- **「再出一次某題」**（單題重生）
- **「鎖定文章但重出題」**（節省 API 費用）
- 載入動畫換成 PIRLS 角色（教學感）
- 學生作答頁加倒數計時器
- 教師現場投影模式

### B.31（新）學生作答時間統計（半天）

- QuizView 進入時記時戳，提交時計算 elapsed
- 寫入 submission doc → dashboard 顯示「最快 2 分 30 秒、最慢 12 分」
- LINE 卡片提示「此學生作答 8 秒就交卷，可能亂猜」

### B.32（新）Quiz title 重新生成（10 分鐘）

老師發現 AI 給的標題不滿意（如「文章閱讀理解測驗」太籠統）：
- 結果頁 title 旁加 🔄 按鈕
- 點下去 fetch Gemini 只重新生標題（不重出題）
- 節省 API 成本：1 次 generate vs 重新整套出題

### B.33（新・取代 Sentry）使用量統計拉得更深（1 天）

`/admin/` 已有基本統計，可加：

- **每日尖峰時段熱力圖**（24×7 表格，顏色深淺看活躍度）
- **裝置類型 / 瀏覽器分布**（從 user agent 解析）
- **Cloud Functions 平均 / p95 / p99 回應時間趨勢**（看 Gemini 變慢就知道）
- **失敗錯誤類型分類**（quota / timeout / 其他）

---

# § 4. 全新功能開發方向（P3 — 願景）🌱

不在原本路線圖內、長期累積資料才有意義的方向。

## 4.1 從「出題工具」演化成「教學備課平台」

整合 [skill `lesson-prep`](.) 與 [skill `teaching-cockpit`](.) 變成「PIRLS 課文 → 互動教學駕駛艙」。

## 4.2 影音內容出題（Gemini 多模態招牌）

YouTube 連結 / 影片檔 → AI 自動轉文字 → PIRLS 出題。**情境**：英語聽力測驗、社會課影片導讀、自然觀察影片回饋題。

## 4.3 學生個人化學習路徑

每位學生作答資料累積後，弱項層次 → 推薦該層次的補強練習。用 Vertex AI Embedding 找「跟你弱點類似的同學常出錯的題」。

## 4.4 班級即時連線測驗（Kahoot 風）

Functions + Firebase Realtime Database：老師開房間 → 學生掃 QR 加入 → 同步顯示題目 → 倒數答題 → 即時排行榜。

## 4.5 教師社群題庫

老師可選「公開分享某次出題」，其他老師「採用 / fork」，用過幾次後評星，高分變「精選題庫」推薦給新老師。

## 4.6 與 LINE 老師群組整合

老師 LINE 群組丟一張課本照片 → 私訊 Bot → 30 秒後 Bot 回傳 PDF + 連結 + QR。**老師完全不用打開網頁**。

## 4.7 IRT（試題反應理論）難度分析

收集足夠多學生作答後，用 Item Response Theory 算每題真實難度。AI 出題說「這是評估與批判」但實際全班都答對 → 難度被高估。

## 4.8 開源 / 共筆模式

repo 已 public，加完整 README + 一鍵部署按鈕，投到台灣教育科技開源社群。

## 4.9 PIRLS 弱項補強練習自動生成

學生交卷後系統知道弱項層次 → 用同篇文章自動生 4 題該層次的「練習版」 → 推送個人化 PDF。**差異化教學自動化**。

## 4.10 家長端通知（一週成績摘要 LINE 推播）

學生綁定家長 LINE → 每週日晚上自動推卡片：「您的孩子王小明本週完成 3 次測驗，平均答對率 78%（班級平均 72%）...」

## 4.11 老師備課 LINE Bot 互動模式

老師 LINE 私訊 Bot：「我要 8 題」+ 上傳圖片 → 回 PDF；「分享班級」→ 回 QR；「儀表板」→ 回班級即時統計。**完全不用開網頁**。

---

# § 5. 接下來 30 天建議優先順序（refresh）

⭐ 標記表示個人推薦最有感的

```
Week 1（這週）— 形象 + 收尾
├── B.22  自訂網域 pirlss.smes.tyc.edu.tw（1 hr）⭐⭐
├── B.7   清 AI Studio 舊 key（5 min）⭐
├── B.2   補 og:url（10 min）
└── B.24  Turnstile secret rotate（10 min）⭐

Week 2 — 程式碼健康度
├── B.10  模型 env 化（30 min）⭐
├── B.3   打開 build TS / lint（1-3 hr）
└── B.9   字型瘦身（30 min）

Week 3 — 元件拆乾淨 + 測試
├── B.8   拆剩下元件（半天）⭐
└── B.13  自動化測試（1 天）

Week 4 — 看資料延伸功能
├── B.30  LINE 週報強化（Top quiz / 時段熱力圖）（1 hr）⭐
├── B.11  圖片改 Firebase Storage（半天）
├── B.29  Admin 30 天記住我（30 min）
└── B.32  Quiz title 重新生成（10 min）⭐
```

⭐⭐ **B.22 自訂網域** = 對教育用途**形象提升巨大**，學生家長一看就信。

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
| 重新跑一次 Firebase Studio→GitHub Pages 遷移 | **`firebase-studio-static-migration`** ⭐ |
| Turnstile 整合 / 防 bot | **`cloudflare-turnstile-integration`** ⭐ |
| 排程任務（每月查模型棄用 / 每週 metric review） | `schedule` |

---

# § 7. 今天累積學到的最佳實踐（防再踩雷）

## 7.1 Cloud Functions / Firebase 部署

- 第一次 deploy 多 functions 時 500 錯誤是常見，**重試一次 `--force`** 就好
- secret 一律 **`--data-file=.tmp_xxx`** 模式，避開 Windows printf CRLF 雷
- secret 為 `PLACEHOLDER_NOT_CONFIGURED` 時程式 fail-open，讓 deploy 不被擋
- 跨 endpoint 的 utils（rate-limit / turnstile / notify-line / usage-tracker）抽成獨立檔比塞 index.ts 好維護
- collectionGroup query 加 `orderBy` 需要 single-field index → 不需排序時拿掉

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
- 動態狀態色 + body 智慧訊息（依數據給 hint）才是「教學感」週報而非機械 log

## 7.6 SW + 版本更新

- HTML network-first / chunks cache-first / version.json no-store 三策略缺一不可
- skipWaiting + clients.claim + controllerchange reload 三組合
- `npm prebuild` 自動寫 version.json，比手動忘記強

## 7.7（新）進度條 UX 設計

- 真實進度（fetch / await）固定卡在某 % 達 10-25 秒 = 使用者以為當機
- **不能監測 model 真實進度** → 用模擬進度（ease-out 曲線從 X% 爬到 96%，最後 4% 等真實事件）
- 訊息**每 5-10% 切換**：「分析語意 → 設計題目 → 撰寫干擾選項 → 校對層次平衡」
- emoji 圖示讓使用者「感覺 AI 在做不同的事」
- finally 一定 cancelInterval 防 leak

## 7.8（新）Admin 授權設計

- 對單一管理員的工具，**Bearer token + Firebase Secret Manager** 比完整 OAuth 簡單 100 倍
- 弱密碼（如 `Pirls1234`）+ **5 RPM/IP 速率限制** = 暴破 3.8 年才有 50% 機率（夠用）
- sessionStorage > localStorage（關分頁即清，不留盤）
- `<input type="text" autoComplete="username" hidden>` 滿足瀏覽器密碼管理器規範，避免奇怪自動填入

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/)
