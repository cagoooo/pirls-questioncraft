// 新版本提醒：讀網站上的 version.json（GitHub Pages 允許跨網站讀取，不需要額外權限），最多 12 小時查一次。
export const VERSION_URL = 'https://cagoooo.github.io/pirls-questioncraft/extension/version.json';
export const INSTALL_URL = 'https://cagoooo.github.io/pirls-questioncraft/extension/';
const EVERY_MS = 12 * 60 * 60 * 1000;

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

/** 有新版回傳 version.json 內容；沒有新版或查不到回傳 null（查不到不打擾老師）。 */
export async function checkUpdate({ force = false } = {}) {
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
