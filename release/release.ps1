# 商店擴充功能打包與上傳腳本。請用既有的 PowerShell 視窗執行，不要另外跳出視窗。
# 用法請看同資料夾的 README-更新流程.md
# 這個腳本不會執行 git commit 或 git push。

[CmdletBinding()]
param(
    [ValidateSet('patch', 'minor')]
    [string]$Bump,

    [string]$Version,

    [string[]]$Notes,

    [switch]$DryRun,

    [switch]$NoUpload,

    [switch]$Publish,

    [switch]$Defer
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ===== 專案設定（本檔只服務這一個擴充功能） =====
$ProjectRoot = 'H:\GemPIRLS'
$ExtensionDir = 'H:\GemPIRLS\extension'
$ItemId = 'cfbehdinangicblpbnockoofeccmoidp'
$PublisherIdDefault = '3836d2de-c36d-4d91-b06d-43cfa9aa3137'
$PackageName = 'PIRLS閱讀題組小幫手'
$HasChangelog = $true
$DashboardPackageUrl = 'https://chrome.google.com/u/1/webstore/devconsole/3836d2de-c36d-4d91-b06d-43cfa9aa3137/cfbehdinangicblpbnockoofeccmoidp/edit/package'
$CredentialsPath = 'C:\Users\smes\.config\chrome-webstore\credentials.json'
$ServiceAccountPath = 'C:\Users\smes\.config\chrome-webstore\service-account.json'
$ReleaseDir = Join-Path $ProjectRoot 'release'
$DistDir = Join-Path $ReleaseDir 'dist'

function Write-Info([string]$Message) {
    Write-Host $Message
}

function Write-Err([string]$Message) {
    Write-Host ("錯誤：" + $Message)
}

function Get-PyLauncher {
    $cmd = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw '找不到 py.exe，請先安裝 Python，或改用手動上傳。'
}

function Get-NodeExe {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Test-ChromeVersion([string]$Value) {
    return [bool]($Value -match '^(0|[1-9][0-9]{0,4})(\.(0|[1-9][0-9]{0,4})){0,3}$')
}

function Get-ManifestObject {
    $raw = [System.IO.File]::ReadAllText((Join-Path $ExtensionDir 'manifest.json'), [System.Text.Encoding]::UTF8)
    $obj = $raw | ConvertFrom-Json
    if (-not $obj.version) { throw 'manifest.json 沒有 version 欄位。' }
    if (-not $obj.name) { throw 'manifest.json 沒有 name 欄位。' }
    if (-not $obj.manifest_version) { throw 'manifest.json 沒有 manifest_version 欄位。' }
    if (-not (Test-ChromeVersion $obj.version)) {
        throw ("manifest.json 的版本格式不正確：" + $obj.version)
    }
    return @{ Raw = $raw; Object = $obj }
}

function Get-BumpedVersion([string]$Current, [string]$Kind) {
    $parts = @($Current.Split('.') | ForEach-Object { [int]$_ })
    while ($parts.Count -lt 3) { $parts += 0 }
    if ($Kind -eq 'minor') {
        $parts[1] = $parts[1] + 1
        for ($i = 2; $i -lt $parts.Count; $i++) { $parts[$i] = 0 }
    } else {
        $parts[$parts.Count - 1] = $parts[$parts.Count - 1] + 1
    }
    return ($parts -join '.')
}

function Invoke-Python {
    param(
        [Parameter(Mandatory = $true)][string]$Code,
        [string[]]$ArgsList
    )
    $py = Get-PyLauncher
    $tmp = Join-Path $env:TEMP ("cws-release-" + [guid]::NewGuid().ToString('N') + ".py")
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tmp, $code, $utf8NoBom)
    try {
        $allArgs = @('-3', $tmp) + @($ArgsList)
        $output = & $py @allArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw ("Python 執行失敗：" + ($output | Out-String))
        }
        return ($output | Out-String).Trim()
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Set-ManifestVersion([string]$NewVersion) {
    $code = @'
# -*- coding: utf-8 -*-
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
new_ver = sys.argv[2]
text = path.read_text(encoding="utf-8")
new_text, n = re.subn(r'("version"\s*:\s*")([^"]+)(")', r"\1" + new_ver + r"\3", text, count=1)
if n != 1:
    raise SystemExit("找不到唯一的 version 欄位，沒有改檔。")
path.write_text(new_text, encoding="utf-8")
print(new_ver)
'@
    Invoke-Python -Code $code -ArgsList @((Join-Path $ExtensionDir 'manifest.json'), $NewVersion) | Out-Null
}

function Set-ChangelogEntry([string]$NewVersion, [string[]]$NoteList, [string]$DateText) {
    $notesJsonPath = Join-Path $env:TEMP ("cws-notes-" + [guid]::NewGuid().ToString('N') + ".json")
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    $notesJson = $NoteList | ConvertTo-Json -Compress -Depth 5
    if ($NoteList.Count -eq 1) {
        $notesJson = '[' + ($NoteList[0] | ConvertTo-Json -Compress) + ']'
    }
    [System.IO.File]::WriteAllText($notesJsonPath, $notesJson, $utf8NoBom)
    $code = @'
# -*- coding: utf-8 -*-
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
version = sys.argv[2]
date_text = sys.argv[3]
notes = json.loads(Path(sys.argv[4]).read_text(encoding="utf-8"))
if not isinstance(notes, list) or not notes or any(not str(n).strip() for n in notes):
    raise SystemExit("更新說明不能是空的。")
data = json.loads(path.read_text(encoding="utf-8"))
if not isinstance(data, list):
    raise SystemExit("CHANGELOG.json 必須是陣列。")
entry = {"version": version, "date": date_text, "notes": [str(n).strip() for n in notes]}
if data and data[0].get("version") == version:
    data[0] = entry
else:
    data.insert(0, entry)
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
'@
    try {
        Invoke-Python -Code $code -ArgsList @((Join-Path $ExtensionDir 'CHANGELOG.json'), $NewVersion, $DateText, $notesJsonPath) | Out-Null
    } finally {
        Remove-Item -LiteralPath $notesJsonPath -Force -ErrorAction SilentlyContinue
    }
}

function Test-ChangelogMatches([string]$ExpectedVersion) {
    $code = @'
# -*- coding: utf-8 -*-
import json, sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
latest = data[0]["version"] if data else ""
expected = sys.argv[2]
if latest != expected:
    raise SystemExit(f"CHANGELOG.json 最新一筆是 {latest}，與 manifest 版本 {expected} 不一致。")
print("ok")
'@
    Invoke-Python -Code $code -ArgsList @((Join-Path $ExtensionDir 'CHANGELOG.json'), $ExpectedVersion) | Out-Null
}

function Get-FilesToPack {
    $excludeDirNames = @('.git', 'node_modules', 'test', 'tests', 'release', '__pycache__')
    $excludeFileNames = @('thumbs.db', '.ds_store', '.gitignore', '.env', 'package.json', 'package-lock.json')
    $files = New-Object System.Collections.Generic.List[object]
    $root = (Resolve-Path -LiteralPath $ExtensionDir).Path
    Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
        $rel = $_.FullName.Substring($root.Length).TrimStart('\', '/')
        $parts = $rel -split '[\\/]'
        $skip = $false
        foreach ($p in $parts) {
            if ($excludeDirNames -contains $p.ToLowerInvariant()) { $skip = $true }
            if ($p.StartsWith('.')) { $skip = $true }
        }
        $nameLower = $_.Name.ToLowerInvariant()
        if ($excludeFileNames -contains $nameLower) { $skip = $true }
        if ($nameLower.EndsWith('.md') -or $nameLower.EndsWith('.pem')) { $skip = $true }
        if ($skip) { return }
        $arc = ($rel -replace '\\', '/')
        $files.Add([pscustomobject]@{ Src = $_.FullName; Name = $arc })
    }
    if (-not ($files | Where-Object { $_.Name -eq 'manifest.json' })) {
        throw '打包清單裡沒有根目錄的 manifest.json。'
    }
    return $files
}

function New-StoreZip([string]$ZipPath, $FileList) {
    $listPath = Join-Path $env:TEMP ("cws-zip-list-" + [guid]::NewGuid().ToString('N') + ".json")
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    $payload = @{ zip = $ZipPath; files = @($FileList | ForEach-Object { @{ src = $_.Src; name = $_.Name } }) }
    $json = $payload | ConvertTo-Json -Depth 6 -Compress
    [System.IO.File]::WriteAllText($listPath, $json, $utf8NoBom)
    if (Test-Path -LiteralPath $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }
    $parent = Split-Path -Parent $ZipPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $code = @'
# -*- coding: utf-8 -*-
import json, sys, zipfile
from pathlib import Path
payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
zip_path = Path(payload["zip"])
with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for item in payload["files"]:
        name = item["name"].replace("\\", "/")
        if name.startswith("/") or name.startswith("\\") or ".." in name.split("/"):
            raise SystemExit(f"不安全的壓縮路徑：{name}")
        info = zipfile.ZipInfo(name)
        info.compress_type = zipfile.ZIP_DEFLATED
        data = Path(item["src"]).read_bytes()
        zf.writestr(info, data)
names = []
with zipfile.ZipFile(zip_path, "r") as zf:
    names = zf.namelist()
bad = [n for n in names if "\\" in n]
if bad:
    raise SystemExit("壓縮檔裡仍有反斜線路徑：" + ", ".join(bad[:5]))
if "manifest.json" not in names:
    raise SystemExit("壓縮檔根目錄沒有 manifest.json。找到的項目：" + ", ".join(names[:8]))
print(f"{len(names)} files")
'@
    try {
        $result = Invoke-Python -Code $code -ArgsList @($listPath)
        return $result
    } finally {
        Remove-Item -LiteralPath $listPath -Force -ErrorAction SilentlyContinue
    }
}

function Test-StoreZip([string]$ZipPath, [string]$ExpectedVersion) {
    $code = @'
# -*- coding: utf-8 -*-
import json, sys, zipfile
from pathlib import Path
zip_path = Path(sys.argv[1])
expected = sys.argv[2]
with zipfile.ZipFile(zip_path, "r") as zf:
    names = zf.namelist()
    if any("\\" in n for n in names):
        raise SystemExit("驗證失敗：壓縮檔含有反斜線路徑。")
    if "manifest.json" not in names:
        raise SystemExit("驗證失敗：根目錄沒有 manifest.json。")
    manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
    if manifest.get("version") != expected:
        raise SystemExit(f"驗證失敗：壓縮檔版本是 {manifest.get('version')}，預期 {expected}。")
    if manifest.get("update_url"):
        raise SystemExit("驗證失敗：商店版不應自帶 update_url。")
print(json.dumps({"files": len(names), "version": manifest["version"]}, ensure_ascii=False))
'@
    return Invoke-Python -Code $code -ArgsList @($ZipPath, $ExpectedVersion)
}

function Read-JsonFile([string]$Path) {
    $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    return $raw | ConvertFrom-Json
}

function Get-PublisherId($Creds, $ServiceAccount) {
    if ($Creds -and $Creds.publisher_id) { return [string]$Creds.publisher_id }
    if ($ServiceAccount -and $ServiceAccount.publisher_id) { return [string]$ServiceAccount.publisher_id }
    return $PublisherIdDefault
}

function Get-AccessToken {
    $creds = $null
    $sa = $null
    if (Test-Path -LiteralPath $CredentialsPath) {
        $creds = Read-JsonFile $CredentialsPath
    }
    if (Test-Path -LiteralPath $ServiceAccountPath) {
        $sa = Read-JsonFile $ServiceAccountPath
    }
    if ($creds -and $creds.client_id -and $creds.client_secret -and $creds.refresh_token) {
        $body = @{
            client_id     = [string]$creds.client_id
            client_secret = [string]$creds.client_secret
            refresh_token = [string]$creds.refresh_token
            grant_type    = 'refresh_token'
        }
        try {
            $resp = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -Body $body -ContentType 'application/x-www-form-urlencoded'
        } catch {
            throw '用更新權杖換取存取權杖失敗。請檢查金鑰檔，不要把內容貼到聊天裡。'
        }
        if (-not $resp.access_token) { throw '沒有取得存取權杖。' }
        return @{ Token = [string]$resp.access_token; PublisherId = (Get-PublisherId $creds $sa) }
    }
    if ($sa -and $sa.client_email -and $sa.private_key) {
        $node = Get-NodeExe
        if (-not $node) { throw '找到服務帳戶檔，但這台電腦沒有 node.exe，無法簽署權杖。請改用 OAuth 金鑰檔，或先安裝 Node.js。' }
        $saTmp = Join-Path $env:TEMP ("cws-sa-" + [guid]::NewGuid().ToString('N') + ".json")
        $jsTmp = Join-Path $env:TEMP ("cws-sa-" + [guid]::NewGuid().ToString('N') + ".js")
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        Copy-Item -LiteralPath $ServiceAccountPath -Destination $saTmp -Force
        $js = @'
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const sa = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const claim = b64url(JSON.stringify({
  iss: sa.client_email,
  scope: "https://www.googleapis.com/auth/chromewebstore",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600
}));
const signingInput = header + "." + claim;
const sign = crypto.createSign("RSA-SHA256");
sign.update(signingInput);
const assertion = signingInput + "." + b64url(sign.sign(sa.private_key));
const body = "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + encodeURIComponent(assertion);
const req = https.request({
  hostname: "oauth2.googleapis.com",
  path: "/token",
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) }
}, (res) => {
  let data = "";
  res.on("data", (c) => data += c);
  res.on("end", () => {
    if (res.statusCode !== 200) {
      console.error("token_http_" + res.statusCode);
      process.exit(1);
    }
    const parsed = JSON.parse(data);
    if (!parsed.access_token) {
      console.error("token_missing");
      process.exit(1);
    }
    process.stdout.write(parsed.access_token);
  });
});
req.on("error", () => process.exit(1));
req.write(body);
req.end();
'@
        [System.IO.File]::WriteAllText($jsTmp, $js, $utf8NoBom)
        try {
            $token = & $node $jsTmp $saTmp 2>&1
            if ($LASTEXITCODE -ne 0 -or -not $token) {
                throw '用服務帳戶換取存取權杖失敗。請確認已在開發人員資訊主頁綁定這個服務帳戶。'
            }
            return @{ Token = [string]$token; PublisherId = (Get-PublisherId $creds $sa) }
        } finally {
            Remove-Item -LiteralPath $saTmp, $jsTmp -Force -ErrorAction SilentlyContinue
        }
    }
    return $null
}

function Invoke-StoreApi {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Token,
        [string]$InFile,
        [object]$JsonBody
    )
    $headers = @{ Authorization = ("Bearer " + $Token) }
    try {
        if ($InFile) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -InFile $InFile -ContentType 'application/zip'
        }
        if ($null -ne $JsonBody) {
            $utf8NoBom = New-Object System.Text.UTF8Encoding $false
            $body = $JsonBody | ConvertTo-Json -Compress -Depth 6
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body $body -ContentType 'application/json; charset=utf-8'
        }
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
    } catch {
        $status = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        if ($status) {
            throw ("商店介面回傳狀態碼 " + $status + "。詳細內容請到開發人員資訊主頁查看，不要把權杖或金鑰貼出來。")
        }
        throw '呼叫商店介面失敗。詳細內容請到開發人員資訊主頁查看。'
    }
}

function Wait-Upload([string]$PublisherId, [string]$Token, $Initial) {
    $state = $Initial.uploadState
    $result = $Initial
    $tries = 0
    while ($state -eq 'UPLOAD_IN_PROGRESS' -and $tries -lt 20) {
        Start-Sleep -Seconds 3
        $uri = "https://chromewebstore.googleapis.com/v2/publishers/$PublisherId/items/${ItemId}:fetchStatus"
        $result = Invoke-StoreApi -Method Get -Uri $uri -Token $Token
        $state = $result.uploadState
        $tries++
    }
    if ($state -and $state -ne 'SUCCESS' -and $state -ne 'UPLOAD_SUCCESS' -and $state -ne 0) {
        if ($state -ne 'UPLOAD_IN_PROGRESS') {
            # SUCCESS 以外再檢查一次常見成功值
        }
    }
    if ($state -eq 'UPLOAD_IN_PROGRESS') {
        throw '上傳仍在處理中。請稍後到開發人員資訊主頁查看套件頁。'
    }
    if ($state -and ($state -notmatch 'SUCCESS')) {
        throw ("上傳狀態不成功：" + $state)
    }
    return $result
}

function Publish-Item([string]$PublisherId, [string]$Token) {
    $uri = "https://chromewebstore.googleapis.com/v2/publishers/$PublisherId/items/${ItemId}:publish"
    $body = @{
        publishType = $(if ($Defer) { 'STAGED_PUBLISH' } else { 'DEFAULT_PUBLISH' })
    }
    return Invoke-StoreApi -Method Post -Uri $uri -Token $Token -JsonBody $body
}

# ===== 主流程 =====
if ($Publish -and $DryRun) {
    throw '試跑模式不會上傳或送審，請不要同時加 -Publish。'
}
if ($Defer -and -not $Publish) {
    throw '延後發布只在加上 -Publish 時有效。'
}

$manifestInfo = Get-ManifestObject
$currentVersion = [string]$manifestInfo.Object.version
Write-Info ("目前版本：" + $currentVersion)

$targetVersion = $currentVersion
$didChangeVersion = $false

if ($DryRun) {
    if ($Bump -or $Version) {
        Write-Info '試跑模式不會改版本檔，仍打包目前版本。'
    }
} else {
    if ($Version -and $Bump) { throw '請只擇一使用 -Version 或 -Bump。' }
    if (-not $Version -and -not $Bump) {
        throw '請指定 -Bump patch、 -Bump minor，或 -Version 新版本。若只想打包目前版本，請加 -DryRun。'
    }
    if ($Version) {
        if (-not (Test-ChromeVersion $Version)) { throw ("新版本格式不正確：" + $Version) }
        $targetVersion = $Version
    } else {
        $targetVersion = Get-BumpedVersion $currentVersion $Bump
    }
    if ($targetVersion -eq $currentVersion) {
        throw '新版本必須比目前版本高。'
    }
    # 簡單比對：轉成數字陣列
    $a = @($targetVersion.Split('.') | ForEach-Object { [int]$_ })
    $b = @($currentVersion.Split('.') | ForEach-Object { [int]$_ })
    $max = [Math]::Max($a.Count, $b.Count)
    $isHigher = $false
    for ($i = 0; $i -lt $max; $i++) {
        $x = if ($i -lt $a.Count) { $a[$i] } else { 0 }
        $y = if ($i -lt $b.Count) { $b[$i] } else { 0 }
        if ($x -gt $y) { $isHigher = $true; break }
        if ($x -lt $y) { throw ("新版本 $targetVersion 沒有高於目前版本 $currentVersion。") }
    }
    if (-not $isHigher) { throw ("新版本 $targetVersion 沒有高於目前版本 $currentVersion。") }

    if ($HasChangelog) {
        if (-not $Notes -or $Notes.Count -eq 0) {
            throw '這個專案有 CHANGELOG.json，請用 -Notes 提供至少一則更新說明。'
        }
        Set-ChangelogEntry -NewVersion $targetVersion -NoteList $Notes -DateText ([DateTime]::Now.ToString('yyyy-MM-dd'))
    }
    Set-ManifestVersion -NewVersion $targetVersion
    $didChangeVersion = $true
    $manifestInfo = Get-ManifestObject
    if ([string]$manifestInfo.Object.version -ne $targetVersion) {
        throw '寫入版本後再次讀取，發現不相符。'
    }
    if ($HasChangelog) { Test-ChangelogMatches $targetVersion }
    Write-Info ("已把版本改成：" + $targetVersion)
}

if ($HasChangelog -and $DryRun) {
    Test-ChangelogMatches $currentVersion
    Write-Info '已確認 CHANGELOG.json 與目前版本一致。'
}

if (-not (Test-Path -LiteralPath $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

$suffix = ''
if ($DryRun) { $suffix = '-dryrun' }
$zipName = "$PackageName-v$targetVersion$suffix.zip"
$zipPath = Join-Path $DistDir $zipName

$files = Get-FilesToPack
Write-Info ("準備打包 " + $files.Count + " 個檔案。")
$packResult = New-StoreZip -ZipPath $zipPath -FileList $files
$verify = Test-StoreZip -ZipPath $zipPath -ExpectedVersion $targetVersion
Write-Info ("已產出：" + $zipPath)
Write-Info ("打包結果：" + $packResult)
Write-Info ("驗證結果：" + $verify)

if ($DryRun) {
    Write-Info '這是試跑，沒有改原始檔，也沒有上傳。'
    if ($HasChangelog) {
        Write-Info ("若要正式升版並打包，範例：powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Bump patch -Notes `"說明這次改了什麼`"")
    } else {
        Write-Info ("若要正式升版並打包，範例：powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Bump patch")
    }
    Write-Info ("手動上傳頁：" + $DashboardPackageUrl)
    return
}

if ($NoUpload) {
    Write-Info '已依參數略過上傳。'
    Write-Info ("請到套件頁手動上傳：" + $DashboardPackageUrl)
    return
}

$auth = $null
try {
    $auth = Get-AccessToken
} catch {
    Write-Err $_.Exception.Message
    Write-Info ("請改為手動上傳：" + $DashboardPackageUrl)
    return
}

if (-not $auth) {
    Write-Info '還沒有設定商店介面金鑰，所以這次只完成打包，沒有上傳。'
    Write-Info '一次性設定步驟寫在 README-更新流程.md。金鑰檔請放在專案外面：'
    Write-Info $CredentialsPath
    Write-Info ("或服務帳戶檔：" + $ServiceAccountPath)
    Write-Info ("請到套件頁手動上傳：" + $DashboardPackageUrl)
    return
}

Write-Info '正在上傳到商店草稿（不會在這裡顯示權杖）。'
$uploadUri = "https://chromewebstore.googleapis.com/upload/v2/publishers/$($auth.PublisherId)/items/${ItemId}:upload"
$uploaded = Invoke-StoreApi -Method Post -Uri $uploadUri -Token $auth.Token -InFile $zipPath
$uploaded = Wait-Upload -PublisherId $auth.PublisherId -Token $auth.Token -Initial $uploaded
Write-Info '上傳完成，已進入開發人員資訊主頁的草稿。'
if ($uploaded.crxVersion) {
    Write-Info ("商店讀到的套件版本：" + $uploaded.crxVersion)
}

if (-not $Publish) {
    Write-Info '尚未送審。若要送審，可再到開發人員資訊主頁按送出審核，或加 -Publish 重跑上傳後送審。'
    Write-Info ("套件頁：" + $DashboardPackageUrl)
    return
}

Write-Info $(if ($Defer) { '正在送審，並設定為審核通過後先暫緩發布。' } else { '正在送審，審核通過後會依目前的能見度發布。' })
$published = Publish-Item -PublisherId $auth.PublisherId -Token $auth.Token
if ($published.state) {
    Write-Info ("送審狀態：" + $published.state)
} else {
    Write-Info '已送出審核。'
}
Write-Info ("套件頁：" + $DashboardPackageUrl)
