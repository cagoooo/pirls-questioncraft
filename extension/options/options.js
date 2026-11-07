import { getSettings, saveSettings, currentTerm } from '../lib/store.js';
import { testKey } from '../lib/gemini.js';
import { renderFooter } from '../ui/footer.js';

const $ = (id) => document.getElementById(id);
const keyInput = $('key');
const status = $('keyStatus');

function show(type, html) {
  status.className = `notice ${type}`;
  status.innerHTML = html;
}

function fillModels(models, current) {
  const sel = $('model');
  sel.innerHTML = '';
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  }
  if (current) sel.value = current;
  $('modelBox').classList.toggle('hidden', !models.length);
}

async function init() {
  const s = await getSettings();
  keyInput.value = s.apiKey;
  if (s.apiKey && s.model) show('ok', `✅ 已設定金鑰，使用模型 <b>${s.model}</b>。`);
  else if (!s.apiKey) show('warn', '⚠️ 還沒設定金鑰，設定好才能出題。');
  fillModels(s.models ?? [], s.model);

  $('subject').value = s.subject;
  $('book').value = s.book;
  $('book').placeholder = `空白＝自動用目前學期（${currentTerm()}）`;
  $('chapter').value = s.chapter;
  document.querySelector(`input[name=chapterMode][value=${s.chapterMode}]`).checked = true;
  updatePreview();
  renderFooter();
}

$('toggle').addEventListener('click', (e) => {
  const showing = keyInput.type === 'text';
  keyInput.type = showing ? 'password' : 'text';
  e.currentTarget.textContent = showing ? '顯示' : '隱藏';
  e.currentTarget.setAttribute('aria-pressed', String(!showing));
});

$('save').addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (!key) return show('error', '請先貼上金鑰。');
  if (!/^[\w.-]{20,}$/.test(key)) return show('error', '這串字看起來不像金鑰：請確認只複製了金鑰本身，沒有多餘的空白或文字。');
  const btn = $('save');
  btn.disabled = true;
  show('', '⏳ 正在向 Google 確認金鑰，並找出可用的模型…（約 5～20 秒）');
  await saveSettings({ apiKey: key });
  try {
    const prev = (await getSettings()).model;
    const { model, models } = await testKey(key, prev);
    await saveSettings({ model, models });
    fillModels(models, model);
    show('ok', `✅ 可以使用！已選好模型 <b>${model}</b>（共找到 ${models.length} 個可用模型）。<br>現在可以到網頁上按工具列的 PIRLS 圖示，或按 <b>Alt+Shift+P</b> 框選截圖出題。`);
  } catch (e) {
    show('error', `❌ ${e.message}`);
  } finally {
    btn.disabled = false;
  }
});

$('clear').addEventListener('click', async () => {
  if (!confirm('確定要從這台電腦清除 Gemini 金鑰嗎？清除後要重新貼上才能出題。')) return;
  await saveSettings({ apiKey: '', model: '', models: [] });
  keyInput.value = '';
  fillModels([], '');
  show('warn', '🧹 金鑰已清除。');
});

$('model').addEventListener('change', async (e) => {
  await saveSettings({ model: e.target.value });
  show('ok', `✅ 已改用模型 <b>${e.target.value}</b>。`);
});

let saveTimer;
function updatePreview() {
  const subject = $('subject').value.trim() || '閱讀素養題組';
  const book = $('book').value.trim() || currentTerm();
  const mode = document.querySelector('input[name=chapterMode]:checked')?.value ?? 'title';
  const chapter = mode === 'title' ? '（每篇的文章標題）' : ($('chapter').value.trim() || 'PIRLS閱讀理解');
  $('chapter').disabled = mode === 'title';
  $('catPreview').textContent = `${subject} > ${book} > ${chapter}`;
}
function scheduleSave() {
  updatePreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveSettings({
      subject: $('subject').value.trim(),
      book: $('book').value.trim(),
      chapter: $('chapter').value.trim(),
      chapterMode: document.querySelector('input[name=chapterMode]:checked')?.value ?? 'title',
    });
    $('catSaved').textContent = '✔ 已自動儲存';
  }, 400);
}
['subject', 'book', 'chapter'].forEach((id) => $(id).addEventListener('input', scheduleSave));
document.querySelectorAll('input[name=chapterMode]').forEach((r) => r.addEventListener('change', scheduleSave));

init();
