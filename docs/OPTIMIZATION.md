# PIRLS QuestionCraft 部署到 GitHub Pages + Cloud Functions

> 對應檔案：`H:\GemPIRLS`（路線 B 已完成重構）
> 同層搭配：`USAGE.md`

本文件分兩大部分：
1. **§A 第一次部署 7 步上線**
2. **§B 後續優化建議**

---

# §A 第一次部署到 GitHub + Firebase

## A.1 安全前置作業

### Gemini API Key 處理（5 分鐘）

如果你的 `.env` 內 / chat 中曾經出現過 Gemini Key，**先 rotate**：

```bash
# 列出所有 key
gcloud --account=cagooo@gmail.com services api-keys list --filter="displayName~gemini"

# 刪舊 key（替換 KEY_ID）
gcloud --account=cagooo@gmail.com services api-keys delete KEY_ID

# 建新 key 並加 API restriction（只允許 Generative Language API）
gcloud --account=cagooo@gmail.com services api-keys create \
  --display-name="gemini-pirls-questioncraft" \
  --api-target=service=generativelanguage.googleapis.com \
  --format="value(response.keyString)"
```

新 key 字串**直接貼進 Firebase Secret Manager**，不要存在任何檔案：

```bash
firebase --account=ipad@mail2.smes.tyc.edu.tw \
  functions:secrets:set GEMINI_API_KEY \
  --project=pirls-questioncraft
```

CLI 會問 `Enter a value for GEMINI_API_KEY:` → 貼上 → Enter。完成後可用以下指令確認：

```bash
firebase --account=ipad@mail2.smes.tyc.edu.tw \
  functions:secrets:access GEMINI_API_KEY \
  --project=pirls-questioncraft
# 會在終端機印出 key（驗證後請清空 scrollback）
```

### Firebase Service Account（GitHub Actions 用）

GitHub Actions 部署 functions 需要一把 service account JSON。**這把要小心保管**：

```bash
# 建一個 GitHub Actions 專用 service account
gcloud --account=ipad@mail2.smes.tyc.edu.tw iam service-accounts create \
  github-actions \
  --display-name="GitHub Actions Deployer" \
  --project=pirls-questioncraft

# 給最少必要權限
PROJECT=pirls-questioncraft
SA=github-actions@$PROJECT.iam.gserviceaccount.com
for ROLE in \
  roles/cloudfunctions.developer \
  roles/firebase.admin \
  roles/iam.serviceAccountUser \
  roles/cloudbuild.builds.editor \
  roles/run.admin \
  roles/artifactregistry.writer; do
  gcloud --account=ipad@mail2.smes.tyc.edu.tw projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" \
    --role=$ROLE
done

# 產生 JSON key（這把只塞 GitHub Secret，本機不留）
gcloud --account=ipad@mail2.smes.tyc.edu.tw iam service-accounts keys create gh-actions-sa.json \
  --iam-account=$SA

# 推到 GitHub Secret 後立刻刪
gh secret set FIREBASE_SERVICE_ACCOUNT_PIRLS \
  --repo cagoooo/pirls-questioncraft < gh-actions-sa.json
rm -f gh-actions-sa.json
```

> 不想做 GitHub 自動部署 functions 也可以——刪掉 `.github/workflows/deploy-functions.yml`，每次自己手動 `firebase deploy --only functions`。

## A.2 推上 GitHub（5 分鐘）

```bash
cd H:/GemPIRLS

# 切到 main 分支（原本是 master）
git branch -M main

# 建 GitHub repo
gh repo create cagoooo/pirls-questioncraft \
  --public \
  --source=. \
  --remote=origin \
  --description="PIRLS 閱讀素養題組生成站"

git add .
git commit -m "🏗️ 路線 B 重構：GitHub Pages + Cloud Functions"
git push -u origin main
```

**push 前最後一次檢查**：

```bash
git diff --cached --name-only | xargs grep -l "AIzaSy" 2>/dev/null
# 應該沒有任何輸出
```

## A.3 部署 Firestore Rules（30 秒）

```bash
firebase --account=ipad@mail2.smes.tyc.edu.tw \
  deploy --only firestore --project=pirls-questioncraft
```

## A.4 部署 Cloud Functions（5 分鐘）

第一次部署會比較慢，要建 Artifact Registry / Cloud Run service：

```bash
firebase --account=ipad@mail2.smes.tyc.edu.tw \
  deploy --only functions --project=pirls-questioncraft
```

成功後拿到 4 個 URL，例如：

```
✔ functions[generateFromImages(asia-east1)]
   https://generatefromimages-xxxxxxxxxx-de.a.run.app
✔ functions[generateFromText(asia-east1)]    https://...
✔ functions[createSharedQuiz(asia-east1)]   https://...
✔ functions[getSharedQuiz(asia-east1)]      https://...
```

⚠️ Cloud Functions v2 走 Cloud Run，預設網址是 `xxx-de.a.run.app` 而**不是** `cloudfunctions.net`。我們的 `NEXT_PUBLIC_API_BASE` 預設值 `https://asia-east1-pirls-questioncraft.cloudfunctions.net` **可能要調整**。

正確驗證方式：

```bash
gcloud --account=ipad@mail2.smes.tyc.edu.tw functions list \
  --project=pirls-questioncraft --regions=asia-east1
```

如果看到的是 `cloudfunctions.net` 格式，OK；否則把 `.github/workflows/deploy-pages.yml` 的 `NEXT_PUBLIC_API_BASE` 改成正確的 base URL。

> 補充：Firebase Functions v2 同時提供兩種 URL：
> - **Cloud Run URL**: `https://<fn-name>-<hash>-<region>.a.run.app`
> - **Firebase Hosting rewrite**: 透過 Firebase Hosting 代理（不用，本案沒部署 Hosting）
> - **舊版 cloudfunctions.net**: 仍可用，直接重導到 Cloud Run

實作上前端 fetch URL 要逐一對 4 個 functions：對 `generateFromImages` fetch base URL + `/generateFromImages`。我們的 `src/lib/api.ts` 已是這個寫法，所以只要 `NEXT_PUBLIC_API_BASE` 是正確的 base 就好。

## A.5 啟用 GitHub Pages（2 分鐘）

```bash
gh api -X POST /repos/cagoooo/pirls-questioncraft/pages \
  -f "build_type=workflow" \
  -f "source[branch]=main" \
  -f "source[path]=/"
```

或在網頁：[Repo Settings → Pages](https://github.com/cagoooo/pirls-questioncraft/settings/pages) → Source 選 **GitHub Actions**。

第一次 push 後 GitHub Actions 會自動跑 `deploy-pages.yml`。約 3 分鐘後上線：

```
https://cagoooo.github.io/pirls-questioncraft/
```

## A.6 端到端測試

打開 `https://cagoooo.github.io/pirls-questioncraft/`，依序測試：

- [ ] 圖片模式：上傳 1 張小圖（< 1MB）→ 出題成功
- [ ] 文字模式：貼一段 200 字文章 → 出題成功
- [ ] 下載 PDF / Excel / PaGamO 都正常
- [ ] 分享連結：產生 → 開新無痕視窗貼上連結 → quiz 載入成功 → 完成作答 → 下載結果 PDF
- [ ] OG 預覽：在 LINE / FB 貼網址，看預覽圖出來

## A.7 自訂網域（選用，10 分鐘）

如果要把 `pirlss.smes.tyc.edu.tw` 指過來：

1. **GitHub Pages 端**：Repo Settings → Pages → Custom domain 填 `pirlss.smes.tyc.edu.tw` → 勾 Enforce HTTPS。建 `public/CNAME` 檔內容為 `pirlss.smes.tyc.edu.tw`。
2. **DNS 端**：CNAME `pirlss` → `cagoooo.github.io`
3. **GitHub Actions**：把 `.github/workflows/deploy-pages.yml` 內 `NEXT_PUBLIC_BASE_PATH` 改成空字串。
4. **Functions CORS**：`functions/src/index.ts` 的 `cors({ origin: true })` 已放行所有來源，不用改。若要收緊，列出 `allowed`：

   ```ts
   const cors = corsLib({
     origin: [
       'https://cagoooo.github.io',
       'https://pirlss.smes.tyc.edu.tw',
       /^http:\/\/localhost:\d+$/,
     ],
   });
   ```

---

# §B 後續優化建議（依優先序）

## P0 — 必做（安全 / 穩定）

### B.1 Gemini API Key restrictions

部署完 GitHub Pages 後，回到 GCP Console 把 Gemini Key 加 referrer 限制：

```bash
gcloud --account=cagooo@gmail.com services api-keys update KEY_ID \
  --allowed-referrers="https://cagoooo.github.io/*,https://pirlss.smes.tyc.edu.tw/*"
```

但要注意：Cloud Functions **server-to-server** 呼叫不會帶 Referer header。所以對 Gemini Key 的限制要改用 **API restrictions（限定只能呼叫 Generative Language API）**+ **Application restrictions = none**。實際上 Functions 用的是 server side key，最佳做法是把 key 存在 Secret Manager（已做），不另外加 referrer 限制。

### B.2 重新打開 Build Time TS / ESLint 錯誤

`next.config.ts` 目前 `ignoreBuildErrors: true` / `ignoreDuringBuilds: true`。**改成 `false`** 並逐步修錯。

之前已知會冒出來的：

- `src/lib/use-toast` 的 `Toast` 沒 export（多檔有用）→ 補 export 或改 import 名
- `jspdf` API 的 spread argument tuple 錯誤 → 加上 `as any` 或修正型別

### B.3 速率限制

學生上百人併發時 Gemini quota 會爆。建議：

1. 在 `functions/src/index.ts` 加 IP 限流（用 Firestore counter 或 [`@upstash/ratelimit`](https://github.com/upstash/ratelimit)）
2. 前端加 [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) 驗證碼
3. Cloud Functions `setGlobalOptions` 加 `maxInstances: 10` 已做（防被打爆）

### B.4 拆元件

| 檔 | 行數 | 拆法 |
|---|---|---|
| `src/app/page.tsx` | 1067 | 拆 `<InputPanel>`、`<ResultsPanel>`、`<ExportButtons>`、`<ShareDialog>`、`hooks/useGenerateQuestions.ts` |
| `src/components/QuizView.tsx` | 752 | 拆 `<QuizQuestion>`、`<QuizProgress>`、`<QuizResult>` |
| `src/components/FileUpload.tsx` | 522 | 拆 `usePasteImage.ts`、`useDropZone.ts`、`<ImageThumbnail>` |

## P1 — 強烈建議

### B.5 字型瘦身

`public/fonts/` 6 個 .ttf 約 42MB。GitHub Pages 雖然能放，但每個學生每次第一次匯出 PDF 都要載這麼大很慢。

**做法**：只留 Regular + Bold 兩個（~14MB）；或用 Google Fonts CDN 子集。

### B.6 模型版本管理

抽到 functions secret：

```bash
firebase functions:secrets:set GEMINI_MODEL  # 預設值 googleai/gemini-2.5-flash-lite
```

`functions/src/flows/*.ts` 改 `model: process.env.GEMINI_MODEL ?? 'googleai/gemini-2.5-flash-lite'`。

每月 cron check 模型是否還活著（用 `/schedule` skill）。

### B.7 圖片改 Firebase Storage

目前 `imageFilesDataURIs` base64 直接塞進 Firestore，遇 4 張高解析就撞 1 MiB 上限。

升級：上 Firebase Storage 存原圖，Firestore 只存 `gs://` URL。

### B.8 HEIC 支援

iPhone 拍照預設 HEIC，OCR 失敗率高。

```bash
npm install heic2any
```

在 `FileUpload.tsx` 偵測副檔名 → 自動轉 JPEG。

### B.9 OG / metadataBase

`src/app/layout.tsx` 把 `productionDomain` 改成讀 env：

```ts
const productionDomain = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cagoooo.github.io/pirls-questioncraft';
```

### B.10 自動化測試

- **Vitest** 測 `lib/generatePaGamOQuizGroupExcel.ts` 等純函式
- **Playwright** 測首頁三個流程（圖片、文字、QR 分享）
- **functions emulator + supertest** 測 4 個 endpoint

### B.11 監控

- 加 Sentry（前後端各一）
- 用 skill `line-messaging-firebase` 設 LINE 推播 → Functions 出錯通知
- GCP Console **Budget Alert** 設 $5 / $10 警戒

## P2 — 加分項

### B.12 學生作答資料留下

`createSharedQuiz` 時可同時建 `submissions/{quizId}/` collection。學生交卷時 `addDoc`。老師端做 `/dashboard/?id=xxx` 看分數分布。

### B.13 多老師帳號

加 Firebase Auth + Google OAuth（限 `@mail2.smes.tyc.edu.tw` domain）。題庫掛 uid 下。

### B.14 PWA

```bash
npx next-pwa
```

加 manifest + service worker。注意搭配 skill `pwa-cache-bust` 避免 SW 卡舊版。

### B.15 i18n

用 `next-intl` 做多語系 UI。

### B.16 出題品質回饋迴路

老師每題給 👍 / 👎 + 改寫 → 收集 dataset → 改 prompt。

### B.17 UI 細節

- 暗色模式切換
- 「再生一題」（單題重生）
- 「鎖定文章重出題」
- 載入動畫換成有 PIRLS 角色的

---

## 路線圖總覽

```
P0 立刻做
├── A.1   API key rotate + 加限制（5 min）
├── A.2   推 GitHub（5 min）
├── A.3   部署 Firestore rules（30 sec）
├── A.4   部署 Functions（5 min）
├── A.5   啟用 GitHub Pages（2 min）
├── A.6   端到端測試（10 min）
├── B.2   打開 build typecheck / lint（1-3 hr）
└── B.3   速率限制 + Turnstile（1 hr）

P1 兩週內
├── B.4   拆元件（半天）
├── B.5   字型瘦身（30 min）
├── B.6   模型 env 化（30 min）
├── B.7   圖片改 Storage（半天）
├── B.8   HEIC 支援（1 hr）
├── B.9   OG / SEO（30 min）
├── B.10  自動化測試（1 天）
└── B.11  監控告警（半天）

P2 想到再做
└── B.12-17
```

---

## 相關 skill

- `gcp-api-key-secure-create` — 安全 rotate Google API Key
- `firebase-stack-automation` — 多帳號 firebase / gcloud / gh CLI
- `firebase-multi-app-safety` — 加新應用到既有 Firebase 專案
- `firebase-ci-troubleshooter` — CI 失敗排雷
- `github-pages-auto-deploy` — GitHub Pages 啟用
- `pwa-cache-bust` — PWA 快取陷阱
- `og-social-preview-zh` — 中文社群分享預覽
- `line-messaging-firebase` — Functions 出錯時 LINE 推播

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/)
