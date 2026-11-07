# PIRLS 閱讀題組小幫手（Chrome 擴充套件）

在任何網頁**框選截圖**、**讀取整頁全文**或**反白文字**，用自己的免費 Gemini 金鑰產生 PIRLS 四層次閱讀理解題組，檢查修改後下載 PaGamO 批量上傳檔。

> 目前版本：v0.3.0（截圖／讀取全文／反白文字出題、逐題修改、一鍵送到 PaGamO 批量上傳頁）

## 一、安裝（第一次約 5 分鐘）

1. 下載 ZIP，**解壓到固定的位置**，例如 `D:\PIRLS擴充套件`。
   ⚠️ 之後**不要搬動或改名**這個資料夾。Chrome 是用資料夾位置認得這個擴充套件，搬家會被當成新的，金鑰與設定都會不見。
2. Chrome 網址列輸入 `chrome://extensions`，打開右上角「**開發人員模式**」。
3. 按「**載入未封裝項目**」，選剛剛解壓的資料夾（裡面要直接看得到 `manifest.json`）。
4. 按 Chrome 右上角的拼圖圖示 🧩，把「PIRLS 閱讀題組小幫手」**釘選**到工具列。
5. 會自動打開設定頁（沒有的話，在工具列圖示上按右鍵 →「設定（Gemini 金鑰）」），照畫面申請並貼上自己的 Gemini 金鑰，按「儲存並測試」。

### 申請免費 Gemini 金鑰

1. 打開 <https://aistudio.google.com/apikey>，用自己的 Google 帳號登入。
2. 按「Create API key」，複製那串字（通常以 `AIza` 或 `AQ.` 開頭）。
3. 貼到擴充套件設定頁 →「儲存並測試」→ 看到綠色「可以使用」就完成。

## 二、使用

1. 打開要出題的網頁（電子書、PDF、新聞、學習單）。
2. 按工具列的 PIRLS 圖示 →「框選這個畫面」，或按快捷鍵 **Alt+Shift+P**。
3. 拖曳框出文章範圍（Enter＝整個畫面、Esc＝取消）。文章跨頁就捲下去再框一次。
4. 按提示框的「前往工作台出題」→ 選 8／10 題、中文／英文 →「開始出題」。
5. **逐題檢查、修改**：題幹、選項、正解、解析、PIRLS 層次都能直接改，改完自動儲存。
6. 按「**🚀 送到 PaGamO（題組版）**」：會先下載一份備份，接著自動打開 PaGamO 批量上傳頁、選好「題組」、放好檔案。確認後按頁面上閃爍的「**上傳**」就完成（擴充套件不會替你按上傳）。
   - 還沒登入 PaGamO：先登入，登入後會自動回到批量上傳頁並放好檔案（10 分鐘內有效）。
   - 自動放檔沒成功：工作台下方有「只下載檔案」和手動匯入步驟。

其他用法：

- **讀取這頁全文出題**（部落格、新聞最好用）：按工具列圖示 →「📖 讀取這頁全文」，或在網頁空白處按右鍵 →「讀取這頁全文出 PIRLS 題組」。會自動去掉選單、側欄、廣告、留言，只留下正文；文章超過 4,000 字會提醒你刪掉不需要的段落。
- **反白文字出題**：在網頁反白一段文章 → 按右鍵 →「用這段文字出 PIRLS 題組」。
- **貼上圖片**：在工作台按 Ctrl+V 貼上圖片，或把圖片檔拖進來。
- **PDF 檢視器等無法框選的頁面**：會先截整個畫面，到工作台按 ✂️ 裁切。

## 三、金鑰安全

- 金鑰只存在這台電腦的 Chrome 裡，**不在資料夾裡**，所以把資料夾壓成 ZIP 分享給同事，不會把金鑰送出去。
- 金鑰只會送到 Google Gemini（`generativelanguage.googleapis.com`），不會送到其他地方。
- **共用電腦用完請到設定頁按「清除金鑰」**。
- 建議到 [Google Cloud 憑證頁](https://console.cloud.google.com/apis/credentials) 把金鑰的「API 限制」設成只允許 Generative Language API。
- 依 Google 條款，免費方案送出的內容可能被用來改進產品：**不要截有學生姓名、成績等個資的畫面**。

## 四、更新到新版

1. 下載新版 ZIP，**解壓覆蓋到原本同一個資料夾**。
2. 到 `chrome://extensions`，在這個擴充套件上按 ⟳（重新載入）。

同一個位置就會保留金鑰與設定。

## 五、常見問題

| 狀況 | 怎麼辦 |
|---|---|
| 出現「免費額度暫時用完」 | 等一分鐘再試；一直出現代表今天用完了，明天自動恢復 |
| 出題太慢或想要更準 | 預設用最快的 Flash-Lite；想要截圖辨識更準可到設定頁改選 Flash（比較慢） |
| 出現「模型已停用」 | 到設定頁按「儲存並測試」，會自動換成可用的模型 |
| 重開 Chrome 後擴充套件不見了 | 確認資料夾沒有被搬動、改名或刪除；重新「載入未封裝項目」 |
| 學校電腦沒有「開發人員模式」開關 | 可能被學校的電腦管理政策鎖住，請洽資訊組 |
| 截圖框選沒有反應 | Chrome 設定頁、擴充功能商店、新分頁不允許截圖，換一般網頁再試；也可以改按快捷鍵 Alt+Shift+P。若仍沒反應，到 `chrome://extensions` 看這個擴充套件有沒有紅色「錯誤」按鈕，截圖給資訊組 |
| 讀取全文抓到奇怪的內容 | 少數網站版面特殊，可以在工作台的文字框直接刪改；文章是圖片的頁面請改用框選截圖 |

## 給開發者

- 純 JavaScript、免打包；`vendor/xlsx.full.min.js` 是 SheetJS 0.18.5（Apache-2.0，授權見 `vendor/xlsx-LICENSE.txt`）；`vendor/Readability.js` 是 Mozilla Readability 0.6.0（Firefox 閱讀模式的正文擷取程式，Apache-2.0，授權見 `vendor/readability-LICENSE.md`）。
- PaGamO 格式移植自網站 `src/lib/buildPaGamOWorkbook.ts`；範本表頭由 `npm run sync:extension` 從 `src/lib/pagamoTemplates.json` 同步。
- 出題提示詞移植自 `functions/src/flows/`，**修改後端提示詞時要同步改 `lib/prompt.js`**（`npm test` 會檢查兩邊是否一致）。
- 測試：`npm test`（格式與提示詞一致性）、`python -X utf8 tools/test-extension-e2e.py`（Playwright 實際載入擴充套件操作，含模擬 PaGamO 批量上傳頁，60 項）。

---

Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/school/index.php?department_id=2&zone_id=0&page_id=2&content_id=11&type=news&from_op=all_news#a5)・桃園市龍潭區石門國民小學
