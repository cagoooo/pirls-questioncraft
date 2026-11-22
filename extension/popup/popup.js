import { getSettings, getShots } from '../lib/store.js';
import { checkUpdate, INSTALL_URL } from '../lib/update.js';
import { parseYouTubeId } from '../lib/youtube.js';

const $ = (id) => document.getElementById(id);

(async () => {
  const [s, shots] = await Promise.all([getSettings(), getShots()]);
  $('warn').classList.toggle('hidden', !!(s.apiKey && s.model));
  if (shots.length) $('n').textContent = `（${shots.length} 張截圖）`;
  // 在 YouTube 影片頁：最上面多一顆「用這部影片出題」（activeTab 讓小視窗看得到目前分頁的網址）
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (parseYouTubeId(tab?.url)) {
    $('video').classList.remove('hidden');
    $('capture').classList.remove('primary', 'big');
  }
  const info = await checkUpdate(); // 商店安裝會自動更新，不提醒
  if (info) {
    const a = document.createElement('a');
    a.href = `${INSTALL_URL}#update`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '看更新方法';
    $('upd').replaceChildren(`🆕 有新版本 v${info.version}，`, a);
    $('upd').classList.remove('hidden');
  }
})();

// ⚠️ 一定要等背景程式回覆後才關掉小視窗：太早關，指令會在半路掉了（v0.1.0 的「按了沒反應」就是這個原因）
async function send(type, busyText, btn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  // 雲端硬碟 PDF 要先自動捲完全部頁面（約 10～20 秒），讓老師知道在做什麼（v0.10.11）
  const drivePdf = type === 'READ_PAGE' && /^https:\/\/drive\.google\.com\/file\/d\//.test(tab?.url || '');
  btn.textContent = drivePdf ? '⏳ 雲端硬碟 PDF：正在自動翻完全部頁面…（約 10～20 秒）' : busyText;
  try {
    // 背景程式太久沒回應就直接說明，不再默默沒反應；讀取全文（雲端硬碟 PDF 要捲完全部頁面）給 60 秒
    const limit = type === 'READ_PAGE' ? 60000 : 10000;
    const res = await Promise.race([
      chrome.runtime.sendMessage({ type, tab }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('背景程式沒有回應。請把 Chrome 全部關掉再重新打開後再試一次。')), limit)),
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

$('video').addEventListener('click', (e) => send('USE_VIDEO', '⏳ 帶入影片中…', e.currentTarget));
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
