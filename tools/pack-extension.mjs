// 把 extension/ 打包成「手動安裝」用的 ZIP，放到 public/extension/（網站建置前自動執行，產物不進 git）。
// 老師主要從 Chrome 線上應用程式商店安裝（Chrome 自動更新）；這個 ZIP 只給商店被學校擋住、需要離線安裝的人備用。
// - ZIP 內是一個「PIRLS閱讀題組小幫手」資料夾，解壓後「載入未封裝項目」選它
// - 同時產生 public/extension/version.json，只給手動安裝版的「新版本提醒」讀取（商店版不讀）
// - manifest.json 的版本必須等於 CHANGELOG.json 最新一筆，否則建置失敗（避免忘了寫更新紀錄）
// 不用任何套件：自己寫最小的 ZIP（deflate + CRC32 + UTF-8 檔名）。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'extension');
const OUT_DIR = join(ROOT, 'public', 'extension');
const ZIP_NAME = 'pirls-helper-extension.zip';
const TOP = 'PIRLS閱讀題組小幫手';
const INSTALL_URL = 'https://cagoooo.github.io/pirls-questioncraft/extension/';
const STORE_URL = 'https://chromewebstore.google.com/detail/cfbehdinangicblpbnockoofeccmoidp';
// 只給開發測試用、老師不需要的檔案
const EXCLUDE = new Set(['lib/package.json']);

const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const changelog = JSON.parse(readFileSync(join(SRC, 'CHANGELOG.json'), 'utf8'));
if (changelog[0]?.version !== manifest.version) {
  console.error(`✗ manifest.json 版本 ${manifest.version} 與 CHANGELOG.json 最新一筆 ${changelog[0]?.version} 不一致，請先補更新紀錄。`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 固定時間戳：同一份內容每次打包出一樣的 ZIP
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (11 << 5) | 7;

const readme = `PIRLS 閱讀題組小幫手 v${manifest.version}

建議改從 Chrome 線上應用程式商店安裝（按「加到 Chrome」就好，之後 Chrome 會自動更新）：
${STORE_URL}

圖文安裝說明：
${INSTALL_URL}

這個 ZIP 是「手動安裝」備用版，只有學校電腦打不開商店、或需要離線安裝時才用：
1. 把這個資料夾放到固定位置（例如 D:\\${TOP}），之後不要搬動或改名。
2. Chrome 網址列輸入 chrome://extensions ，打開右上角「開發人員模式」。
3. 按「載入未封裝項目」，選這個資料夾（裡面看得到 manifest.json）。
4. 照自動打開的設定頁，貼上自己的免費 Gemini 金鑰。

更新：手動安裝版不會自動更新。下載新版 ZIP，解壓「覆蓋」到同一個資料夾，再到 chrome://extensions 按 ⟳。
`;

const files = walk(SRC)
  .map((full) => ({ full, rel: relative(SRC, full).replace(/\\/g, '/') }))
  .filter(({ rel }) => !EXCLUDE.has(rel))
  .sort((a, b) => a.rel.localeCompare(b.rel))
  .map(({ full, rel }) => ({ name: `${TOP}/${rel}`, data: readFileSync(full) }));
files.unshift({ name: `${TOP}/請先讀我.txt`, data: Buffer.from(readme.replace(/\n/g, '\r\n'), 'utf8') });

const locals = [];
const centrals = [];
let offset = 0;
for (const f of files) {
  const name = Buffer.from(f.name, 'utf8');
  const crc = crc32(f.data);
  const deflated = deflateRawSync(f.data, { level: 9 });
  const useDeflate = deflated.length < f.data.length;
  const body = useDeflate ? deflated : f.data;
  const method = useDeflate ? 8 : 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // 檔名是 UTF-8
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(f.data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(f.data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + body.length;
}
const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...locals, ...centrals, end]);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, ZIP_NAME), zip);
writeFileSync(join(OUT_DIR, 'version.json'), JSON.stringify({
  version: manifest.version,
  date: changelog[0].date,
  notes: changelog[0].notes,
  download: `${INSTALL_URL}${ZIP_NAME}`,
  install: INSTALL_URL,
  sizeKB: Math.round(zip.length / 1024),
}, null, 2) + '\n');
console.log(`✓ public/extension/${ZIP_NAME}（${files.length} 個檔案，${Math.round(zip.length / 1024)} KB）→ v${manifest.version}`);
