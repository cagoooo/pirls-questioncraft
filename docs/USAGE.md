# PIRLS QuestionCraft 詳細使用說明

> 桃園市石門國小資訊組 阿凱老師 設計
> 本檔案為 `H:\GemPIRLS` 專案的完整操作手冊與技術說明書。
> **架構**：路線 B — 前端 GitHub Pages（純靜態）+ 後端 Firebase Cloud Functions（asia-east1）+ Firestore

---

## 1. 專案是什麼

**PIRLS QuestionCraft（PIRLS 閱讀素養題組生成站）** 是一個 AI 輔助出題工具，把任意一篇文章或課文圖片，自動轉成符合 **PIRLS 國際閱讀素養評量四層次** 的選擇題，支援多種匯出與線上施測：

| PIRLS 層次 | 中文對照 | 8 題模式 | 10 題模式 |
|---|---|---|---|
| Locate & Retrieve | 訊息提取 | 2 | 3 |
| Make Straightforward Inferences | 直接推論 | 2 | 3 |
| Interpret & Integrate | 詮釋整合 | 2 | 2 |
| Evaluate & Critique | 評估批判 | 2 | 2 |

線上網址（GitHub Pages）：`https://cagoooo.github.io/pirls-questioncraft/`

---

## 2. 架構總覽

```
github.com/cagoooo/pirls-questioncraft
│
├─ 前端 (Next.js 15 static export)
│   └─ GitHub Actions 自動 build → GitHub Pages 部署
│       └─ https://cagoooo.github.io/pirls-questioncraft/
│
└─ 後端 (Firebase Cloud Functions, asia-east1)
    ├─ generateFromImages   (POST)  AI 圖片出題
    ├─ generateFromText     (POST)  AI 文字出題
    ├─ createSharedQuiz     (POST)  存共享測驗到 Firestore
    └─ getSharedQuiz        (GET)   依 quizId 取共享測驗
        └─ Firestore (sharedQuizzes collection, TTL 1hr)
```

| 層 | 技術 | 版本 |
|---|---|---|
| Frontend Framework | Next.js（App Router）`output: 'export'` | 15.5.9 |
| UI | React 19 + Tailwind + shadcn/ui (Radix) | — |
| Backend | Firebase Cloud Functions v2 (Node 20) | 6.x |
| AI | Genkit + Gemini 2.5 Flash-Lite | genkit 1.33+ |
| 資料庫 | Firestore (asia-east1, native mode) | — |
| 字型 / Excel / PDF | Noto Sans TC + xlsx + jsPDF | — |
| QR Code | qrcode.react | — |
| CI/CD | GitHub Actions（Pages + Functions） | — |

---

## 3. 目錄結構（路線 B）

```
H:\GemPIRLS\
├── .env.example              # env 範本，可 commit
├── .gitignore
├── .github/workflows/
│   ├── deploy-pages.yml      # 前端 → GitHub Pages
│   └── deploy-functions.yml  # 後端 → Cloud Functions（選用）
├── docs/
│   ├── USAGE.md              # 本檔
│   ├── OPTIMIZATION.md       # 部署與優化建議
│   ├── blueprint.md          # 原始設計藍圖
│   └── PaGamO_批量上傳範例_題組.xlsx
├── firebase.json             # firestore + functions 部署設定
├── firestore.rules           # 全鎖死，只走 Cloud Functions
├── firestore.indexes.json    # 空索引
├── functions/                # 🔥 Cloud Functions 程式碼
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # 4 個 onRequest endpoint + CORS
│       ├── genkit.ts         # Genkit 初始化
│       └── flows/
│           ├── generate-from-images.ts
│           └── generate-from-text.ts
├── public/
│   ├── fonts/NotoSansTC-*.ttf  # 6 種字重，jsPDF 嵌入用
│   └── images/{logo,social-preview}.png
├── src/                       # 前端 (純 client-side)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx           # 首頁主控台
│   │   └── quiz/page.tsx      # /quiz?id=xxx 學生作答頁
│   ├── components/
│   │   ├── FileUpload.tsx, QuestionCard.tsx, QuizView.tsx, PirlsLogo.tsx
│   │   └── ui/*               # shadcn/ui 元件
│   ├── hooks/
│   │   ├── use-toast.ts, use-mobile.tsx
│   └── lib/
│       ├── api.ts             # 🔥 fetch wrapper：前端 → Cloud Functions
│       ├── utils.ts
│       ├── generatePdf.ts, generateQuizResultsPdf.ts
│       ├── generateExcel.ts
│       ├── generatePaGamOExcel.ts
│       └── generatePaGamOQuizGroupExcel.ts
├── next.config.ts             # output:'export' + basePath:/pirls-questioncraft
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 4. 前置需求

| 項目 | 必要 | 備註 |
|---|---|---|
| Node.js | **v20+** | 前端與 functions 都用 |
| Firebase CLI | ✅ | `npm i -g firebase-tools`，已 `firebase login --reauth` |
| gcloud CLI | ✅ | 設定 IAM 與 API 啟用用 |
| Git + GitHub CLI (gh) | ✅ | 推 repo 與 GitHub Pages 啟用 |
| Gemini API Key | ✅ | 存於 Firebase Secret Manager |
| Firebase 專案 | ✅ | `pirls-questioncraft` 已建好 |
| Firestore | ✅ | asia-east1，已建好，TTL Policy 已設 |

---

## 5. 安裝與啟動

### 5.1 第一次安裝

```bash
git clone https://github.com/cagoooo/pirls-questioncraft.git
cd pirls-questioncraft
npm install                          # 前端
npm --prefix functions install       # 後端
cp .env.example .env.local           # 建本地 env（內容看下節）
```

### 5.2 環境變數

`.env.local`（gitignored）：

```env
# 開發時用本機 emulator：http://127.0.0.1:5001/pirls-questioncraft/asia-east1
# 連線到正式 Functions：
NEXT_PUBLIC_API_BASE=https://asia-east1-pirls-questioncraft.cloudfunctions.net
```

`GEMINI_API_KEY` **不要放在 .env**，改用 Firebase Secret Manager：

```bash
firebase --account=ipad@mail2.smes.tyc.edu.tw \
  functions:secrets:set GEMINI_API_KEY \
  --project=pirls-questioncraft
# CLI 提示 "Enter a value for GEMINI_API_KEY:" 時貼上 key
```

### 5.3 啟動本地開發

| 命令 | 用途 | 預設 port |
|---|---|---|
| `npm run dev` | 前端 Next dev server | 9002 |
| `npm --prefix functions run serve` | Functions emulator | 5001 |
| `npm run build` | 前端 static export → `out/` | — |
| `npm run build:functions` | Functions TypeScript 編譯 | — |

**雙開兩個終端機**：一個跑 `npm run dev`，一個跑 functions emulator。或全程用線上 functions（方便但每次都呼叫雲端，會慢一些）。

### 5.4 部署

| 命令 | 動作 |
|---|---|
| `firebase deploy --only functions` | 部署 4 個 Cloud Functions |
| `firebase deploy --only firestore` | 部署 Firestore rules + indexes |
| `git push origin main` | 觸發 GitHub Actions → Pages |

詳細步驟見 `OPTIMIZATION.md`。

---

## 6. 使用情境流程（給老師用）

### 流程 A：上傳圖片出題

1. 開 `https://cagoooo.github.io/pirls-questioncraft/`
2. 切到「圖片」分頁，拖放 / 點擊 / **Ctrl+V** 貼上截圖（最多 4 張）
3. 圖片自動壓縮到長邊 1600px、JPEG 0.85
4. 選 **8 題 / 10 題** 與 **中文 / 英文** 模式
5. 按「生成 PIRLS 題目」→ 前端 fetch `generateFromImages` Cloud Function
6. AI 完成 OCR、重組分段、生成標題、出題
7. 顯示文章 + 題卡列表（PIRLS 層次 + 解題引導但不洩答）

### 流程 B：直接貼文字出題

1. 切到「文字」分頁，貼整篇文章
2. 同樣選擇模式 → 生成 → 走 `generateFromText` Cloud Function
3. `articleContent` 原文回傳，不會被改寫

### 流程 C：匯出與分發

| 按鈕 | 產出 | 適用 |
|---|---|---|
| 下載 PDF | 含文章 + 題目（嵌入 Noto Sans TC） | 印紙本 |
| 下載 Excel | 一般題庫 | 自己整理 |
| 下載 PaGamO（單題） | PaGamO 平台單題格式 | 線上施測 |
| 下載 PaGamO（題組） | PaGamO 題組格式 | 文章配多題 |
| 分享連結 / QR Code | `/quiz/?id=xxx`，1 小時 TTL | 學生即時作答 |
| 進入測驗模式 | 站內 `<QuizView>` | 教學現場示範 |

### 流程 D：學生線上作答（`/quiz/?id=xxx`）

1. 老師按「分享」→ 前端 fetch `createSharedQuiz` → 拿到 quizId
2. 學生掃 QR / 開連結，前端 fetch `getSharedQuiz?quizId=xxx`
3. 學生填**班級 / 座號 / 姓名** → 進入 `QuizView` 作答
4. 看結果 → 可下載個人作答 PDF（client-side 生成）

---

## 7. AI Flow 設計（已搬到 Cloud Functions）

兩個 flow 共用同一個 Output schema：

```ts
GeneratePirlsQuestionsOutput = {
  title: string;
  articleContent: string;
  questions: Array<{
    question, options[4], correctAnswerIndex,
    explanation,                 // 不洩答
    pirlsLevel: 4 種列舉之一
  }>
}
```

模型：`googleai/gemini-2.5-flash-lite`。檔案：

- `functions/src/flows/generate-from-images.ts`（圖片 OCR + 重組 + 出題）
- `functions/src/flows/generate-from-text.ts`（純文字出題）

歷史教訓：`gemini-1.5-*` 已棄用，改 `gemini-2.0-flash`，最終定 `gemini-2.5-flash-lite`。**改模型前一定先 list 可用模型**：

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$KEY" | jq '.models[].name'
```

---

## 8. 環境變數一覽

| 位置 | 變數 | 用途 |
|---|---|---|
| 前端（build 時） | `NEXT_PUBLIC_API_BASE` | Cloud Functions URL（GitHub Actions 注入） |
| 前端（build 時） | `NEXT_PUBLIC_BASE_PATH` | GitHub Pages 子路徑（預設 `/pirls-questioncraft`） |
| 後端（Cloud Functions） | `GEMINI_API_KEY` | 走 Firebase Secret Manager，不入 repo |

---

## 9. 已知限制

1. **Cold start 延遲**：第一次出題會慢 5-15 秒（Cloud Functions 從睡眠喚醒）。
2. **Firestore 1 MiB doc 上限**：4 張高解析照片可能撞上限，目前 900 KiB 預檢會回 413。
3. **GitHub Pages 子路徑**：URL 永遠帶 `/pirls-questioncraft/` 前綴，除非掛自訂網域（見 `OPTIMIZATION.md §A.7`）。
4. **`next.config.ts` 仍開 `ignoreBuildErrors`**：易把 bug 帶上線，建議逐步修掉（見 §B.2）。
5. **單頁元件過大**：`page.tsx` 1067 行、`QuizView` 752 行、`FileUpload` 522 行。
6. **Gemini quota 已有限流保護**：`generateFromImages` / `generateFromText` 目前每 IP 每小時最多 5 次；若正式大量公開，仍建議搭配 GCP Budget Alert 與後台用量週報觀察。
7. **無自動測試**。
8. **OG 域名硬寫死** `pirlss.smes.tyc.edu.tw`（`layout.tsx`），自訂網域時需改。

---

## 10. 常見問題排查

| 症狀 | 對應 |
|---|---|
| 出題卡很久才回應 | Cold start，第一次喚醒 5-15 秒；後續會快 |
| `Failed to fetch` / CORS error | 確認 `NEXT_PUBLIC_API_BASE` 對；Functions 已部署；`functions/src/index.ts` 的 CORS 設定生效 |
| `NOT_FOUND: Model 'gemini-...'` | 模型棄用，改最新；改 `functions/src/flows/*.ts` 的 model 字串 |
| 分享連結 404 | 1 小時 TTL 已過 / 圖片過大被 413 擋下 / Functions 未部署 |
| GitHub Actions build 失敗 | 看 Actions log；通常是 `NEXT_PUBLIC_*` env 沒設或 npm install 失敗 |
| Pages 站打開白屏 | (1) basePath 不對 — `next.config.ts` 與實際 repo 名要一致；(2) 路由用 `/quiz/?id=` 而不是 `/quiz?id=`；(3) 強制 reload 清快取（見 skill `pwa-cache-bust`） |
| `firebase deploy` 卡很久 | 第一次部署要建 Cloud Run service / Artifact Registry，等 3-5 分鐘正常 |
| `Permission 'cloudbuild.builds.create' denied` | 沒啟用 Cloud Build API；`gcloud services enable cloudbuild.googleapis.com` |

---

## 11. 授權與貢獻

- 作者：桃園市石門國小資訊組 阿凱老師（`ipad@mail2.smes.tyc.edu.tw`）
- 用途：教育用途，歡迎其他老師 fork 二創
- 字型：[Noto Sans TC](https://fonts.google.com/noto/specimen/Noto+Sans+TC)（SIL OFL 1.1）
- AI：Google Gemini API（須遵守 Google 使用條款）

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/)
