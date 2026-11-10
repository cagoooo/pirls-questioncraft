// 新版本提醒：只給「手動安裝」（載入未封裝項目）的老師用。
// 從 Chrome 線上應用程式商店安裝的，Chrome 會自動更新，不再查網站版號、也不顯示「下載新版」，避免叫老師去下載 ZIP。
// 手動安裝版讀網站上的 version.json（GitHub Pages 允許跨網站讀取，不需要額外權限），最多 12 小時查一次。
export const VERSION_URL = 'https://cagoooo.github.io/pirls-questioncraft/extension/version.json';
export const INSTALL_URL = 'https://cagoooo.github.io/pirls-questioncraft/extension/';
export const STORE_ID = 'cfbehdinangicblpbnockoofeccmoidp';
export const STORE_URL = `https://chromewebstore.google.com/detail/${STORE_ID}`;
const EVERY_MS = 12 * 60 * 60 * 1000;

/** 商店安裝的擴充套件，Chrome 會在 manifest 補上 update_url；未封裝載入的沒有，ID 也不同。 */
export function isStoreInstall(manifest = chrome.runtime.getManifest(), id = chrome.runtime.id) {
  return id === STORE_ID || !!manifest.update_url;
}

export function isNewer(latest, current) {
  const a = String(latest).split('.').map(Number);
  const b = String(current).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** 手動安裝版有新版時回傳 version.json 內容；商店安裝、沒有新版或查不到都回傳 null（不打擾老師）。 */
export async function checkUpdate({ force = false } = {}) {
  if (isStoreInstall()) return null;
  const current = chrome.runtime.getManifest().version;
  const { updateCheck } = await chrome.storage.local.get('updateCheck');
  let info = updateCheck?.info ?? null;
  if (force || !updateCheck || Date.now() - updateCheck.at > EVERY_MS) {
    try {
      const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        info = await res.json();
        await chrome.storage.local.set({ updateCheck: { at: Date.now(), info } });
      }
    } catch { /* 沒網路就算了 */ }
  }
  return info?.version && isNewer(info.version, current) ? { ...info, current } : null;
}
