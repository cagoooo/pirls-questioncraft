import { getSettings, saveSettings, getShots, setShots, currentTerm, KEYS, logError } from '../lib/store.js';
import { generateQuestions, upgradeDefaultModel } from '../lib/gemini.js';
import { PIRLS_LEVELS, LEVEL_LABEL } from '../lib/prompt.js';
import { renderFooter } from '../ui/footer.js';
import { checkUpdate, STORE_URL } from '../lib/update.js';

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
  mode = store.sourceMode === 'text' ? 'text' : 'image';
  $('sourceText').value = store[KEYS.text]?.text ?? '';
  renderTextMeta(store[KEYS.text]);
  document.querySelector(`input[name=qmode][value="${settings.questionMode}"]`).checked = true;
  document.querySelector(`input[name=lmode][value="${settings.languageMode}"]`).checked = true;
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
  el.innerHTML = `🆕 <b>有新版本 v${escapeHtml(info.version)}</b>（你現在是手動安裝的 v${escapeHtml(info.current)}）`
    + (info.notes?.length ? `：${info.notes.map(escapeHtml).join('；')}` : '')
    + `　<a href="${escapeHtml(info.download)}" target="_blank" rel="noopener noreferrer">⬇️ 下載新版</a>`
    + `　<a href="${escapeHtml(info.install)}#update" target="_blank" rel="noopener noreferrer">怎麼更新？</a>`
    + `　<a href="${STORE_URL}" target="_blank" rel="noopener noreferrer">改從 Chrome 商店安裝，之後自動更新</a>`;
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
}

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
  let images = [];
  let text = '';
  if (mode === 'image') {
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
  const tick = () => setStatus('', `<span class="spinner" aria-hidden="true"></span><span>${label}（已經 ${Math.round((Date.now() - t0) / 1000)} 秒，通常 20～60 秒）</span>`);
  tick();
  const timer = setInterval(tick, 1000);
  try {
    const res = await generateQuestions({
      key: settings.apiKey, model: settings.model, images, text, questionMode, languageMode,
      onStatus: (s) => { label = s; tick(); },
    });
    draft = {
      data: res.data,
      questionMode, languageMode,
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
  $('resultMeta').textContent = `${when} 產生｜${draft.questionMode === '10-questions' ? '10' : '8'} 題｜${draft.languageMode === 'en' ? '英文題目' : '中文'}｜模型 ${draft.model}`;
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
      <label class="exp"><span>答後講解（學生作答後才看得到：線索、正解理由、其他選項錯在哪）</span><textarea data-f="explanation" rows="2"></textarea></label>`;
    el.querySelector('[data-f=question]').value = q.question;
    el.querySelector('[data-f=explanation]').value = q.explanation;
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
  if (draft?.source !== 'image' || !Array.isArray(draft.shotIds)) return { list: [], missing: 0 };
  const list = draft.shotIds.map((id) => shots.find((s) => s.id === id)).filter(Boolean);
  return { list, missing: draft.shotIds.length - list.length };
}

function renderAttach() {
  const { list, missing } = sourceShots();
  const row = $('attachRow');
  row.classList.toggle('hidden', !list.length && !missing);
  $('attachShots').checked = settings.attachShots !== false && list.length > 0;
  $('attachShots').disabled = !list.length;
  $('attachCount').textContent = list.length;
  $('attachMissing').classList.toggle('hidden', !missing);
  $('attachMissing').textContent = missing ? `（有 ${missing} 張出題用的截圖已經刪掉，只能附上剩下的）` : '';
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
  const { list } = sourceShots();
  if (!group || !list.length || !$('attachShots').checked) return [];
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  // 每次匯出都用新的時間碼，避免和題庫裡之前上傳過的圖片同名
  const tag = `pirls${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
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
      const what = media.length ? `（Excel＋${media.length} 張文章附圖，上傳時直接選這個壓縮檔）` : '';
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
      },
    });
    const res = await chrome.runtime.sendMessage({ type: 'SEND_TO_PAGAMO' });
    if (res?.ok === false) throw new Error(res.error || '打不開 PaGamO 頁面');
    const extra = r.media.length ? `與 ${r.media.length} 張文章附圖` : '';
    showExportOk(`🚀 已下載備份，並打開 PaGamO 批量上傳頁：題型「${group ? '題組' : '選擇題'}」、檔案${extra}會自動放好，請在 PaGamO 頁面確認後按「上傳」。`);
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
    const name = globalThis.PirlsLoilo.download(draft.data, { legacy: !withArticle });
    const parts = withArticle ? globalThis.PirlsLoilo.passageItems(draft.data.title, draft.data.articleContent).length : 0;
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
    mode = changes.sourceMode.newValue === 'text' ? 'text' : 'image';
    renderMode();
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
