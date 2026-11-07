// 背景程式：截圖、裁切、右鍵選單、快捷鍵、打開工作台。
import { getShots, setShots, KEYS } from './lib/store.js';

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
