import { getSettings, saveSettings, getShots, setShots, currentTerm, KEYS, logError } from '../lib/store.js';
import { generateQuestions, upgradeDefaultModel } from '../lib/gemini.js';
import { PIRLS_LEVELS, LEVEL_LABEL, GRADE_LEVELS, gradeOf } from '../lib/prompt.js';
import { renderFooter } from '../ui/footer.js';
import { checkUpdate, STORE_URL, INSTALL_URL, DOWNLOAD_URL } from '../lib/update.js';
import { parseYouTubeId, startFromUrl, checkRange, formatTime, rangeLabel, thumbUrl, videoArticle, plainLinks, fetchVideoInfo, fetchThumbnail } from '../lib/youtube.js';

const $ = (id) => document.getElementById(id);
const MAX_EDGE = 2000;
const MAX_SHOTS = 10;

let settings;
let shots = [];
let draft = null; // { data, questionMode, languageMode, model, generatedAt, warnings, category, chapterFollowsTitle }
let mode = 'image';
let busy = false;
let prevDraft = null; // 載入新素材時自動收起的上一份題組

// ---------- 初始化 ----------
async function init() {
  settings = await getSettings();
  const upgraded = upgradeDefaultModel(settings);
  if (upgraded) settings = await saveSettings({ model: upgraded });
  const store = await chrome.storage.local.get([KEYS.draft, KEYS.text, 'sourceMode', 'lastNotice', 'prevDraft']);
  draft = store[KEYS.draft] ?? null;
  prevDraft = store.prevDraft ?? null;
  shots = await getShots();
  mode = ['text', 'video'].includes(store.sourceMode) ? store.sourceMode : 'image';
  videoSrc = (await chrome.storage.local.get(KEYS.video))[KEYS.video] ?? null;
  renderVideoSource();
  $('sourceText').value = store[KEYS.text]?.text ?? '';
  renderTextMeta(store[KEYS.text]);
  (document.querySelector(`input[name=qmode][value="${settings.questionMode}"]`) ?? document.querySelector('input[name=qmode][value="8-questions"]')).checked = true;
  document.querySelector(`input[name=lmode][value="${settings.languageMode}"]`).checked = true;
  for (const g of GRADE_LEVELS) $('gradeSel').add(new Option(g.label, g.id));
  $('gradeSel').value = gradeOf(settings.grade) ? settings.grade : '';
  renderGradeHint();
  document.querySelector(`input[name=optorder][value="${settings.randomOptions === false ? 'fixed' : 'random'}"]`).checked = true;
  if (store.lastNotice) showNotice(store.lastNotice);
  renderKeyBanner();
  renderMode();
  renderShots();
  renderDraft();
  renderFooter();
  maybeAutoCrop();
  renderUpdate();
}

// 只有手動安裝版會走到這裡；商店安裝由 Chrome 自動更新，checkUpdate() 直接回傳 null
async function renderUpdate() {
  const info = await checkUpdate();
  if (!info) return;
  const el = $('updateBanner');
  // 全部用純文字組畫面，連結用程式裡固定的網址（商店規定：不能把網路上讀到的內容當 HTML 放進畫面）
  const link = (href, text) => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
  };
  const b = document.createElement('b');
  b.textContent = `有新版本 v${info.version}`;
  el.replaceChildren(
    '🆕 ', b, `（你現在是手動安裝的 v${info.current}）`,
    info.notes.length ? `：${info.notes.join('；')}` : '',
    '　', link(DOWNLOAD_URL, '⬇️ 下載新版'),
    '　', link(`${INSTALL_URL}#update`, '怎麼更新？'),
    '　', link(STORE_URL, '改從 Chrome 商店安裝，之後自動更新'),
  );
  el.classList.remove('hidden');
}

function showNotice(text) {
  const el = $('pageNotice');
  el.textContent = text;
  el.classList.remove('hidden');
  chrome.storage.local.remove('lastNotice');
}

function renderKeyBanner() {
  $('keyBanner').classList.toggle('hidden', !!(settings.apiKey && settings.model));
}

// ---------- 素材：截圖 ----------
function renderMode() {
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.mode === mode));
  $('panel-image').classList.toggle('hidden', mode !== 'image');
  $('panel-text').classList.toggle('hidden', mode !== 'text');
  $('panel-video').classList.toggle('hidden', mode !== 'video');
}

// ---------- 素材：YouTube 影片（v0.9.0） ----------
let videoSrc = null; // { url, id, start, end, title, author }
let videoInfoFor = '';

function renderVideoSource() {
  const v = videoSrc ?? {};
  if (document.activeElement !== $('ytUrl')) $('ytUrl').value = v.url ?? '';
  // 優先顯示老師打的字（打錯時不要被清掉）；從小視窗帶進來的只有秒數
  if (document.activeElement !== $('ytStart')) $('ytStart').value = v.startText ?? (v.start != null ? formatTime(v.start) : '');
  if (document.activeElement !== $('ytEnd')) $('ytEnd').value = v.endText ?? (v.end != null ? formatTime(v.end) : '');
  const has = !!v.id;
  $('ytCard').classList.toggle('hidden', !has);
  if (has) {
    if ($('ytThumb').dataset.id !== v.id) { $('ytThumb').src = thumbUrl(v.id); $('ytThumb').dataset.id = v.id; }
    $('ytTitle').textContent = v.title || '（正在讀取影片資訊…）';
    $('ytAuthor').textContent = v.author ? `頻道：${v.author}` : '';
    $('ytRange').textContent = `出題範圍：${rangeLabel(v.start ?? null, v.end ?? null)}`;
  }
  if (has && videoInfoFor !== v.id) loadVideoInfo(v.id);
}

async function loadVideoInfo(id) {
  videoInfoFor = id;
  const info = await fetchVideoInfo(id);
  if (videoSrc?.id !== id) return;
  const msg = $('ytMsg');
  if (info.ok) {
    // 讀到標題不要清掉訊息：時間打錯的提醒要留著
    if (info.title !== videoSrc.title || info.author !== videoSrc.author) await saveVideoSource({ ...videoSrc, title: info.title, author: info.author });
  } else {
    msg.className = 'error';
    msg.textContent = info.reason === 'private'
      ? '⚠️ 這部影片不是公開影片（可能是不公開或私人），AI 讀不到，請換一部公開影片。'
      : info.reason === 'notfound' ? '⚠️ 找不到這部影片，請確認網址是否正確、影片是否已刪除。' : '⚠️ 暫時讀不到影片資訊（網路問題），仍可以試著出題。';
  }
}

async function saveVideoSource(v) {
  videoSrc = v;
  await chrome.storage.local.set({ [KEYS.video]: v });
  renderVideoSource();
}

let ytTimer;
function onVideoInput() {
  clearTimeout(ytTimer);
  ytTimer = setTimeout(async () => {
    const url = $('ytUrl').value.trim();
    const id = parseYouTubeId(url);
    const msg = $('ytMsg');
    if (!id) videoInfoFor = ''; // 換回影片網址時要重新讀標題
    if (url && !id) { msg.className = 'error'; msg.textContent = '⚠️ 這不是 YouTube 影片網址。請到影片頁複製網址列的網址（例如 https://www.youtube.com/watch?v=…）。'; }
    else { msg.className = 'muted'; msg.textContent = ''; }
    let startText = $('ytStart').value;
    // 網址帶 ?t=90 而且還沒填開始時間：自動帶入
    if (id && !startText.trim() && startFromUrl(url)) { startText = formatTime(startFromUrl(url)); $('ytStart').value = startText; }
    const r = checkRange(startText, $('ytEnd').value);
    if (r.error && ($('ytStart').value.trim() || $('ytEnd').value.trim())) { msg.className = 'error'; msg.textContent = `⚠️ ${r.error}`; }
    const same = id && id === videoSrc?.id;
    await saveVideoSource({
      url, id, start: r.error ? null : r.start, end: r.error ? null : r.end,
      startText: $('ytStart').value, endText: $('ytEnd').value,
      title: same ? videoSrc.title : '', author: same ? videoSrc.author : '',
    });
  }, 400);
}
['ytUrl', 'ytStart', 'ytEnd'].forEach((k) => $(k).addEventListener('input', onVideoInput));

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  mode = t.dataset.mode;
  chrome.storage.local.set({ sourceMode: mode });
  renderMode();
}));

function renderShots() {
  renderAttach(); // 截圖刪除或排序改變時，題組附圖的張數跟著更新
  $('shotCount').textContent = shots.length;
  $('shotEmpty').classList.toggle('hidden', shots.length > 0);
  $('clearShots').classList.toggle('hidden', shots.length === 0);
  const list = $('shots');
  list.innerHTML = '';
  shots.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'shot';
    li.innerHTML = `
      <span class="num" aria-label="第 ${i + 1} 張">${i + 1}</span>
      <div>
        <img alt="第 ${i + 1} 張截圖">
        <div class="meta"></div>
      </div>
      <div class="tools">
        <button class="icon-btn" data-act="up" title="往前移" aria-label="第 ${i + 1} 張往前移" ${i === 0 ? 'disabled' : ''}>⬆️</button>
        <button class="icon-btn" data-act="down" title="往後移" aria-label="第 ${i + 1} 張往後移" ${i === shots.length - 1 ? 'disabled' : ''}>⬇️</button>
        <button class="icon-btn" data-act="crop" title="重新裁切" aria-label="裁切第 ${i + 1} 張">✂️</button>
        <button class="icon-btn" data-act="del" title="刪除" aria-label="刪除第 ${i + 1} 張">🗑️</button>
      </div>`;
    li.querySelector('img').src = s.dataUrl;
    const meta = li.querySelector('.meta');
    if (s.needsCrop) meta.innerHTML = '<span class="needs-crop">尚未裁切：按 ✂️ 框出文章範圍</span>';
    else meta.textContent = s.title ? `來源：${s.title}` : `${s.width ?? ''}×${s.height ?? ''}`;
    li.dataset.id = s.id;
    list.appendChild(li);
  });
}

$('shots').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.shot').dataset.id;
  const i = shots.findIndex((s) => s.id === id);
  if (i < 0) return;
  const act = btn.dataset.act;
  if (act === 'del') shots.splice(i, 1);
  if (act === 'up' && i > 0) [shots[i - 1], shots[i]] = [shots[i], shots[i - 1]];
  if (act === 'down' && i < shots.length - 1) [shots[i + 1], shots[i]] = [shots[i], shots[i + 1]];
  if (act === 'crop') return openCrop(shots[i]);
  await setShots(shots);
  renderShots();
});

$('clearShots').addEventListener('click', async () => {
  if (!confirm(`確定要清除全部 ${shots.length} 張截圖嗎？`)) return;
  shots = [];
  await setShots(shots);
  renderShots();
});

// 貼上或拖進圖片
async function addImageFile(file) {
  if (!file?.type?.startsWith('image/')) return;
  if (shots.length >= MAX_SHOTS) return alert(`最多 ${MAX_SHOTS} 張截圖，請先刪掉一些。`);
  const bmp = await createImageBitmap(file);
  const out = await bitmapToJpeg(bmp, 0, 0, bmp.width, bmp.height);
  bmp.close();
  shots.push({ id: crypto.randomUUID(), ts: Date.now(), ...out, title: file.name || '貼上的圖片', needsCrop: false });
  await setShots(shots);
  mode = 'image';
  chrome.storage.local.set({ sourceMode: mode });
  renderMode();
  renderShots();
}

document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  files.forEach(addImageFile);
});
document.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('drop-hint'); } });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('drop-hint'); });
document.addEventListener('drop', (e) => {
  document.body.classList.remove('drop-hint');
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault();
  files.forEach(addImageFile);
});

async function bitmapToJpeg(bmp, sx, sy, sw, sh) {
  const k = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
  const dataUrl = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
  return { dataUrl, width: w, height: h };
}

// ---------- 裁切視窗：截圖進來後自動打開，在這裡框選文章範圍 ----------
let cropTarget = null;
let cropImg = null;
let cropSel = null;
let cropDrag = null;
let cropScale = 1;
let cropOpening = false;

async function openCrop(shot) {
  if (cropTarget || cropOpening) return;
  cropOpening = true;
  try {
    cropTarget = shot;
    cropSel = null;
    setCropButtons();
    cropImg = await createImageBitmap(await (await fetch(shot.dataUrl)).blob());
    $('cropSource').textContent = shot.title ? `來源：${shot.title}` : '';
    $('cropModal').classList.remove('hidden');
    const stage = document.querySelector('.crop-stage');
    const canvas = $('cropCanvas');
    // 整張圖放得進視窗：同時看寬度與高度
    const maxH = Math.max(240, window.innerHeight - 260);
    cropScale = Math.min(1, (stage.clientWidth - 2) / cropImg.width, maxH / cropImg.height);
    canvas.width = Math.round(cropImg.width * cropScale);
    canvas.height = Math.round(cropImg.height * cropScale);
    drawCrop();
    $('cropCancel').focus();
  } finally {
    cropOpening = false;
  }
}

// 有剛截好、還沒裁切的圖就自動打開裁切視窗
function maybeAutoCrop() {
  if (cropTarget || cropOpening) return;
  const next = shots.find((s) => s.needsCrop && s.autoCrop);
  if (next) {
    mode = 'image';
    renderMode();
    openCrop(next);
  }
}

function setCropButtons() {
  const ok = !!(cropSel && cropSel.w > 12 && cropSel.h > 12);
  $('cropOk').disabled = !ok;
  $('cropGo').disabled = !ok;
}

function drawCrop() {
  const canvas = $('cropCanvas');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropImg, 0, 0, canvas.width, canvas.height);
  if (!cropSel) return;
  ctx.save();
  ctx.fillStyle = 'rgba(61,46,30,.45)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(cropSel.x, cropSel.y, cropSel.w, cropSel.h);
  ctx.fill('evenodd');
  ctx.strokeStyle = '#F2DC83';
  ctx.lineWidth = 3;
  ctx.strokeRect(cropSel.x, cropSel.y, cropSel.w, cropSel.h);
  ctx.restore();
}

function canvasPoint(e) {
  const c = $('cropCanvas');
  const r = c.getBoundingClientRect();
  const sx = c.width / r.width;
  return { x: Math.min(Math.max((e.clientX - r.left) * sx, 0), c.width), y: Math.min(Math.max((e.clientY - r.top) * sx, 0), c.height) };
}

$('cropCanvas').addEventListener('pointerdown', (e) => {
  cropDrag = canvasPoint(e);
  e.currentTarget.setPointerCapture(e.pointerId);
});
$('cropCanvas').addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const p = canvasPoint(e);
  cropSel = { x: Math.min(p.x, cropDrag.x), y: Math.min(p.y, cropDrag.y), w: Math.abs(p.x - cropDrag.x), h: Math.abs(p.y - cropDrag.y) };
  drawCrop();
});
$('cropCanvas').addEventListener('pointerup', () => {
  cropDrag = null;
  setCropButtons();
});

async function closeCrop() {
  const id = cropTarget?.id;
  $('cropModal').classList.add('hidden');
  cropImg?.close();
  cropImg = null;
  cropTarget = null;
  // 取消時不再自動跳出（留在清單上，之後可按 ✂️ 再裁）
  const i = shots.findIndex((s) => s.id === id);
  if (i >= 0 && shots[i].autoCrop) {
    shots[i] = { ...shots[i], autoCrop: false };
    await setShots(shots);
    renderShots();
  }
}
$('cropCancel').addEventListener('click', closeCrop);
$('cropModal').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCrop();
  if (e.key === 'Enter' && !$('cropOk').disabled) applyCrop(false);
});

async function applyCrop(full, thenGenerate = false) {
  const sel = full || !cropSel ? { x: 0, y: 0, w: cropImg.width, h: cropImg.height }
    : { x: cropSel.x / cropScale, y: cropSel.y / cropScale, w: cropSel.w / cropScale, h: cropSel.h / cropScale };
  const out = await bitmapToJpeg(cropImg, Math.round(sel.x), Math.round(sel.y), Math.round(sel.w), Math.round(sel.h));
  const i = shots.findIndex((s) => s.id === cropTarget.id);
  if (i >= 0) shots[i] = { ...shots[i], ...out, needsCrop: false, autoCrop: false };
  await setShots(shots);
  $('cropModal').classList.add('hidden');
  cropImg?.close();
  cropImg = null;
  cropTarget = null;
  renderShots();
  if (thenGenerate) {
    $('generate').click();
  } else {
    setStatus('', `✅ 已加入第 ${i + 1} 張截圖。文章還有下一段？回到原網頁捲下去，再按一次工具列圖示「截取這個畫面」。都好了就按「開始出題」。`);
    maybeAutoCrop();
  }
}
$('cropOk').addEventListener('click', () => applyCrop(false));
$('cropGo').addEventListener('click', () => applyCrop(false, true));
$('cropFull').addEventListener('click', () => applyCrop(true));

// ---------- 素材：文字 ----------
const TEXT_WARN = 4000;
const TEXT_MAX = 20000;
let textSource = null;

function renderTextMeta(src) {
  if (src !== undefined) textSource = src;
  const len = $('sourceText').value.trim().length;
  const from = textSource?.from === 'page' ? '（讀取全文）' : '';
  let html = `<b>${len.toLocaleString()}</b> 字${textSource?.title ? `｜來源：${escapeHtml(textSource.title)}${from}` : ''}`;
  if (len > TEXT_MAX) html += `<br><span class="len-bad">⚠️ 超過 ${TEXT_MAX.toLocaleString()} 字，太長了，請刪掉不需要的段落再出題。</span>`;
  else if (len > TEXT_WARN) html += `<br><span class="len-warn">💡 PIRLS 文章通常 500～2,000 字。這篇比較長，建議刪掉前言、廣告、留言等不需要的段落，AI 會更快、題目更聚焦。</span>`;
  $('textMeta').innerHTML = html;
}
let textTimer;
$('sourceText').addEventListener('input', () => {
  renderTextMeta();
  clearTimeout(textTimer);
  textTimer = setTimeout(() => chrome.storage.local.set({ [KEYS.text]: { ...(textSource ?? {}), text: $('sourceText').value, ts: Date.now() } }), 400);
});

// ---------- 出題 ----------
function renderGradeHint() {
  const g = gradeOf($('gradeSel').value);
  $('gradeHint').textContent = g
    ? `🎒 會先把文章改寫成${g.label}的版本（${g.short}），題目也依${g.label}的程度出。改寫後的文章會放在右邊，可以先讀過再匯出。`
    : '照原文出題。想讓文章和題目配合學生程度，可以選一個年級。';
}
$('gradeSel').addEventListener('change', async () => {
  renderGradeHint();
  settings = await saveSettings({ grade: $('gradeSel').value });
});

document.querySelectorAll('input[name=qmode],input[name=lmode]').forEach((r) => r.addEventListener('change', async () => {
  settings = await saveSettings({
    questionMode: document.querySelector('input[name=qmode]:checked').value,
    languageMode: document.querySelector('input[name=lmode]:checked').value,
  });
}));

function setStatus(kind, html) {
  const el = $('genStatus');
  el.className = `gen-status ${kind === 'error' ? 'error' : ''}`;
  el.innerHTML = html;
  el.classList.remove('hidden');
}

// ---------- 出題中：右側進度面板 ----------
// 進度條依「已經過時間／通常需要的時間」逼近 95%，完成才補到 100%；步驟跟著 gemini.js 回報的真實狀態走。
const progress = { timer: null, t0: 0, expect: 40, steps: [] };
const smoothScroll = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function progressStart({ video, grade, usual }) {
  const g = gradeOf(grade);
  progress.t0 = Date.now();
  progress.expect = video ? 120 : grade ? 65 : 40;
  progress.usual = usual;
  progress.steps = [
    { key: 'read', text: video ? '讀取影片網址與片段' : mode === 'image' ? '讀取截圖' : '讀取文章' },
    ...(g ? [{ key: 'rewrite', text: `改寫成${g.label}讀得懂的版本` }] : []),
    { key: 'gen', text: video ? '看影片，依 PIRLS 四層次出題' : '依 PIRLS 四層次出題，寫閱讀引導' },
    { key: 'check', text: '檢查題目格式與正解' },
  ];
  $('resultEmpty').classList.add('hidden');
  $('resultBody').classList.add('hidden');
  $('exportCard').classList.add('hidden');
  const box = $('genProgress');
  box.classList.remove('hidden', 'done');
  $('gpFill').style.width = '3%';
  progressStep('read', 'done');
  progressStep(g ? 'rewrite' : 'gen', 'active');
  progressTick();
  progress.timer = setInterval(progressTick, 1000);
  // 窄螢幕（上下排）時，結果區在下面：捲過去讓老師看得到進度
  const r = $('resultCard').getBoundingClientRect();
  if (r.top > innerHeight * 0.6 || r.bottom < 0) $('resultCard').scrollIntoView({ behavior: smoothScroll(), block: 'start' });
}

function progressTick() {
  const sec = (Date.now() - progress.t0) / 1000;
  const pct = 3 + 92 * (1 - Math.exp(-sec / progress.expect));
  $('gpFill').style.width = `${pct.toFixed(1)}%`;
  $('gpTime').textContent = `已經 ${Math.round(sec)} 秒，${progress.usual}`;
}

function progressStep(key, state) {
  const idx = progress.steps.findIndex((s) => s.key === key);
  if (idx < 0) return;
  progress.steps.forEach((s, i) => {
    if (i < idx) s.state = 'done';
    else if (i === idx) s.state = state;
    else if (state === 'active' || state === 'done') s.state = s.state === 'done' ? 'done' : '';
  });
  $('gpSteps').innerHTML = progress.steps.map((s) => `<li class="${s.state || ''}">${escapeHtml(s.text)}</li>`).join('');
}

function progressLabel(text) {
  $('gpLabel').textContent = text;
  if (/改寫/.test(text)) progressStep('rewrite', 'active');
  else if (/出題/.test(text)) progressStep('gen', 'active');
}

async function progressEnd(ok) {
  clearInterval(progress.timer);
  const box = $('genProgress');
  if (ok) {
    progressStep('check', 'done');
    $('gpLabel').textContent = '✅ 出好了！';
    $('gpFill').style.width = '100%';
    box.classList.add('done');
    await new Promise((r) => setTimeout(r, 600));
  }
  box.classList.add('hidden');
}

function dataUrlToPart(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  return { mimeType: m[1], base64: m[2] };
}

$('generate').addEventListener('click', async () => {
  if (busy) return;
  settings = await getSettings();
  if (!settings.apiKey || !settings.model) {
    renderKeyBanner();
    return setStatus('error', '⚠️ 還沒設定 Gemini 金鑰。請先到 <a href="../options/options.html">設定頁</a> 貼上金鑰並按「儲存並測試」。');
  }
  const questionMode = document.querySelector('input[name=qmode]:checked').value;
  const languageMode = document.querySelector('input[name=lmode]:checked').value;
  const grade = gradeOf($('gradeSel').value) ? $('gradeSel').value : '';
  let images = [];
  let text = '';
  let video = null;
  if (mode === 'video') {
    const id = parseYouTubeId($('ytUrl').value);
    if (!id) return setStatus('error', '⚠️ 還沒有 YouTube 影片網址。請在 YouTube 影片頁按工具列圖示「🎬 用這部影片出題」，或把影片網址貼在「影片」分頁。');
    const r = checkRange($('ytStart').value, $('ytEnd').value);
    if (r.error) return setStatus('error', `⚠️ ${r.error}`);
    video = { id, start: r.start, end: r.end, title: videoSrc?.id === id ? (videoSrc.title || '') : '' };
  } else if (mode === 'image') {
    if (!shots.length) return setStatus('error', '⚠️ 還沒有截圖。請到要出題的網頁按工具列圖示「截取這個畫面」（或 Alt+Shift+P），或切到「文字」分頁貼上文章。');
    if (shots.some((s) => s.needsCrop)) return setStatus('error', '⚠️ 有截圖還沒裁切，請先按該張的 ✂️ 框出文章範圍。');
    images = shots.map((s) => dataUrlToPart(s.dataUrl));
    const totalMB = images.reduce((a, p) => a + p.base64.length, 0) * 0.75 / 1024 / 1024;
    if (totalMB > 15) return setStatus('error', `⚠️ 截圖總共約 ${totalMB.toFixed(1)} MB，太大了，請減少張數。`);
  } else {
    text = $('sourceText').value.trim();
    if (text.length < 80) return setStatus('error', '⚠️ 文章太短了（至少約 80 字），PIRLS 題組需要一篇完整的文章。');
    if (text.length > TEXT_MAX) return setStatus('error', `⚠️ 文章超過 ${TEXT_MAX.toLocaleString()} 字，請先刪掉不需要的段落。`);
  }
  if (draft && !confirm('重新出題會取代目前的題目（包含你改過的內容），確定嗎？')) return;

  busy = true;
  $('generate').disabled = true;
  const t0 = Date.now();
  let label = 'AI 正在閱讀並出題…';
  const usual = video ? '影片出題通常 1～3 分鐘，影片越長越久' : grade ? '改寫加出題通常 40～90 秒' : '通常 20～60 秒';
  const tick = () => setStatus('', `<span class="spinner" aria-hidden="true"></span><span>${label}（已經 ${Math.round((Date.now() - t0) / 1000)} 秒，${usual}）</span>`);
  tick();
  const timer = setInterval(tick, 1000);
  progressStart({ video, grade, usual });
  progressLabel(label);
  let ok = false;
  try {
    const res = await generateQuestions({
      key: settings.apiKey, model: settings.model, images, text, video, questionMode, languageMode, grade,
      onStatus: (s) => { label = s; tick(); progressLabel(s); },
    });
    ok = true;
    progressStep('check', 'active');
    await progressEnd(true);
    if (video) {
      // 題組文章＝影片標題＋觀看連結＋重點摘要；標題沿用影片標題，老師比較好認
      if (video.title) res.data.title = video.title;
      res.data.articleContent = videoArticle({ ...video, summary: res.data.articleContent });
    }
    draft = {
      data: res.data,
      video, // YouTube 影片出題：{ id, start, end, title }
      questionMode, languageMode,
      grade, // 依年級改寫過的題組：文章已不是原文
      model: res.model,
      source: mode,
      shotIds: mode === 'image' ? shots.map((s) => s.id) : [], // 題組附圖要用的截圖（出題當下的那幾張）
      generatedAt: Date.now(),
      warnings: res.warnings,
      category: defaultCategory(res.data.title),
      chapterFollowsTitle: settings.chapterMode === 'title',
    };
    await saveDraft(true);
    renderDraft();
    const sec = Math.round((Date.now() - t0) / 1000);
    setStatus('', `✅ 完成！花了 ${sec} 秒。請在右邊逐題檢查，確認沒問題再匯出。`);
    $('resultCard').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {
    logError('出題', e);
    if (!ok) { await progressEnd(false); renderDraft(); }
    setStatus('error', `❌ ${escapeHtml(e.message)}`);
  } finally {
    clearInterval(timer);
    busy = false;
    $('generate').disabled = false;
  }
});

function defaultCategory(title) {
  return {
    subject: settings.subject || '閱讀素養題組',
    book: settings.book || currentTerm(),
    chapter: settings.chapterMode === 'title' ? (title || 'PIRLS閱讀理解') : (settings.chapter || 'PIRLS閱讀理解'),
  };
}

// ---------- 題目編輯 ----------
let draftTimer;
async function saveDraft(now) {
  clearTimeout(draftTimer);
  const write = () => chrome.storage.local.set({ [KEYS.draft]: draft });
  if (now) return write();
  draftTimer = setTimeout(write, 400);
}

function renderDraft() {
  const has = !!draft?.data;
  $('resultEmpty').classList.toggle('hidden', has);
  const showPrev = !has && !!prevDraft?.data;
  $('prevBox').classList.toggle('hidden', !showPrev);
  if (showPrev) $('prevTitle').textContent = prevDraft.data.title || '未命名';
  $('resultBody').classList.toggle('hidden', !has);
  $('exportCard').classList.toggle('hidden', !has);
  if (!has) return;
  renderAttach();
  const d = draft.data;
  const when = new Date(draft.generatedAt).toLocaleString('zh-TW', { hour12: false });
  const g = gradeOf(draft.grade);
  $('resultMeta').textContent = `${when} 產生｜${({ '5-questions': '5', '10-questions': '10' })[draft.questionMode] ?? '8'} 題｜${draft.languageMode === 'en' ? '英文題目' : '中文'}${g ? `｜改寫成${g.label}` : ''}｜模型 ${draft.model}`;
  $('gradeNote').classList.toggle('hidden', !g);
  $('gradeNote').textContent = g ? `🎒 下面的文章已經改寫成${g.label}的版本，學生在 PaGamO／LoiLoNote 題組裡讀到的就是這段。AI 改寫難免有疏漏，請先讀過一次，確認沒有改錯原文的意思。` : '';
  const warn = $('resultWarn');
  warn.classList.toggle('hidden', !draft.warnings?.length);
  warn.textContent = draft.warnings?.length ? `⚠️ ${draft.warnings.join(' ')} 可以直接修改層次或題目，或重新出題。` : '';
  $('title').value = d.title;
  $('article').value = d.articleContent;
  autoGrow($('article'));
  $('catSubject').value = draft.category.subject;
  $('catBook').value = draft.category.book;
  $('catChapter').value = draft.category.chapter;

  const box = $('questions');
  box.innerHTML = '';
  d.questions.forEach((q, i) => {
    const el = document.createElement('article');
    el.className = 'q';
    el.dataset.i = i;
    const lv = Math.max(0, PIRLS_LEVELS.indexOf(q.pirlsLevel));
    el.innerHTML = `
      <header><b>第 ${i + 1} 題</b>
        <select data-f="pirlsLevel" class="lv-${lv}" aria-label="第 ${i + 1} 題的 PIRLS 層次">
          ${PIRLS_LEVELS.map((l) => `<option value="${l}" ${l === q.pirlsLevel ? 'selected' : ''}>${LEVEL_LABEL[l]}</option>`).join('')}
        </select></header>
      <textarea data-f="question" rows="2" aria-label="第 ${i + 1} 題題幹"></textarea>
      <div class="opts" role="radiogroup" aria-label="第 ${i + 1} 題選項與正解">
        ${[0, 1, 2, 3].map((j) => `
          <label class="opt ${q.correctAnswerIndex === j ? 'correct' : ''}">
            <input type="radio" name="ans-${i}" value="${j}" ${q.correctAnswerIndex === j ? 'checked' : ''} aria-label="選項 ${'ABCD'[j]} 是正解">
            <span class="letter">${'ABCD'[j]}</span>
            <input type="text" data-opt="${j}" aria-label="第 ${i + 1} 題選項 ${'ABCD'[j]}">
          </label>`).join('')}
      </div>
      <label class="exp"><span>閱讀引導（學生作答後看到：回到哪一段、找什麼，不說出答案）</span><textarea data-f="explanation" rows="2"></textarea></label>
      <label class="exp evid"><span>🔍 答案依據（只有老師看得到，不會匯出）：先對一下和打勾的正解是不是同一件事</span><textarea data-f="answerEvidence" rows="2"></textarea></label>`;
    el.querySelector('[data-f=question]').value = q.question;
    el.querySelector('[data-f=explanation]').value = q.explanation;
    el.querySelector('[data-f=answerEvidence]').value = q.answerEvidence ?? '';
    el.querySelectorAll('[data-opt]').forEach((inp) => { inp.value = q.options[Number(inp.dataset.opt)] ?? ''; });
    box.appendChild(el);
  });
  box.querySelectorAll('textarea').forEach(autoGrow);
}

function autoGrow(t) {
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight + 4, 900)}px`;
}

$('questions').addEventListener('input', (e) => {
  const card = e.target.closest('.q');
  if (!card) return;
  const q = draft.data.questions[Number(card.dataset.i)];
  const t = e.target;
  if (t.dataset.f) q[t.dataset.f] = t.value;
  if (t.dataset.opt) q.options[Number(t.dataset.opt)] = t.value;
  if (t.tagName === 'TEXTAREA') autoGrow(t);
  saveDraft();
});
$('questions').addEventListener('change', (e) => {
  const card = e.target.closest('.q');
  if (!card) return;
  const q = draft.data.questions[Number(card.dataset.i)];
  if (e.target.type === 'radio') {
    q.correctAnswerIndex = Number(e.target.value);
    card.querySelectorAll('.opt').forEach((o, j) => o.classList.toggle('correct', j === q.correctAnswerIndex));
  }
  if (e.target.dataset.f === 'pirlsLevel') {
    q.pirlsLevel = e.target.value;
    e.target.className = `lv-${PIRLS_LEVELS.indexOf(q.pirlsLevel)}`;
  }
  saveDraft();
});
$('title').addEventListener('input', (e) => {
  draft.data.title = e.target.value;
  if (draft.chapterFollowsTitle) {
    draft.category.chapter = e.target.value;
    $('catChapter').value = e.target.value;
  }
  saveDraft();
});
$('article').addEventListener('input', (e) => {
  draft.data.articleContent = e.target.value;
  autoGrow(e.target);
  saveDraft();
});
[['catSubject', 'subject'], ['catBook', 'book'], ['catChapter', 'chapter']].forEach(([id, k]) => $(id).addEventListener('input', (e) => {
  draft.category[k] = e.target.value;
  if (k === 'chapter') draft.chapterFollowsTitle = false;
  saveDraft();
}));

// ---------- 匯出 ----------
function exportOpts(group) {
  const c = draft.category;
  if (!c.subject.trim() || !c.book.trim() || !c.chapter.trim()) throw new Error('科目、冊次、章節都要填寫。');
  return { group, subject: c.subject.trim(), book: c.book.trim(), chapter: c.chapter.trim(), randomOptions: settings.randomOptions !== false };
}

function showExportOk(html) {
  $('exportOk').innerHTML = html;
  $('exportOk').classList.remove('hidden');
}

function showExportError(e) {
  logError('匯出', e);
  $('exportOk').classList.add('hidden');
  const err = $('exportErr');
  err.textContent = `❌ 無法匯出：${e.message}`;
  err.classList.remove('hidden');
  err.scrollIntoView({ block: 'center' });
}

// ---------- 題組附圖：用截圖出題時，把出題用的截圖一起送進 PaGamO ----------
// 官方範本「內容多媒體檔名」：完整檔名、不可重複、僅 JPG／PNG／MP3；圖片要和 Excel 一起選擇上傳，或放在同一個壓縮檔
const MEDIA_MAX_BYTES = 5 * 1024 * 1024 - 64 * 1024; // PaGamO 非壓縮檔單檔上限 5 MB，留一點餘裕

function sourceShots() {
  if (draft?.source === 'video' && draft.video?.id) return { list: [], missing: 0, video: true };
  if (draft?.source !== 'image' || !Array.isArray(draft.shotIds)) return { list: [], missing: 0 };
  const list = draft.shotIds.map((id) => shots.find((s) => s.id === id)).filter(Boolean);
  return { list, missing: draft.shotIds.length - list.length };
}

function renderAttach() {
  const { list, missing, video } = sourceShots();
  const row = $('attachRow');
  if (video) {
    // 影片題組：附上影片封面圖（不受年級改寫影響，封面不是文章）
    row.classList.remove('hidden');
    $('attachText').textContent = '📎 題組版附上影片封面圖';
    $('attachShots').checked = settings.attachShots !== false;
    $('attachShots').disabled = false;
    $('attachMissing').classList.add('hidden');
    return;
  }
  $('attachText').innerHTML = '📎 題組版附上原始截圖（<b id="attachCount">0</b> 張）';
  row.classList.toggle('hidden', !list.length && !missing);
  // 改寫過的文章和原始截圖的文字不同，附上原圖會讓學生看到兩種版本
  const rewritten = !!gradeOf(draft?.grade);
  $('attachShots').checked = !rewritten && settings.attachShots !== false && list.length > 0;
  $('attachShots').disabled = rewritten || !list.length;
  $('attachCount').textContent = list.length;
  const note = rewritten
    ? '（文章已改寫成新的年級版本，和原始截圖的文字不同，所以這次不附上原圖）'
    : missing ? `（有 ${missing} 張出題用的截圖已經刪掉，只能附上剩下的）` : '';
  $('attachMissing').classList.toggle('hidden', !note);
  $('attachMissing').textContent = note;
}

$('attachShots').addEventListener('change', async () => {
  settings = await saveSettings({ attachShots: $('attachShots').checked });
});

function dataUrlBytes(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  return { type: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) };
}

// 超過上限就縮小重存（截圖本來最長邊 2000 像素，通常用不到）
async function shrinkToLimit(dataUrl) {
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  let scale = 0.85;
  for (;;) {
    const c = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 })).arrayBuffer());
    if (bytes.length <= MEDIA_MAX_BYTES || scale < 0.3) return bytes;
    scale *= 0.8;
  }
}

async function buildMedia(group) {
  const { list, video } = sourceShots();
  if (!group || (!list.length && !video) || !$('attachShots').checked) return [];
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  // 每次匯出都用新的時間碼，避免和題庫裡之前上傳過的圖片同名
  const tag = `pirls${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  if (video) {
    const bytes = await fetchThumbnail(draft.video.id);
    if (!bytes) { showExportError(new Error('下載不到影片封面圖，這次先不附圖（題組裡仍有影片連結）。')); return []; }
    return [{ name: `${tag}_cover.jpg`, type: 'image/jpeg', bytes }];
  }
  const out = [];
  for (const [k, s] of list.entries()) {
    let { type, bytes } = dataUrlBytes(s.dataUrl);
    if (bytes.length > MEDIA_MAX_BYTES || !/^image\/(jpeg|png)$/.test(type)) { bytes = await shrinkToLimit(s.dataUrl); type = 'image/jpeg'; }
    out.push({ name: `${tag}_${k + 1}.${type === 'image/png' ? 'png' : 'jpg'}`, type, bytes });
  }
  return out;
}

function downloadBytes(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 下載 PaGamO 檔：有附圖時打包成壓縮檔（Excel＋圖片），PaGamO 批量上傳頁可以直接收壓縮檔
async function exportFile(group, { quiet = false } = {}) {
  $('exportErr').classList.add('hidden');
  try {
    const opts = exportOpts(group);
    const media = await buildMedia(group);
    if (media.length) opts.contentMedia = media.map((m) => m.name);
    const xlsxName = globalThis.PirlsPagamo.fileName(draft.data, group);
    let name;
    if (media.length) {
      const xlsx = new Uint8Array(globalThis.PirlsPagamo.toBytes(draft.data, opts));
      name = xlsxName.replace(/\.xlsx$/, '.zip');
      downloadBytes(globalThis.PirlsZip.makeZip([{ name: xlsxName, bytes: xlsx }, ...media]), name, 'application/zip');
    } else {
      name = globalThis.PirlsPagamo.download(draft.data, opts);
    }
    if (!quiet) {
      const what = media.length ? `（Excel＋${media.length} 張${draft.source === 'video' ? '影片封面圖' : '文章附圖'}，上傳時直接選這個壓縮檔）` : '';
      showExportOk(`✅ 已下載「${escapeHtml(name)}」${what}。到 PaGamO 批量上傳時，題型請選「${group ? '題組' : '選擇題'}」。`);
    }
    return { name, xlsxName, opts, media };
  } catch (e) {
    showExportError(e);
    return null;
  }
}

function toBase64(u8) {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

// 下載備份 → 存好要上傳的檔案 → 背景程式打開 PaGamO 批量上傳頁並自動放檔
async function sendToPagamo(group) {
  const r = await exportFile(group, { quiet: true });
  if (!r) return;
  try {
    const bytes = new Uint8Array(globalThis.PirlsPagamo.toBytes(draft.data, r.opts));
    await chrome.storage.local.set({
      pagamoPending: {
        name: r.xlsxName, base64: toBase64(bytes), group, typeLabel: group ? '題組' : '選擇題', ts: Date.now(),
        media: r.media.map((m) => ({ name: m.name, type: m.type, base64: toBase64(m.bytes) })),
        mediaLabel: draft.source === 'video' ? '影片封面圖' : '文章附圖',
        // 上傳後到「題目總覽」用來找出剛上傳的題目：題組比對標題，選擇題比對題幹
        title: r.opts.title ?? draft.data.title,
        matches: group ? [r.opts.title ?? draft.data.title] : draft.data.questions.map((q) => q.question),
      },
    });
    const res = await chrome.runtime.sendMessage({ type: 'SEND_TO_PAGAMO' });
    if (res?.ok === false) throw new Error(res.error || '打不開 PaGamO 頁面');
    const extra = r.media.length ? `與 ${r.media.length} 張文章附圖` : '';
    showExportOk(`🚀 已下載備份，並打開 PaGamO 批量上傳頁：題型「${group ? '題組' : '選擇題'}」、檔案${extra}會自動放好，放好後倒數 5 秒會自動按「上傳」（想自己檢查可以按「先不要」），檢查通過後會帶你到「題目總覽」看結果。`);
  } catch (e) {
    showExportError(e);
  }
}

document.querySelectorAll('input[name=optorder]').forEach((r) => r.addEventListener('change', async () => {
  settings = await saveSettings({ randomOptions: document.querySelector('input[name=optorder]:checked').value === 'random' });
}));

$('sendGroup').addEventListener('click', () => sendToPagamo(true));
$('sendChoice').addEventListener('click', () => sendToPagamo(false));
$('dlGroup').addEventListener('click', () => exportFile(true));
$('dlChoice').addEventListener('click', () => exportFile(false));

// LoiLoNote 測驗卡：題組檔＝與網站相同的九欄格式；含文章版＝v1.2.0（文章＋單選題）。不需要 PaGamO 的科目／冊次／章節
function exportLoilo(withArticle) {
  const msg = $('loiloMsg');
  try {
    // LoiLoNote 不認得 [文字](網址) 超連結：影片題組改成「文字：網址」
    const data = draft.source === 'video' ? { ...draft.data, articleContent: plainLinks(draft.data.articleContent) } : draft.data;
    const name = globalThis.PirlsLoilo.download(data, { legacy: !withArticle });
    const parts = withArticle ? globalThis.PirlsLoilo.passageItems(data.title, data.articleContent).length : 0;
    const note = parts > 1 ? `文章較長，已分成 ${parts} 段放在題目前面。` : '';
    msg.className = 'notice ok';
    msg.innerHTML = `✅ 已下載「${escapeHtml(name)}」。${note}到 LoiLoNote 測驗卡點「…」→「文件匯入」，預覽確認後按「使用此文件創建」。`;
  } catch (e) {
    logError('匯出 LoiLoNote', e);
    msg.className = 'notice error';
    msg.textContent = `❌ 無法匯出：${e.message}`;
  }
}
$('dlLoilo').addEventListener('click', () => exportLoilo(false));
$('dlLoiloArticle').addEventListener('click', () => exportLoilo(true));

$('restorePrev').addEventListener('click', async () => {
  if (!prevDraft?.data) return;
  const { archivedAt, ...restored } = prevDraft;
  draft = restored;
  prevDraft = null;
  await chrome.storage.local.set({ [KEYS.draft]: draft });
  await chrome.storage.local.remove('prevDraft');
  renderDraft();
  setStatus('', `↩️ 已還原上一份題組「${escapeHtml(draft.data.title || '未命名')}」。`);
});

$('newSet').addEventListener('click', async () => {
  if (!confirm('要清空目前的題目、截圖與文字，準備做下一篇嗎？（請先確認已經下載匯出檔）')) return;
  draft = null;
  shots = [];
  $('sourceText').value = '';
  await chrome.storage.local.remove([KEYS.draft, KEYS.text]);
  await setShots([]);
  renderShots();
  renderDraft();
  renderTextMeta(null);
  $('genStatus').classList.add('hidden');
  window.scrollTo({ top: 0 });
});

// ---------- 其他分頁（背景截圖、右鍵文字）的變動即時反映 ----------
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.prevDraft) prevDraft = changes.prevDraft.newValue ?? null;
  // 只處理「背景程式清空了題組」：自己存檔（老師正在打字）時不重畫，免得打斷輸入
  if (changes[KEYS.draft] && !changes[KEYS.draft].newValue && draft) {
    draft = null;
    clearTimeout(draftTimer);
    renderDraft();
    setStatus('', '📥 已載入新素材，右邊的舊題目已先收起來（可按「還原上一份」找回）。確認素材後按「開始出題」。');
    const card = $('resultCard');
    card.classList.remove('fresh'); void card.offsetWidth; card.classList.add('fresh');
  } else if (changes.prevDraft && !draft) {
    renderDraft();
  }
  if (changes[KEYS.shots]) {
    shots = changes[KEYS.shots].newValue ?? [];
    renderShots();
    maybeAutoCrop();
  }
  if (changes[KEYS.text] && changes[KEYS.text].newValue?.text !== $('sourceText').value) {
    $('sourceText').value = changes[KEYS.text].newValue?.text ?? '';
    $('sourceText').scrollTop = 0; // 新文章從開頭看起
    renderTextMeta(changes[KEYS.text].newValue ?? null);
    autoGrow($('sourceText'));
  }
  if (changes.sourceMode) {
    mode = ['text', 'video'].includes(changes.sourceMode.newValue) ? changes.sourceMode.newValue : 'image';
    renderMode();
  }
  if (changes[KEYS.video] && JSON.stringify(changes[KEYS.video].newValue ?? null) !== JSON.stringify(videoSrc)) {
    videoSrc = changes[KEYS.video].newValue ?? null;
    renderVideoSource();
  }
  if (changes.lastNotice?.newValue) showNotice(changes.lastNotice.newValue);
  if (changes[KEYS.settings]) {
    settings = await getSettings();
    renderKeyBanner();
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

init();
