// 背景程式：截圖、裁切、右鍵選單、快捷鍵、打開工作台。
import { getShots, setShots, KEYS, getSettings, saveSettings } from './lib/store.js';
import { upgradeDefaultModel } from './lib/gemini.js';

const WORKBENCH_URL = chrome.runtime.getURL('workbench/workbench.html');
const MAX_SHOTS = 10;
const MAX_EDGE = 2000; // 圖片長邊上限：夠 AI 辨識文字，又不會太佔額度

// ---------- 安裝與選單 ----------
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'pirls-text', title: '用這段文字出 PIRLS 題組', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'pirls-capture', title: '框選這個畫面出 PIRLS 題組', contexts: ['page', 'image'] });
  chrome.contextMenus.create({ id: 'pirls-page', title: '讀取這頁全文出 PIRLS 題組（部落格、新聞）', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'open-workbench', title: '開啟工作台', contexts: ['action'] });
  chrome.contextMenus.create({ id: 'open-options', title: '設定（Gemini 金鑰）', contexts: ['action'] });
  if (reason === 'install') chrome.runtime.openOptionsPage();
  if (reason === 'update') {
    // v0.3.0 起預設改用 Flash-Lite：老師沒有手動選過模型的話，自動換過去
    const next = upgradeDefaultModel(await getSettings());
    if (next) await saveSettings({ model: next });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'pirls-text') return useSelection(info, tab);
  if (info.menuItemId === 'pirls-capture') return startCapture(tab);
  if (info.menuItemId === 'pirls-page') return readFullPage(tab);
  if (info.menuItemId === 'open-workbench') return openWorkbench();
  if (info.menuItemId === 'open-options') return chrome.runtime.openOptionsPage();
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'capture-region') return;
  const target = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  startCapture(target);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case 'START_CAPTURE':
        return startCapture(msg.tab ?? sender.tab);
      case 'READ_PAGE':
        return readFullPage(msg.tab ?? sender.tab);
      case 'REGION_SELECTED':
        return finishCapture(sender.tab, msg.rect, msg.viewport);
      case 'CAPTURE_CANCEL':
        await chrome.storage.session.remove(pendingKey(sender.tab?.id));
        return { ok: true };
      case 'OPEN_WORKBENCH':
        await openWorkbench();
        return { ok: true };
      case 'SEND_TO_PAGAMO':
        return sendToPagamo();
      default:
        return undefined;
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: e?.message ?? String(e) }));
  return true;
});

// ---------- 截圖 ----------
const pendingKey = (tabId) => `pending_${tabId}`;

async function startCapture(tab) {
  if (!tab?.id) return { ok: false, error: '找不到目前的分頁。' };
  const count = (await getShots()).length;
  if (count >= MAX_SHOTS) {
    await openWorkbench();
    return { ok: false, error: `最多 ${MAX_SHOTS} 張截圖，請先到工作台刪掉一些。` };
  }
  // 上一張的「已加入」提示若還在畫面上，先收掉，免得被拍進新截圖
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const hosts = document.querySelectorAll('[data-pirls-host]');
        window.dispatchEvent(new Event('pirls-overlay-reset')); // 讓還沒結束的舊框選畫面解除監聽
        hosts.forEach((h) => h.remove());
        window.__pirlsOverlayActive = false;
        return hosts.length;
      },
    });
    if (res?.result) await new Promise((r) => setTimeout(r, 120));
  } catch { /* 無法放腳本的頁面不會有提示框 */ }
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 92 });
  } catch (e) {
    await chrome.storage.local.set({ lastNotice: `這個頁面無法截圖（${e?.message ?? e}）。Chrome 的設定頁、擴充功能商店等頁面不允許截圖。` });
    await openWorkbench();
    return { ok: false, error: e?.message };
  }
  await chrome.storage.session.set({ [pendingKey(tab.id)]: { dataUrl, title: tab.title ?? '', url: tab.url ?? '' } });
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/capture-overlay.js'] });
  } catch {
    // 內建 PDF 檢視器、chrome:// 等頁面放不進框選畫面 → 整張存起來，到工作台再裁切
    await chrome.storage.session.remove(pendingKey(tab.id));
    await addShot({ dataUrl, title: tab.title ?? '', url: tab.url ?? '', needsCrop: true });
    await openWorkbench();
  }
  return { ok: true };
}

async function finishCapture(tab, rect, viewport) {
  const key = pendingKey(tab?.id);
  const { [key]: pending } = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  if (!pending) return { ok: false, error: '截圖已過期，請再按一次。' };
  const cropped = await cropImage(pending.dataUrl, rect, viewport);
  const count = await addShot({ ...cropped, title: pending.title, url: pending.url, needsCrop: false });
  return { ok: true, count };
}

async function cropImage(dataUrl, rect, viewport) {
  const blob = await (await fetch(dataUrl)).blob();
  const bmp = await createImageBitmap(blob);
  // 截圖是實際像素；框選座標是網頁座標。用寬度比換算（含螢幕縮放與網頁縮放）。
  const scale = bmp.width / Math.max(1, viewport.w);
  const sx = clamp(Math.round(rect.x * scale), 0, bmp.width - 1);
  const sy = clamp(Math.round(rect.y * scale), 0, bmp.height - 1);
  const sw = clamp(Math.round(rect.w * scale), 1, bmp.width - sx);
  const sh = clamp(Math.round(rect.h * scale), 1, bmp.height - sy);
  const k = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  bmp.close();
  const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
  return { dataUrl: await blobToDataUrl(out), width: w, height: h };
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(bin)}`;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

async function addShot(shot) {
  const shots = await getShots();
  shots.push({ id: crypto.randomUUID(), ts: Date.now(), ...shot });
  await setShots(shots);
  return shots.length;
}

// ---------- 反白文字 ----------
async function useSelection(info, tab) {
  let text = info.selectionText ?? '';
  try {
    // selectionText 會吃掉換行，盡量從網頁拿保留段落的版本
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      func: () => String(window.getSelection?.() ?? ''),
    });
    if (res?.result && res.result.trim().length >= text.trim().length * 0.8) text = res.result;
  } catch { /* PDF 等頁面拿不到，就用 selectionText */ }
  await chrome.storage.local.set({
    [KEYS.text]: { text: text.trim(), title: tab?.title ?? '', url: tab?.url ?? '', ts: Date.now() },
    sourceMode: 'text',
  });
  await openWorkbench();
}

// ---------- 讀取這頁全文 ----------
async function readFullPage(tab) {
  if (!tab?.id) return { ok: false, error: '找不到目前的分頁。' };
  let result;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['vendor/Readability.js', 'content/extract-article.js'],
    });
    result = res?.[res.length - 1]?.result;
  } catch (e) {
    await chrome.storage.local.set({ lastNotice: `這個頁面無法讀取全文（例如 PDF 檢視器、Chrome 設定頁）。請改用「框選這個畫面」截圖出題。` });
    await openWorkbench();
    return { ok: false, error: e?.message };
  }
  const text = (result?.text ?? '').trim();
  if (text.length < 80) {
    await chrome.storage.local.set({ lastNotice: '這一頁找不到足夠的文章文字（可能文章是圖片或掃描檔）。請改用「框選這個畫面」截圖出題。' });
    await openWorkbench();
    return { ok: false, error: 'too-short' };
  }
  await chrome.storage.local.set({
    [KEYS.text]: { text, title: result.title || tab.title || '', url: result.url || tab.url || '', ts: Date.now(), from: 'page' },
    sourceMode: 'text',
  });
  await openWorkbench();
  return { ok: true, length: text.length };
}

// ---------- 送到 PaGamO 批量上傳頁 ----------
// 工作台先把 xlsx 存成 pagamoPending，這裡負責打開頁面、處理登入，頁面載入完成後注入 content/pagamo-upload.js。
const PAGAMO_BATCH_URL = 'https://www.pagamo.org/api/teacher_console/questions/add_questions/batch';
const PAGAMO_TRACK = 'pagamoTrack'; // session：{ tabId, hops }
const MAX_HOPS = 3; // 自動導回批量上傳頁的次數上限，避免沒登入時一直跳來跳去

async function sendToPagamo() {
  let tab;
  try {
    const [existing] = await chrome.tabs.query({ url: 'https://www.pagamo.org/api/teacher_console/questions/add_questions/*' });
    if (existing) {
      tab = await chrome.tabs.update(existing.id, { url: PAGAMO_BATCH_URL, active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } catch { /* 找不到就開新分頁 */ }
  if (!tab) tab = await chrome.tabs.create({ url: PAGAMO_BATCH_URL });
  await chrome.storage.session.set({ [PAGAMO_TRACK]: { tabId: tab.id, hops: 0 } });
  // 頁面可能在記下分頁之前就載完了（網路很快時），這裡主動補檢查一次
  const now = await chrome.tabs.get(tab.id).catch(() => null);
  if (now?.status === 'complete' && now.url && now.url !== 'about:blank') handlePagamoTab(tab.id, now);
  return { ok: true, tabId: tab.id };
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete') handlePagamoTab(tabId, tab);
});

let pagamoBusy = false;
async function handlePagamoTab(tabId, tab) {
  if (pagamoBusy) return;
  const { [PAGAMO_TRACK]: track } = await chrome.storage.session.get(PAGAMO_TRACK);
  if (!track || track.tabId !== tabId) return;
  const { pagamoPending: pending } = await chrome.storage.local.get('pagamoPending');
  if (!pending || Date.now() - pending.ts > 10 * 60 * 1000) {
    await chrome.storage.session.remove(PAGAMO_TRACK);
    return;
  }
  const url = tab.url ?? '';
  if (!/^https:\/\/www\.pagamo\.org\//.test(url)) return;
  pagamoBusy = true;
  try {
    if (url.startsWith(PAGAMO_BATCH_URL)) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/pagamo-upload.js'] });
      await chrome.storage.session.remove(PAGAMO_TRACK);
    } else if (/sign_in|login/i.test(url) || track.hops >= MAX_HOPS) {
      // 還沒登入：提示老師先登入，登入後回到 PaGamO 任一頁就會自動導回批量上傳頁
      await chrome.scripting.executeScript({ target: { tabId }, func: showLoginHint, args: [track.hops >= MAX_HOPS] });
      if (track.hops >= MAX_HOPS) await chrome.storage.session.set({ [PAGAMO_TRACK]: { ...track, hops: 0 } });
    } else {
      await chrome.storage.session.set({ [PAGAMO_TRACK]: { ...track, hops: track.hops + 1 } });
      await chrome.tabs.update(tabId, { url: PAGAMO_BATCH_URL });
    }
  } catch (e) {
    console.warn('[PIRLS] PaGamO 自動放檔失敗：', e);
  } finally {
    pagamoBusy = false;
  }
}

// 注入到 PaGamO 頁面執行（不能用外面的變數）
function showLoginHint(stuck) {
  if (document.querySelector('[data-pirls-pagamo]')) return;
  const box = document.createElement('div');
  box.setAttribute('data-pirls-pagamo', '');
  box.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(680px,calc(100vw - 24px));'
    + 'font:15px/1.6 "Noto Sans TC","Microsoft JhengHei",sans-serif;color:#3D2E1E;background:#FDF0D0;border:1.5px solid #3D2E1E;'
    + 'border-radius:16px;box-shadow:0 5px 0 #3D2E1E;padding:12px 16px;';
  box.textContent = stuck
    ? '🔑 PIRLS 小幫手：好像還沒登入 PaGamO 教師帳號。請先登入，登入後會自動帶你到「批量上傳」並放好檔案（10 分鐘內有效）。'
    : '🔑 PIRLS 小幫手：請先登入 PaGamO 教師帳號，登入後會自動帶你到「批量上傳」並放好檔案（10 分鐘內有效）。';
  document.documentElement.appendChild(box);
}

// ---------- 工作台 ----------
async function openWorkbench() {
  // getContexts 不需要 tabs 權限就能找到自己開的頁面
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
  const existing = contexts.find((c) => c.documentUrl?.startsWith(WORKBENCH_URL) && c.tabId >= 0);
  if (existing) {
    await chrome.tabs.update(existing.tabId, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return existing;
  }
  return chrome.tabs.create({ url: WORKBENCH_URL });
}
