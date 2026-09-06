# Firebase Studio

🌐 **線上使用：[PIRLS 閱讀理解生成站 PRO](https://cagoooo.github.io/pirls-questioncraft/)**

> 📌 **目前版本：v0.2.0**（依據 `package.json`）

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

---

<!-- BEGIN:PROJECT_GUIDE -->
## 專案導覽

PIRLS 閱讀素養題組生成站｜AI 輔助 PIRLS 四層次選擇題自動出題工具

- 專案定位：教育科技／教學支援專案
- Repository：`cagoooo/pirls-questioncraft`
- 可見性：公開
- 主要技術：TypeScript、React、Next.js、Tailwind CSS、Firebase
- 線上入口：<https://cagoooo.github.io/pirls-questioncraft/>

### 可以怎麼應用

- 教師備課、課堂示範與學生自主練習
- 依年級、領域或校本課程替換內容，建立可重複使用的教學版本
- 作為教育科技活動、學習成效觀察或 AI 輔助教學的原型

這些是依目前專案定位整理的延伸方向，不代表所有情境都已內建完成；實作前請先確認現有功能與資料格式。

### 技術與專案結構

- `README.md`
- `docs`
- `firebase.json`
- `functions`
- `package.json`
- `public`
- `src`

檔案結構會隨版本演進；若本節與程式碼不一致，以目前預設分支的原始碼為準。

### 本機執行

```bash
npm install
# dev
npm run dev
# start
npm run start
# build
npm run build
# lint
npm run lint
```
請以 `package.json` 的 `scripts` 為準；若專案需要雲端服務，請先建立自己的環境變數與測試專案。

### 給 AI Agent 的接手指南

1. 先閱讀本 README、`AGENTS.md`（若有）、套件腳本與部署設定。
2. 先辨識教材、題庫、提示詞或設定資料的單一來源，避免只改畫面上的副本。
3. 調整內容時維持適齡、可讀性、無障礙與個資保護。
4. 修改後驗證教師操作流程、學生操作流程，以及桌機、平板、手機的可用性。
5. 不要捏造尚未存在的功能；README 與實作有落差時，應同時更新文件。
6. 提交前只納入本次任務檔案，並記錄實際執行過的驗證。

### 安全與資料注意事項

- 不要提交 `.env`、服務帳號、API 金鑰、token、學生個資或正式環境匯出資料。
- 使用 Firebase、Supabase、Google API 或其他雲端服務時，請建立自己的測試專案並套用最小權限。
- 若要公開衍生作品，請先確認程式碼、圖片、音訊、字型與教材內容的授權。

### 貢獻與客製化

歡迎依教學現場、活動或工作流程需求進行 fork／客製化。建議在變更說明中交代使用情境、主要修改、測試方式，以及是否影響資料格式或部署設定。
<!-- END:PROJECT_GUIDE -->
