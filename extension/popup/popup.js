import { getSettings, getShots } from '../lib/store.js';

const $ = (id) => document.getElementById(id);

(async () => {
  const [s, shots] = await Promise.all([getSettings(), getShots()]);
  $('warn').classList.toggle('hidden', !!(s.apiKey && s.model));
  if (shots.length) $('n').textContent = `（${shots.length} 張截圖）`;
})();

// ⚠️ 一定要等背景程式回覆後才關掉小視窗：太早關，指令會在半路掉了（v0.1.0 的「按了沒反應」就是這個原因）
async function send(type, busyText, btn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  btn.textContent = busyText;
  try {
    // 背景程式 10 秒沒回應就直接說明，不再默默沒反應
    const res = await Promise.race([
      chrome.runtime.sendMessage({ type, tab }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('背景程式沒有回應。請到 chrome://extensions 按這個擴充套件的 ⟳ 重新載入後再試。')), 10000)),
    ]);
    if (res && res.ok === false && res.error && !/too-short/.test(res.error)) {
      // 失敗時背景程式通常已經打開工作台並寫好說明；這裡也留一行訊息
      $('err').textContent = `⚠️ ${res.error}`;
      $('err').classList.remove('hidden');
      document.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      return;
    }
  } catch (e) {
    $('err').textContent = `⚠️ ${e?.message ?? e}`;
    $('err').classList.remove('hidden');
    document.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    return;
  }
  window.close();
}

$('capture').addEventListener('click', (e) => send('START_CAPTURE', '⏳ 截圖中…', e.currentTarget));
$('readPage').addEventListener('click', (e) => send('READ_PAGE', '⏳ 讀取全文中…', e.currentTarget));
$('bench').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'OPEN_WORKBENCH' });
  window.close();
});
$('opts').addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});
