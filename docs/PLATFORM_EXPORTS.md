# 多平台匯出使用說明

產生題組後點「更多平台／閱讀素材」。Wayground、Kahoot、LoiLoNote 可下載試算表；Wordwall 提供人工貼題準備表與逐欄複製。PaGamO 一般版與題組版仍保留主畫面按鈕。

下載後請先在目標平台核對匯入預覽的題數、選項、正確答案與解析。這些檔案不會自動帶入共用文章或原圖；請一併下載「學生閱讀素材 PDF」。該 PDF 只接收閱讀來源，不接收題目與答案資料，圖片模式保留原圖。原始圖片若本身含解答，仍需老師先檢查原教材。

「教師題庫備份」保存原始題組及目前匯出副本，含解析與 PIRLS 層次。JSON 不內嵌原圖，原圖請另保存閱讀素材 PDF。主畫面的教師 PDF 含解答。

## 格式與限制

| 平台 | 排列 | 注意事項 |
|---|---|---|
| Wayground | 官方範本前兩列保留；第三列起放題目，11 欄 | 第五選項及圖片網址留白；解析保留 |
| Kahoot | 官方範本前八列保留；第九列起放題目，A 欄題號、B～H 資料 | 目前採保守字數 95／60；時間採 5、10、20、30、60、120 秒；最多 200 題 |
| LoiLoNote | 第一列九欄完整標題、第二列起題目 | 九欄相容格式，不混入新版版本列或題型欄 |
| Wordwall | 六欄準備表 | 在 Quiz 逐題貼入並人工勾選正確答案，不是直接匯入 |
| PaGamO | 現行官方範本前十列與工作表名稱保留，資料從第十一列開始 | 一般版不再重複前三題，保留選項與答案順序 |

Kahoot 官方下載範本標示 120／75，官方文章卻標示 95／60；目前採兩者共同涵蓋的保守政策，並非宣稱已確認平台硬上限。字數使用 UTF-16 長度，部分 emoji 會保守計為兩字。可在匯出視窗修改副本，原始題庫不會變更；切換平台或重新開啟會重設副本。

LoiLoNote v1.2.0 與純內容題 `questionOnly` 尚待繁中範本及實際匯入驗證，因此本版提供九欄相容模式。Wayground、Kahoot、LoiLoNote、Wordwall 已完成本機產檔驗證；PaGamO 另以 Chrome 實際上傳，修正版選擇題通過 8 列、題組通過 9 列（文章加 8 題）的檔案檢查。

## 範本來源（2026-09-06 核對）

- [Kahoot 官方下載入口](https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot)：`public/export-templates/kahoot.xlsx`，SHA-256 `B10E085CC559F61EF9FBA33545983D3633F24CDF5874ABCEA87F37717EB70240`。
- [Wayground 官方連結範本](https://docs.google.com/spreadsheets/d/1LKiUEiA8ntcrLQZLyvhruOZENSt1GkbsrymrsxAJj5s/edit)：`public/export-templates/wayground.xlsx`，SHA-256 `C5D0A6AE247A4E280EF22562425B88D2DC23EEC95C36575A458BB5A2A810C144`。
- [LoiLoNote 舊版說明](https://help.loilonote.app/--69d8605c370c4b28fb4700b1)。九欄繁中欄名依使用者提供的「四平台題目格式規格.md」。
- [Wordwall Quiz 說明](https://wordwall.zendesk.com/hc/en-gb/articles/360015811938--How-to-create-a-Quiz-activity)。

工作簿保留範本的說明文字與列位置，清除所有範例題後寫入資料；未承諾保留原範本的條件格式或 Excel 下拉驗證。下載前由網站執行格式檢查。

## 驗證

`node tools/test-platform-exports.cjs`：工作簿寫入／讀回，8／10 題、輪流答案、PaGamO 題數／編號、中文換行與公式樣式純文字、錯誤資料阻擋、Kahoot 保守邊界及副本隔離。

另執行 `npm run typecheck` 與 `npm run build`；網站以 GitHub Pages 工作流程部署。

前端型別檢查排除具有獨立 tsconfig 與依賴的 `functions` 專案；後端依原有工作流程檢查。本次沒有改動後端。

## PaGamO 實際上傳驗證

2026-09-06 使用已登入 Chrome 的個人題庫批量上傳頁測試。第一輪拿掉重複前三題、但仍沿用自製表頭的八題檔，平台只辨識五列；因此不能只刪除重複題就宣告相容。修正版依現行官方範本保留前十列、版號標示、欄位與工作表名稱，結果選擇題辨識八列、題組辨識九列。資料仍由第十一列開始，未用重複題補數。

官方範本下載：

- https://cdn.pagamo.org/dyna_questions/templates/v5/PaGamO_批量上傳範例_選擇題.xlsx
- https://cdn.pagamo.org/dyna_questions/templates/v5/PaGamO_批量上傳範例_題組.xlsx

`src/lib/pagamoTemplates.json` 取自這兩個檔案的前十列與合併設定，內含 SHA-256。測試會把匯出結果的前十列與原始官方 XLSX 比對，並檢查工作表名稱，避免再出現本機題數正確、平台卻少讀前三題的情況。

後續已在題庫完成實際入庫核對：一般版 8 題、題組版 1 篇文章與 8 個子題，兩種格式全部正解均為 A、B、C、D、A、B、C、D，與來源一致；解析與文章內容亦已在檢視頁確認。

更新 PaGamO 官方檔後執行 `node tools/extract-pagamo-templates.cjs`，再執行 `npm test`。
