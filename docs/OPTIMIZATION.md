# PIRLS QuestionCraft 進度表 + 後續優化路線圖

> 對應檔案：`H:\GemPIRLS`
> 最近更新：**2026-05-03**
> 同層搭配：`USAGE.md`

---

# § 1. 目前狀態（live）

## 🌐 線上資源

| 資源 | 連結 | 狀態 |
|---|---|---|
| 網站本體 | https://cagoooo.github.io/pirls-questioncraft/ | ✅ Live |
| GitHub Repo | https://github.com/cagoooo/pirls-questioncraft | ✅ Public |
| Firebase 專案 | `pirls-questioncraft` (asia-east1) | ✅ Blaze |
| Cloud Functions | 4 個 endpoint (`generateFromImages` / `generateFromText` / `createSharedQuiz` / `getSharedQuiz`) | ✅ |
| Firestore | `sharedQuizzes` collection + TTL Policy | ✅ |
| Secret Manager | `GEMINI_API_KEY`（restricted, pipe-set） | ✅ |
| GitHub Actions | `deploy-pages.yml` push 自動部署、`deploy-functions.yml` 手動觸發 | ✅ |

## 🛡️ 安全性現況

| 項目 | 狀態 | 備註 |
|---|---|---|
| Gemini Key Rotate | ✅ 完成 | 舊 key UID `0274483a` 已刪、新 key UID `98604e6e`（API restriction = Generative Language API）|
| Service Account JSON 外洩處理 | ✅ 完成 | leaked SA key 已 revoke、Downloads 已清乾淨 |
| GitHub Secret Scanning | ✅ 通過 | Push 時無 AIzaSy 警告 |
| Cloud Functions Secret 注入 | ✅ 走 Secret Manager + `defineSecret` | 不在程式碼 / .env 內 |
| Firestore Rules | ✅ 全鎖死 | `allow read, write: if false` 走 admin SDK |
| `maxInstances` 護欄 | ✅ 設 10 | 防被打爆 |
| **AI Studio 舊 key 清理** | ⚠️ 待你手動 | `.env` 裡那把 `AIzaSyDY...`（不在我能 list 的 GCP project）需要你親自上 [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) 確認並刪除 |
| **Budget Alert** | ⚠️ 建議補 | 5 USD 警戒，5 分鐘設好（見 §3.B.1）|

## 💰 月度估算

實測費用 **< $0.25 USD/月**（約 7 元台幣）。詳細額度分析見 [前次回覆]。

## 🎨 品牌資產

| 檔案 | 用途 |
|---|---|
| `public/icons/favicon.svg` | 主 favicon（藍紫漸層 + 4 色 PIRLS 條 + sparkle） |
| `public/icons/{favicon-32, apple-touch-icon, icon-192, icon-512}.png` | 多尺寸 PNG |
| `public/images/social-preview.png` | OG 1200×630（FB / LINE 分享卡） |
| `tools/generate-assets.mjs` | 一鍵重生（`npm run generate:assets`） |

---

# § 2. 已完成的工作（2026-05-03）

按時間軸整理當天做了什麼，便於日後 onboarding 新同事 / 翻舊帳：

| # | 項目 | 結果 |
|---|---|---|
| 1 | 撤銷外洩 Service Account JSON 金鑰 | ✅ |
| 2 | 啟用 Firestore API + 建 `(default)` database (asia-east1) | ✅ |
| 3 | 部署 `firestore.rules`（全鎖死） | ✅ |
| 4 | 設 TTL Policy `expiresAt` (sharedQuizzes 自動清過期) | ✅ |
| 5 | 啟用 6 個 GCP API（Functions / Build / Secret Manager / Artifact Registry / Run / Eventarc） | ✅ |
| 6 | `next.config.ts` 改 `output:'export'` + basePath | ✅ |
| 7 | `/quiz/[quizId]` 動態路由 → `/quiz?id=xxx`（Suspense + useSearchParams） | ✅ |
| 8 | 建 `functions/` 目錄 + Genkit + firebase-functions v2 + cors + zod | ✅ |
| 9 | Server Action → 4 個 onRequest endpoint（CORS + GEMINI_API_KEY secret） | ✅ |
| 10 | API Route → Cloud Functions（Firestore admin + payload size guard） | ✅ |
| 11 | `src/lib/api.ts` fetch wrapper + OutputType 集中 | ✅ |
| 12 | 全 repo `from '@/ai/flows/...'` → `from '@/lib/api'` | ✅ |
| 13 | 刪 `src/ai/`、`src/app/api/`、`src/app/quiz/[quizId]/` | ✅ |
| 14 | 移除 frontend deps：genkit、firebase、firebase-admin、patch-package | ✅ |
| 15 | basePath 路徑前綴修正（logo、favicon、OG、PDF 字型） | ✅ |
| 16 | Gemini Key rotate + pipe 進 Secret Manager + 加 API restriction | ✅ |
| 17 | 部署 4 個 Cloud Functions | ✅ |
| 18 | 建 GitHub Repo + push + 啟用 GitHub Pages（Actions 模式） | ✅ |
| 19 | 端到端測試（curl Cloud Function + 前端打開 + FB Debugger） | ✅ |
| 20 | 自製 SVG favicon + 1200×630 OG 卡（Noto Sans TC 嵌入） | ✅ |
| 21 | 撰寫 `tools/generate-assets.mjs`（@napi-rs/canvas） | ✅ |
| 22 | 完整改寫 `docs/USAGE.md` | ✅ |
| 23 | 完整改寫 `docs/OPTIMIZATION.md` | ✅ |
| 24 | 入庫 skill `firebase-studio-static-migration` | ✅ |

---

# § 3. 後續優化路線圖

## 標記說明

- 🔴 **P0**：影響穩定性 / 安全 / 體驗的關鍵問題，**兩週內**處理
- 🟡 **P1**：明顯加分項，**一個月內**有時間就做
- 🟢 **P2**：長期願景 / 重大新功能，看實際用量決定要不要做

---

## P0 — 立刻做 🔴

### B.1 補上 Budget Alert（5 分鐘）

> 雖然我們用量在免費層，但「萬一被 DDoS」的保險只要 5 分鐘。

操作：[Cloud Console → Budgets](https://console.cloud.google.com/billing/0119C9-C416DD-660DE3/budgets) → Create Budget → Scope `pirls-questioncraft` → Amount $5 → 50%/90%/100% email alert → recipient `ipad@mail2.smes.tyc.edu.tw`。

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

修完 build 還能過，未來才不會帶 bug 上線。

### B.4 速率限制 + 防濫用（1 小時）

學生上百人併發 → Gemini quota 爆、Functions 帳單跳。三層防：

1. **前端 reCAPTCHA / Cloudflare Turnstile**（防機器人）
   ```bash
   # functions/ 加驗證
   npm i --prefix functions @google-cloud/recaptcha-enterprise
   ```
2. **Functions IP 限流**：用 Firestore counter，每 IP 每分鐘 5 次出題
3. ✅ `maxInstances: 10` 已做

### B.5 升級 Cloud Functions runtime 到 nodejs22（30 分鐘）

部署 log 看到：

```
! Runtime Node.js 20 was deprecated on 2026-04-30 and will be decommissioned on 2026-10-30
```

修：

```json
// functions/package.json
"engines": { "node": "22" }
// firebase.json
"functions": [{ ..., "runtime": "nodejs22" }]
```

```bash
firebase deploy --only functions
```

> ⚠️ Node 22 對某些 npm 套件可能不相容，部署前先 build 測試。

### B.6 升級 firebase-functions（30 分鐘）

部署 log 警告：

```
! package.json indicates an outdated version of firebase-functions.
  Please upgrade using npm install --save firebase-functions@latest
```

```bash
cd functions
npm install --save firebase-functions@latest
npm run build  # 確認沒 break
```

### B.7 清理 AI Studio 舊 Gemini Key（5 分鐘・你手動）

之前 `.env` 裡那把 `AIzaSyDY8wVCq...` 不在我能管理的 GCP project 裡，可能是 [AI Studio](https://aistudio.google.com/app/apikey) 上拿的。

請你**親自**上去 → 找到那把 key → 刪除。即使沒刪也不影響部署，但留著就是漏洞。

---

## P1 — 兩週到一個月 🟡

### B.8 拆超大元件（半天 - 1 天）

| 檔 | 行數 | 拆法建議 |
|---|---|---|
| `src/app/page.tsx` | 1067 | `<InputPanel>`、`<ResultsPanel>`、`<ExportButtons>`、`<ShareDialog>`、`hooks/useGenerateQuestions.ts` |
| `src/components/QuizView.tsx` | 752 | `<QuizQuestion>`、`<QuizProgress>`、`<QuizResult>`、`hooks/useQuizState.ts` |
| `src/components/FileUpload.tsx` | 522 | `usePasteImage.ts`、`useDropZone.ts`、`<ImageThumbnail>` |

**為什麼重要**：這三個檔加起來 2341 行，AI 對它們做修改的成功率明顯低於小檔。拆完後加新功能、改 bug 速度都會快 2-3 倍。

### B.9 字型瘦身（30 分鐘）

`public/fonts/NotoSansTC-*.ttf` 6 個檔約 **42MB**，但只有 PDF 嵌入時用到。問題：

- 每次老師按下載 PDF，都要載這麼大的字型檔到瀏覽器才能 jsPDF 嵌入
- GitHub Pages 也要把這 42MB 推完才能 deploy

**做法 A（簡單）**：只留 Regular + Bold 兩個檔（~14MB）。

**做法 B（最佳）**：用 [Noto Sans TC subset](https://github.com/notofonts/noto-cjk/tree/main/Sans/Subset)（OTC 子集），同樣 Bold 字重從 7MB 變 1.5MB。

**做法 C（最徹底）**：改用 [pdf-lib](https://pdf-lib.js.org/) + 子集化（subset），最終 PDF 只內嵌實際用到的字 ≈ 50-100KB。但要重寫 `generatePdf.ts`（半天）。

### B.10 模型版本管理 + 自動 health check（1 小時）

歷史 commit 顯示模型棄用造成多次中斷（`gemini-1.5-*` → `2.0-flash` → `2.5-flash-lite`）。

**做法**：

1. 把模型抽到 Firebase secret：
   ```bash
   firebase functions:secrets:set GEMINI_MODEL  # 預設值 googleai/gemini-2.5-flash-lite
   ```
2. `functions/src/flows/*.ts` 改 `model: process.env.GEMINI_MODEL ?? 'googleai/gemini-2.5-flash-lite'`
3. 用 `/schedule` 每月 cron：呼叫 `https://generativelanguage.googleapis.com/v1beta/models?key=$KEY` 比對棄用清單，有警訊就開 GitHub Issue
4. 搭配 skill `gemini-api-integration`

### B.11 圖片移到 Firebase Storage（半天）

目前 `imageFilesDataURIs` base64 直接塞 Firestore，1 MiB doc 上限是真實限制。

**做法**：

```bash
# functions/ 加 Storage SDK
npm i --prefix functions firebase-storage  # 已有，但要設 Storage bucket
```

流程：
1. `createSharedQuiz` 收圖片 → 上傳 Firebase Storage `quiz-images/{quizId}/{n}.jpg`
2. Firestore 只存 `gs://...` URL（或 https URL）
3. `getSharedQuiz` 回傳 URL → 學生端瀏覽器直接從 Storage 拉

**好處**：4 張高解析照片不再撞 1 MiB 上限；Firestore 也省成本。

### B.12 HEIC 圖片支援（1 小時）

iPhone / iPad 拍照預設 HEIC，目前 OCR 失敗率高。

```bash
npm install heic2any
```

`FileUpload.tsx` 偵測副檔名：

```ts
if (file.type === 'image/heic' || file.name.endsWith('.heic')) {
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  file = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
}
```

### B.13 自動化測試（1 天）

```bash
npm install -D vitest @testing-library/react playwright
```

最該優先寫的：

1. `lib/generatePaGamOQuizGroupExcel.ts` 純函式測試（之前 PaGamO 標題對不上踩過雷）
2. Playwright e2e：上傳圖片 → 出題 → 下載 PDF 三條主線
3. Functions emulator + supertest：測 4 個 endpoint 在 payload 過大 / 缺 secret 時的錯誤處理

### B.14 監控 + 告警（半天）

| 工具 | 用途 |
|---|---|
| **Sentry**（前端 + 後端各一） | 抓 runtime error、stack trace |
| **LINE Messaging**（用 skill `line-messaging-firebase`） | Functions 出錯立刻推 LINE 給阿凱老師 |
| **GCP Budget Alert** | 已在 §B.1 |
| **Cloud Logging Alert** | Functions error rate > 5% 推通知 |

### B.15 提升 AI 出題品質（1 小時）

驗收測試發現：當輸入文章太短（< 50 字）時，model **會自由發揮**，把 articleContent 改寫成完全不同的長文，且 8 題全分到同一個 PIRLS 層次。

兩個改進方向：

**A. Prompt 加強（先做）**：

```ts
// functions/src/flows/generate-from-text.ts
prompt: `... 
**🚨 強制規則**：
- 在 articleContent 欄位中，您**必須**回傳完整且未經修改的原始輸入文字
- **禁止改寫、擴寫、或替換**為其他內容
- 若輸入文字太短不足以出 8 題，回傳 \`{"error": "文章太短，請至少提供 200 字"}\` 並停止生成
- 8 題必須**平均**分到 4 個 PIRLS 層次，每層 2 題

提供的文本內容如下：
<ARTICLE>
{{{text}}}
</ARTICLE>
`
```

**B. 模型升級**：`gemini-2.5-flash-lite` → `gemini-2.5-flash`（指令遵守度更高，多 30% 成本但仍在免費層內）。

---

## P2 — 長期願景 / 大功能 🟢

### B.16 學生作答資料儀表板（1-2 天）

目前學生作答 PDF 是 client-side 生成，**老師端拿不到**。

**做法**：

1. 學生交卷時 client 寫 Firestore：
   ```
   submissions/{quizId}/{studentId}: {
     class, seatNumber, name,
     answers: number[],
     correctCount, totalCount,
     pirlsLevelStats: { 'locate & retrieve': {correct, total}, ... },
     submittedAt
   }
   ```
2. 老師端做 `/dashboard/?id=quizId` 頁，列出：
   - 班級成績表格（含個人 PIRLS 四層次答對率）
   - 各題答對率（用 Recharts 已在 deps）
   - 答錯題分布
3. CSV 一鍵匯出

**價值**：把「線上施測」變成「形成性評量分析」，從工具升級成教學助理。

### B.17 多老師帳號（2 天）

目前任何人都能用、quizId 隨機字串。若要做老師私人題庫：

1. Firebase Auth + Google OAuth（限 `@mail2.smes.tyc.edu.tw` 或 `@*.edu.tw` domain）
2. 題庫掛在老師 uid 下：`quizzes/{uid}/{quizId}`
3. 老師端 `/my-quizzes` 看歷史出題
4. 關鍵字搜尋過去出過的題

**價值**：個人題庫持續累積，未來能做「相似題自動推薦」「重出練習版」等。

### B.18 PWA 化（半天）

讓老師能在 iPad / 手機加到主畫面：

```bash
npx next-pwa
```

加 `manifest.json`、Service Worker、離線 fallback。**搭配 skill `pwa-cache-bust` 避免快取地獄**。

### B.19 i18n 多語言（半天）

prompt 與 UI 都已分中英，再做一層：

- 多語言 UI：用 `next-intl`
- 出題支援更多語言（日韓越南）→ 適合東南亞華語學校
- 商業上：可變成「東南亞華語學校教師工具」

### B.20 出題品質回饋迴路（1 天）

- 每題加 👍 / 👎 / 「改寫此題」按鈕
- 收集到 Firestore `quizFeedback` collection
- 每月用 BigQuery / Looker 看高頻 👎 題的 PIRLS 層次分布
- 改 prompt 或微調 model

**長遠**：累積足夠資料後可做 RAG 檢索類似的優質題目作為 few-shot prompt。

### B.21 與既有平台整合（看需求）

- **PaGamO API 直接串接**：取代下載 Excel 再上傳的人工流程
- **Google Classroom API**：老師按一下「指派給三年一班」
- **LINE Notify / LINE Bot**：學生交卷時老師收 LINE 通知（用 skill `line-messaging-firebase`）

### B.22 自訂網域（已準備好，1 小時）

`pirlss.smes.tyc.edu.tw` 指過來：

1. **GitHub Pages**：Repo Settings → Pages → Custom domain → 填 `pirlss.smes.tyc.edu.tw` + 勾 Enforce HTTPS
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

### B.23 UI 細節（1-2 天累積）

- 暗色模式切換（CSS 變數已寫好 `.dark`）
- **「再出一次某題」**（單題重生）
- **「鎖定文章但重出題」**（節省 API 費用）
- 載入動畫換成有 PIRLS 角色的（教學感）
- 學生作答頁加倒數計時器（限時模式）
- 教師現場投影模式（大字 + 全畫面題目）

---

# § 4. 全新功能開發方向（P3 - 願景）🌱

不在原本路線圖內、但用過幾次後可能想做的東西。

## 4.1 從「出題工具」演化成「教學備課平台」

目前定位：**圖片/文字 → PIRLS 題目**。

**升級方向**：
- 一張課本照片 → 出題 + 課程目標 + 教學流程 + 學習單 + 課後反思
- 整合 [skill `lesson-prep`](.) 與 [skill `teaching-cockpit`](.) 變成「PIRLS 課文 → 互動教學駕駛艙」

## 4.2 影音內容出題

現在只支援文字 + 圖片。下一代：

- 上傳 YouTube 連結 / 影片檔 → AI 自動轉文字 → PIRLS 出題
- Gemini 2.5 已支援多模態（影片直接餵）

**情境**：英語聽力測驗、社會課影片導讀、自然觀察影片回饋題。

## 4.3 學生個人化學習路徑

每位學生作答資料累積後：

- 弱項層次（如「評估與批判」常錯）→ 推薦該層次的補強練習
- 用 Vertex AI Embedding 找出「跟你弱點類似的同學常出錯的題」做為練習
- 出 Firestore + Vector Search

## 4.4 班級即時連線測驗（Kahoot 風）

Functions + Firebase Realtime Database：
- 老師開連線房間 → 學生掃 QR Code 加入
- 同步顯示題目 → 倒數答題 → 即時排行榜
- 結束後自動產生班級報告

## 4.5 教師社群題庫

- 老師可以選擇「公開分享某次出題」
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

repo 已 public，加：

- 完整 README + 一鍵部署按鈕
- 提供「fork 此 repo + 改成你學校用」的 SOP
- 投到台灣教育科技開源社群（如 [LearnMode 學習吧](https://www.learnmode.net/)、[均一教育平台](https://www.junyiacademy.org/)）

---

# § 5. 接下來 30 天建議優先順序

不想被太多選項淹沒？這 8 件事按順序做，邊際效益最高：

```
Week 1 (這週)
├── B.1   Budget Alert（5 min）⭐
├── B.7   清 AI Studio 舊 key（5 min）⭐
├── B.2   補 og:url（10 min）
└── B.5   升 Node 22 + B.6 升 firebase-functions（1 hr）

Week 2
├── B.4   速率限制 + Turnstile（1 hr）⭐⭐
└── B.3   打開 build TS / lint（1-3 hr）

Week 3
├── B.15  改 prompt 強化「不改寫原文」+ 升模型（1 hr）⭐⭐
└── B.9   字型瘦身（30 min）

Week 4
├── B.11  圖片改 Firebase Storage（半天）
├── B.14  監控 + LINE 告警（半天）⭐
└── B.22  上自訂網域 pirlss.smes.tyc.edu.tw（1 hr）⭐
```

⭐ = 個人推薦最有感的

---

# § 6. 配套 skill 串接清單

當下次想做某件事，可以直接在 chat 中提到對應關鍵字，Claude 會自動觸發對應 skill：

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
| 重新跑一次 Firebase Studio→GitHub Pages 遷移（這次學到的精華） | `firebase-studio-static-migration`（新建立的）|
| 排程任務（每月查模型棄用 / 每週 metric review） | `schedule` |

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/)
