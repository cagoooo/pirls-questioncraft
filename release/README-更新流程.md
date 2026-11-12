# PIRLS 閱讀題組小幫手｜商店版本更新流程

這份說明只寫「已經上架的擴充功能」要怎麼升版、打包、送審。平常改程式還是在 `extension` 資料夾裡進行。

目前商店編號是 `cfbehdinangicblpbnockoofeccmoidp`，已發布版本是 `0.5.1`，能見度是公開。開發人員資訊主頁請用 `/u/1/`（帳號是 `cagooo@gmail.com`）。

## 每次更新要做什麼

1. 先在 `extension` 裡改好程式，並在 Chrome 的「載入未封裝項目」裡實際測過。
2. 先做一次試跑打包，確認壓縮檔根目錄有 `manifest.json`，且路徑都是正斜線：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "H:\GemPIRLS\release\release.ps1" -DryRun
```

3. 確認沒問題後，再升版並打包。這個專案有 `extension\CHANGELOG.json`，一定要同時寫更新說明，而且必須和 `manifest.json` 的版本一致（網站建置腳本也會檢查這一點）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "H:\GemPIRLS\release\release.ps1" -Bump patch -Notes "說明這次改了什麼","若有第二點也可以這樣寫"
```

`-Bump patch` 會把 `0.5.1` 變成 `0.5.2`；`-Bump minor` 會變成 `0.6.0`。若要自己指定版本，改用 `-Version 0.5.2`。日期會自動填當天（以這台電腦的日期為準）。

4. 打包成功後，壓縮檔會寫到 `H:\GemPIRLS\release\dist\PIRLS閱讀題組小幫手-v版本.zip`。這個資料夾已列入忽略清單，不會被送進版控。
5. 若已經完成文末的一次性金鑰設定，腳本會自動把壓縮檔上傳成商店草稿，但不會直接送審。加上 `-Publish` 才會送審；再加上 `-Defer`，會在審核通過後先暫緩發布，要由你再按一次發布，而且必須在 30 天內完成，否則會退回草稿並要重審。
6. 若還沒設定金鑰，或加上 `-NoUpload`，腳本只負責打包，並會顯示套件頁網址，請到這裡手動上傳後再按送出審核：

`https://chrome.google.com/u/1/webstore/devconsole/3836d2de-c36d-4d91-b06d-43cfa9aa3137/cfbehdinangicblpbnockoofeccmoidp/edit/package`

7. 這個腳本不會執行提交或推送。要不要把版本變更寫進版控，請你自己檢查後再決定。
8. 網站那邊給老師下載的壓縮檔，和商店用的不是同一份：網站版由 `tools/pack-extension.mjs` 產生，裡面會多一個資料夾和說明文字，並同時寫出 `public/extension/version.json`。商店版必須把 `manifest.json` 放在壓縮檔根目錄。你升商店版之後，若也要讓自行安裝的老師收到新版本提醒，需要再另外建置並部署網站；建議等商店審核通過、使用者開始收到商店自動更新後再部署，避免商店安裝的使用者被引導去下載手動安裝檔。

請不要用 `Compress-Archive` 打包要上傳商店的檔案，在 Windows 上它會寫入反斜線路徑。本腳本已改用 Python 打包，並會在產出後檢查路徑。

請在既有的終端機執行上述指令，不要用會另開視窗的方式啟動。

## 還沒設定金鑰時，怎麼手動上傳

1. 打開上面的套件頁。
2. 在套件分頁按「上傳新套件」，選 `release\dist` 裡剛打好的壓縮檔。
3. 新版本號必須比商店上的舊版本高，否則會失敗。
4. 若這次有改到權限或主機權限，請同步更新商店的隱私權說明與權限理由，文案也要一起核對。
5. 按送出審核。每次更新都會重新審查，通過前使用者仍會用舊版。
6. 能見度會沿用目前的設定（這個套件是公開）。若要改能見度，必須先在開發人員資訊主頁改好，並至少手動成功發布過一次，之後介面才能用同樣的能見度發布。

## 一次性設定：讓腳本可以代為上傳

目前這台電腦還沒有金鑰檔，所以腳本先只會打包。金鑰必須放在專案外面，不要放進 `H:\GemPIRLS`，也不要提交到 GitHub。設定完成前，請不要把任何金鑰內容貼到聊天裡。

官方說明在：

- `https://developer.chrome.com/docs/webstore/using-api`
- `https://developer.chrome.com/docs/webstore/service-accounts`

現在商店介面是第 2 版。上傳位址是 `https://chromewebstore.googleapis.com/upload/v2/publishers/發布者編號/items/套件編號:upload`，送審位址是 `https://chromewebstore.googleapis.com/v2/publishers/發布者編號/items/套件編號:publish`。授權範圍是 `https://www.googleapis.com/auth/chromewebstore`。要發布或更新前，帳號必須已開啟兩步驟驗證。

發布者編號請到開發人員資訊主頁的「發布者」→「設定」核對。依目前控制台網址，預設會使用 `3836d2de-c36d-4d91-b06d-43cfa9aa3137`。

### 方法一：使用 OAuth 更新權杖（建議先用這個）

1. 用 `cagooo@gmail.com` 打開 Google Cloud 控制台，建立一個專案或選既有專案。
2. 搜尋並啟用「Chrome Web Store API」。
3. 到「OAuth 同意畫面」，類型選「外部」，填應用程式名稱、支援電子郵件和開發者聯絡信箱。範圍頁可以略過。在測試使用者裡加入 `cagooo@gmail.com`。
4. 到「憑證」建立「OAuth 用戶端編號」，類型選「網路應用程式」，授權重新導向 URI 加上 `https://developers.google.com/oauthplayground`。
5. 記住用戶端編號和用戶端密鑰，不要外傳。
6. 打開 `https://developers.google.com/oauthplayground`，右上角設定勾選「使用自己的 OAuth 憑證」，填入剛取得的編號和密鑰。
7. 在範圍欄填 `https://www.googleapis.com/auth/chromewebstore`，按授權，並用擁有這兩個套件的 `cagooo@gmail.com` 登入。
8. 再按「用授權碼換取權杖」，取得更新權杖。
9. 在這台電腦建立檔案 `C:\Users\smes\.config\chrome-webstore\credentials.json`，內容如下（請自行替換成你的值，不要把真實內容提交或貼到聊天）：

```json
{
  "publisher_id": "3836d2de-c36d-4d91-b06d-43cfa9aa3137",
  "client_id": "你的用戶端編號",
  "client_secret": "你的用戶端密鑰",
  "refresh_token": "你的更新權杖"
}
```

之後再執行本腳本（不要加 `-NoUpload`），就會自動上傳成草稿。加上 `-Publish` 才會送審。

### 方法二：使用服務帳戶

1. 同樣先在 Google Cloud 啟用「Chrome Web Store API」，並建立一個服務帳戶。這一階段不必另外加雲端權限。
2. 為這個服務帳戶建立一組 JSON 金鑰，存到 `C:\Users\smes\.config\chrome-webstore\service-account.json`。可在這個檔案裡多寫一個 `publisher_id` 欄位。
3. 到 Chrome 開發人員資訊主頁的「帳戶」區，把該服務帳戶的電子郵件加進去。同一個發布者目前只能綁定一個服務帳戶。
4. 腳本偵測到這個檔案時，會用 Node.js 內建功能簽署短暫權杖，不會把金鑰印出來。

## 務必注意的事

- 每一次上傳新套件都要重新審查。審查通常幾天內完成，也可能到幾週；超過三週可向商店支援查詢。新帳號、敏感權限或大幅改動程式碼，審查會比較久。
- 若這次更新新增或變更了權限、主機權限或資料使用方式，請同步改商店資訊、隱私權做法和權限理由，否則可能被退回或延長審查。
- 商店安裝的套件由 Chrome 自動更新，不可再另外下載程式碼來覆蓋自己。本套件現有的 `extension\lib\update.js` 只會讀取 `https://cagoooo.github.io/pirls-questioncraft/extension/version.json` 來顯示新版本提醒，不會自行更換程式碼；但提醒會引導老師去下載網站上的手動安裝檔，和商店自動更新並存時容易混淆，部署網站前請先想好時機。
- 部分推出（先給一部分使用者）只適用於 7 日活躍使用者超過 1 萬的項目。屆時可在開發人員資訊主頁設定，或使用官方的 `setPublishedDeployPercentage` 介面；目前這個套件還不必處理。
- 不要把金鑰、權杖、服務帳戶檔放進專案或 GitHub。腳本也不會把它們印出來。
