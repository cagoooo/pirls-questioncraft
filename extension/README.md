# PIRLS 閱讀題組小幫手（Chrome 擴充套件）

在任何網頁**框選截圖**、**讀取整頁全文**或**反白文字**，用自己的免費 Gemini 金鑰產生 PIRLS 四層次閱讀理解題組，檢查修改後下載 PaGamO 批量上傳檔。

> ➕ **加到 Chrome（免費，Chrome 線上應用程式商店）：<https://chromewebstore.google.com/detail/cfbehdinangicblpbnockoofeccmoidp>**
>
> 📘 圖文安裝與使用說明：<https://cagoooo.github.io/pirls-questioncraft/extension/>
>
> 目前版本：v0.5.1（截圖／讀取全文／反白文字出題、逐題修改、一鍵送到 PaGamO 批量上傳頁）

## 一、安裝（第一次約 3 分鐘）

1. 用電腦版 Chrome 打開上面的**商店頁**。
2. 按「**加到 Chrome**」，跳出確認視窗時按「**新增擴充功能**」。
3. 按 Chrome 右上角的拼圖圖示 🧩，把「PIRLS 閱讀題組小幫手」**釘選**到工具列。
4. 會自動打開設定頁（沒有的話，在工具列圖示上按右鍵 →「設定（Gemini 金鑰）」），照畫面申請並貼上自己的 Gemini 金鑰，按「**儲存並測試**」。

不用下載 ZIP、不用打開開發人員模式。學校電腦打不開商店時，請看最後的「進階：手動安裝」。

### 申請免費 Gemini 金鑰

1. 打開 <https://aistudio.google.com/apikey>，用**個人 Gmail 帳號**登入。**不要用學校信箱**，用個人帳號申請才能使用免費額度。
2. 按畫面上的「Create API key」（建立金鑰）按鈕，複製那串字（通常以 `AIza` 或 `AQ.` 開頭）。
3. 貼到擴充套件設定頁 →「儲存並測試」→ 看到綠色「可以使用」就完成。

## 二、使用

1. 打開要出題的網頁（電子書、PDF、新聞、學習單）。
2. 按工具列的 PIRLS 圖示 →「**📷 截取這個畫面**」，或按快捷鍵 **Alt+Shift+P**。
3. 會自動跳到「工作台」分頁並打開裁切視窗：拖曳框出文章範圍。
   - 文章只有這一段：按「**✨ 裁切並開始出題**」，直接開始出題。
   - 文章還有下一段：按「裁切（還要截下一段）」，回到原網頁捲下去，再按一次圖示。
4. 出題前可以先選 8／10 題、中文／英文（會記住上次的選擇）。
5. **逐題檢查、修改**：題幹、選項、正解、解析、PIRLS 層次都能直接改，改完自動儲存。
6. 按「**🚀 送到 PaGamO（題組版）**」：會先下載一份備份，接著自動打開 PaGamO 批量上傳頁、選好「題組」、放好檔案。確認後按頁面上閃爍的「**上傳**」就完成（擴充套件不會替你按上傳）。
   - **選項順序預設「隨機」**：每位學生看到的選項順序都不同，不能靠記「答案是第幾個」猜題。少數題目需要固定順序（例如選項是「以上皆是」）時，可在匯出區切到「固定」。
   - 還沒登入 PaGamO：先登入，登入後會自動回到批量上傳頁並放好檔案（10 分鐘內有效）。
   - 自動放檔沒成功：工作台下方有「只下載檔案」和手動匯入步驟。

其他用法：

- **讀取這頁全文出題**（部落格、新聞最好用）：按工具列圖示 →「📖 讀取這頁全文」，或在網頁空白處按右鍵 →「讀取這頁全文出 PIRLS 題組」。會自動去掉選單、側欄、廣告、留言，只留下正文；文章超過 4,000 字會提醒你刪掉不需要的段落。
- **反白文字出題**：在網頁反白一段文章 → 按右鍵 →「用這段文字出 PIRLS 題組」。
- **貼上圖片**：在工作台按 Ctrl+V 貼上圖片，或把圖片檔拖進來。

## 三、金鑰安全

- 金鑰只存在這台電腦的 Chrome 裡，**不會寫進任何資料夾，也不會送到開發者的伺服器**。
- 金鑰只會在出題時送到 Google Gemini（`generativelanguage.googleapis.com`），不會送到其他地方。
- **共用電腦用完請到設定頁按「清除金鑰」**。
- 建議到 [Google Cloud 憑證頁](https://console.cloud.google.com/apis/credentials) 把金鑰的「API 限制」設成只允許 Generative Language API。
- 依 Google 條款，免費方案送出的內容可能被用來改進產品：**不要截有學生姓名、成績等個資的畫面**。

## 四、更新到新版

從商店安裝的，**Chrome 會在背景自動更新**，不用下載 ZIP、不用重新載入，金鑰與設定都會保留。新版要先通過商店審核才會送出，所以網站上的更新紀錄可能比電腦上的版本早幾天出現。

## 五、常見問題

| 狀況 | 怎麼辦 |
|---|---|
| 學校電腦打不開商店，或「加到 Chrome」按不下去 | 學校的電腦管理設定可能限制安裝擴充套件，請洽資訊組協助開放；在那之前可以先用網站版出題 |
| 以前用 ZIP 裝過，要換成商店版 | 到 `chrome://extensions` 移除舊的手動安裝版，再從商店「加到 Chrome」，重新貼一次金鑰（兩個是不同的擴充套件，金鑰不會搬過去，也不要兩個同時開著） |
| 家裡、另一台電腦也想用 | 每台電腦的 Chrome 都要加一次；Chrome 有登入同步時小幫手可能自動出現，但金鑰不會同步，要再貼一次 |
| 出現「免費額度暫時用完」 | 等一分鐘再試；一直出現代表今天用完了，明天自動恢復 |
| 出題太慢或想要更準 | 預設用最快的 Flash-Lite；想要截圖辨識更準可到設定頁改選 Flash（比較慢） |
| 出現「模型已停用」 | 到設定頁按「儲存並測試」，會自動換成可用的模型 |
| 按「截取這個畫面」沒反應 | v0.4.0 起任何失敗都會跳到工作台顯示原因。Chrome 設定頁、新分頁、擴充功能商店不允許截圖，請換到要出題的網頁。仍有問題：到設定頁最下方「錯誤紀錄本」按「複製紀錄」貼給資訊組 |
| 讀取全文抓到奇怪的內容 | 少數網站版面特殊，可以在工作台的文字框直接刪改；文章是圖片的頁面請改用框選截圖 |

## 六、進階：手動安裝（只有商店被擋或需要離線時才用）

手動安裝版**不會自動更新**，而且要打開 Chrome 的「開發人員模式」，很多學校電腦會擋住這個設定。一般老師請用上面的商店安裝。

1. 到[說明頁](https://cagoooo.github.io/pirls-questioncraft/extension/#manual)最下方「進階：手動安裝」下載 ZIP，**解壓到固定的位置**，例如 `D:\PIRLS閱讀題組小幫手`，之後**不要搬動或改名**（Chrome 用資料夾位置認得它，搬家會被當成新的，金鑰與設定都會不見）。
2. Chrome 網址列輸入 `chrome://extensions`，打開右上角「開發人員模式」，按「載入未封裝項目」，選剛剛解壓的資料夾（裡面要直接看得到 `manifest.json`）。
3. 照自動打開的設定頁貼上金鑰。

**手動安裝版的更新**：有新版時，工作台上方會出現「🆕 有新版本」提醒（商店版不會出現，因為 Chrome 會自動更新）。下載新版 ZIP，解壓覆蓋到原本同一個資料夾，再到 `chrome://extensions` 在這個擴充套件上按 ⟳。

| 手動安裝狀況 | 怎麼辦 |
|---|---|
| 重開 Chrome 後擴充套件不見了 | 確認資料夾沒有被搬動、改名或刪除；重新「載入未封裝項目」 |
| 沒有「開發人員模式」開關 | 被學校的電腦管理設定鎖住，這台電腦無法手動安裝，請洽資訊組 |

## 給開發者

- 純 JavaScript、免打包；`vendor/xlsx.full.min.js` 是 SheetJS 0.18.5（Apache-2.0，授權見 `vendor/xlsx-LICENSE.txt`）；`vendor/Readability.js` 是 Mozilla Readability 0.6.0（Firefox 閱讀模式的正文擷取程式，Apache-2.0，授權見 `vendor/readability-LICENSE.md`）。
- PaGamO 格式移植自網站 `src/lib/buildPaGamOWorkbook.ts`；範本表頭由 `npm run sync:extension` 從 `src/lib/pagamoTemplates.json` 同步。
- 出題提示詞移植自 `functions/src/flows/`，**修改後端提示詞時要同步改 `lib/prompt.js`**（`npm test` 會檢查兩邊是否一致）。
- 測試：`npm test`（格式與提示詞一致性）、`python -X utf8 tools/test-extension-e2e.py`（Playwright 實際載入擴充套件操作，含模擬 PaGamO 批量上傳頁，78 項）。
- 發布：改 `manifest.json` 版本時，同時在 `CHANGELOG.json` 最前面加一筆（版本不一致會讓建置失敗）。商店版要另外打包上傳到 Chrome 開發人員資訊主頁送審，通過後 Chrome 會自動更新老師的擴充套件。
- 網站部署時 `tools/pack-extension.mjs` 會自動打包手動安裝用的 ZIP 與 `version.json`。`lib/update.js` 只在**手動安裝版**（沒有商店的 `update_url`、ID 不是 `cfbehdinangicblpbnockoofeccmoidp`）讀 `version.json` 顯示新版提醒；商店版不查網站版號。
- 安裝說明頁的截圖：`python -X utf8 tools/capture-extension-guide.py` 重新產生。

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5)・桃園市龍潭區石門國民小學
