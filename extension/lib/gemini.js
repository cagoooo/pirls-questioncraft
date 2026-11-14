// 直接呼叫 Google Gemini API（用老師自己的金鑰）。金鑰只會送到 generativelanguage.googleapis.com。
import { imagePrompt, textPrompt, rewritePrompt, gradeOf, ensureParagraphs, RESPONSE_SCHEMA, REWRITE_SCHEMA, PIRLS_LEVELS, LEVEL_LABEL, expectedDistribution } from './prompt.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 180_000;

export class GeminiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function friendlyError(status, detail) {
  const d = String(detail || '');
  if (status === 400 && /api key not valid|API_KEY_INVALID/i.test(d)) return '金鑰無效：請到「設定」重新貼上金鑰（注意前後不要有空白）。';
  if (status === 400 && /location is not supported|User location/i.test(d)) return '這個地區目前無法使用 Gemini 免費 API。';
  if (status === 401 || status === 403) return '金鑰沒有使用權限：可能被停用、刪除，或限制了不能用 Gemini。請到 Google AI Studio 檢查。';
  if (status === 404) return '這個 AI 模型已停用或不存在：請到「設定」按「測試金鑰」，自動換成可用的模型。';
  if (status === 429) return '免費額度暫時用完：請等一分鐘再試；若一直出現，可能已達今天的上限，明天會自動恢復。';
  if (status === 413) return '圖片太大或太多張：請減少截圖張數再試。';
  if (status >= 500) return 'Google 的 AI 伺服器忙碌中，請稍後再試。';
  return `Gemini 回傳錯誤（${status}）：${d.slice(0, 200)}`;
}

async function call(path, { key, method = 'GET', body, timeout = TIMEOUT_MS } = {}) {
  if (!key) throw new GeminiError('還沒有設定 Gemini 金鑰，請先到「設定」貼上金鑰。');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API}/${path}`, {
      method,
      headers: { 'x-goog-api-key': key.trim(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw new GeminiError('等太久了（超過 3 分鐘），請減少截圖張數或稍後再試。');
    throw new GeminiError('網路連線失敗：請確認電腦有連上網路。');
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.error?.message ?? res.statusText;
    throw new GeminiError(friendlyError(res.status, detail), { status: res.status, detail });
  }
  return json;
}

// ---------- 模型清單 ----------
const EXCLUDE = /(tts|image|embedding|live|audio|robotics|computer-use|aqa|learnlm|gemma|vision|thinking-exp|native)/i;

function rank(name) {
  const id = name.replace(/^models\//, '');
  const lite = /flash-lite/.test(id);
  const flash = /flash/.test(id);
  const pro = /pro/.test(id);
  // 預設最快的 Flash-Lite（2026-11-07 阿凱老師實測 Flash 太慢），其次 Flash，最後 Pro
  const cls = lite ? 0 : flash ? 1 : pro ? 2 : 3;
  const ver = Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const preview = /preview|exp/.test(id) ? 1 : 0;
  const alias = /latest/.test(id) ? 1 : 0;
  return [cls, preview, alias, -ver, id.length];
}

function compare(a, b) {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return a.localeCompare(b);
}

export const sortModels = (ids) => [...ids].filter((id) => id.startsWith('gemini-') && !EXCLUDE.test(id)).sort(compare);

/** 舊版預設的模型若不是老師自己選的，升級後改成目前的預設（最快的）。回傳新模型或 null。 */
export function upgradeDefaultModel(settings) {
  if (!settings?.apiKey || settings.modelChosenByUser || !settings.models?.length) return null;
  const best = sortModels(settings.models)[0];
  return best && best !== settings.model ? best : null;
}

export async function listModels(key) {
  const out = [];
  let pageToken = '';
  do {
    const json = await call(`models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { key, timeout: 30_000 });
    for (const m of json.models ?? []) {
      const id = String(m.name ?? '').replace(/^models\//, '');
      if (!id.startsWith('gemini-') || EXCLUDE.test(id)) continue;
      if (!(m.supportedGenerationMethods ?? []).includes('generateContent')) continue;
      out.push(id);
    }
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return [...new Set(out)].sort(compare);
}

/** 測試金鑰：列出模型，再依偏好順序實際呼叫，找出第一個真的能用（有免費額度）的模型。 */
export async function testKey(key, preferred) {
  const models = await listModels(key);
  if (!models.length) throw new GeminiError('這把金鑰看不到任何可用的 Gemini 模型。');
  const order = preferred && models.includes(preferred) ? [preferred, ...models.filter((m) => m !== preferred)] : models;
  let lastErr;
  for (const model of order.slice(0, 4)) {
    try {
      await call(`models/${model}:generateContent`, {
        key,
        method: 'POST',
        timeout: 60_000,
        body: { contents: [{ role: 'user', parts: [{ text: '請只回覆兩個字：OK' }] }] },
      });
      return { model, models };
    } catch (e) {
      lastErr = e;
      if (e.status === 400 || e.status === 401 || e.status === 403) throw e; // 金鑰本身有問題，換模型也沒用
    }
  }
  throw lastErr ?? new GeminiError('找不到可以使用的模型。');
}

// ---------- 出題 ----------
function parseCandidate(json) {
  const block = json?.promptFeedback?.blockReason;
  if (block) throw new GeminiError(`AI 拒絕處理這份內容（${block}），請換一段文章試試。`);
  const cand = json?.candidates?.[0];
  if (!cand) throw new GeminiError('AI 沒有回傳內容，請再試一次。');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'RECITATION') {
    throw new GeminiError(`AI 因內容限制（${cand.finishReason}）停止回答，請換一段文章或減少截圖範圍。`);
  }
  const text = (cand.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
  if (cand.finishReason === 'MAX_TOKENS') throw new GeminiError('文章太長，AI 的回答被截斷了。請縮小截圖範圍或分成兩篇。');
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new GeminiError('AI 回傳的格式不正確，請再試一次。');
  }
}

export function normalize(raw) {
  const s = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
  return {
    title: s(raw?.title),
    articleContent: s(raw?.articleContent),
    questions: (Array.isArray(raw?.questions) ? raw.questions : []).map((q) => ({
      question: s(q?.question),
      options: Array.isArray(q?.options) ? q.options.map(s) : [],
      correctAnswerIndex: Number(q?.correctAnswerIndex),
      explanation: s(q?.explanation),
      pirlsLevel: s(q?.pirlsLevel),
    })),
  };
}

/** 回傳 { fatal: [...], warnings: [...] }。fatal＝不能用；warnings＝可用但要提醒老師。 */
export function checkResult(data, questionMode) {
  const fatal = [];
  const warnings = [];
  if (!data.articleContent) fatal.push('沒有整理出文章內容。');
  if (!data.questions.length) fatal.push('沒有產生任何題目。');
  data.questions.forEach((q, i) => {
    const n = `第 ${i + 1} 題`;
    if (!q.question) fatal.push(`${n}題幹空白。`);
    if (q.options.length !== 4 || q.options.some((o) => !o)) fatal.push(`${n}不是剛好 4 個選項。`);
    if (!Number.isInteger(q.correctAnswerIndex) || q.correctAnswerIndex < 0 || q.correctAnswerIndex > 3) fatal.push(`${n}正確答案不是第 1～4 項。`);
    if (!PIRLS_LEVELS.includes(q.pirlsLevel)) fatal.push(`${n}的 PIRLS 層次不正確。`);
  });
  const want = expectedDistribution(questionMode);
  const total = Object.values(want).reduce((a, b) => a + b, 0);
  if (data.questions.length !== total) warnings.push(`題數是 ${data.questions.length} 題，不是預期的 ${total} 題。`);
  const got = Object.fromEntries(PIRLS_LEVELS.map((l) => [l, 0]));
  data.questions.forEach((q) => { if (q.pirlsLevel in got) got[q.pirlsLevel]++; });
  const off = PIRLS_LEVELS.filter((l) => got[l] !== want[l]);
  if (off.length) warnings.push(`PIRLS 四層次分配不平均（${PIRLS_LEVELS.map((l) => `${LEVEL_LABEL[l]}${got[l]}`).join('・')}）。`);
  return { fatal, warnings };
}

const FORMAT_HINT = `JSON 格式：{"title": 文章標題, "articleContent": 文章全文, "questions": [{"question": 題幹, "options": [四個選項], "correctAnswerIndex": 正解索引 0～3, "explanation": 解析, "pirlsLevel": ${PIRLS_LEVELS.map((l) => `"${l}"`).join(' | ')}}]}`;

const FORMAT_HINT_TEXT = FORMAT_HINT.replace('"articleContent": 文章全文, ', '');
const OPTION_ORDER_NOTE = '（補充說明：題目上傳到 PaGamO 後，選項順序會被隨機打亂。所以 explanation 裡不要用 A、B、C、D 或「第幾個選項」來指稱選項，請直接寫出選項的內容，例如「答案是『重新綁好再試』」。）';
const TEXT_MODE_NOTE = '（補充說明：這次不需要輸出 articleContent 欄位，系統會自動放入上方 <ARTICLE> 的原文。請直接輸出 title 與 questions，把心力放在出好題目。）';
const TEXT_SCHEMA = {
  ...RESPONSE_SCHEMA,
  properties: { title: RESPONSE_SCHEMA.properties.title, questions: RESPONSE_SCHEMA.properties.questions },
  required: ['title', 'questions'],
  propertyOrdering: ['title', 'questions'],
};

const ORDER = Object.fromEntries(PIRLS_LEVELS.map((l, i) => [l, i]));

/**
 * 依年級改寫文章（對應網站後端 rewrite-for-grade）。images 或 text 擇一。
 * 回傳 { title, articleContent }。
 */
export async function rewriteForGrade({ key, model, images = [], text = '', grade, onStatus }) {
  if (!model) throw new GeminiError('還沒有選擇 AI 模型，請到「設定」按「測試金鑰」。');
  const g = gradeOf(grade);
  if (!g) throw new GeminiError(`不認得的年級：${grade}`);
  onStatus?.(`AI 正在把文章改寫成${g.label}的版本…`);
  const parts = [
    ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } })),
    { text: rewritePrompt({ text: images.length ? '' : text, grade }) },
  ];
  const request = (useSchema) => call(`models/${model}:generateContent`, {
    key,
    method: 'POST',
    body: {
      contents: [{ role: 'user', parts: useSchema ? parts : [...parts, { text: 'JSON 格式：{"title": 標題, "articleContent": 改寫後的全文}' }] }],
      generationConfig: useSchema
        ? { responseMimeType: 'application/json', responseSchema: REWRITE_SCHEMA, temperature: 0.5 }
        : { responseMimeType: 'application/json', temperature: 0.5 },
    },
  });
  let json;
  try {
    json = await request(true);
  } catch (e) {
    if (e.status !== 400 || /api key|API_KEY/i.test(e.detail ?? '')) throw e;
    json = await request(false);
  }
  const out = parseCandidate(json) ?? {};
  const articleContent = ensureParagraphs(out.articleContent);
  if (!articleContent) throw new GeminiError('AI 沒有成功改寫文章，請再試一次。');
  return { title: String(out.title ?? '').trim(), articleContent };
}

/**
 * 出題。images: [{ mimeType, base64 }]；或 text: 文章。
 * grade（'1'～'6'）：先依年級改寫文章，再用改寫後的文章依同一個年級出題。
 * 回傳 { data, warnings, model, grade, originalTitle }。
 */
export async function generateQuestions({ key, model, images = [], text = '', questionMode, languageMode, grade = '', onStatus }) {
  if (!model) throw new GeminiError('還沒有選擇 AI 模型，請到「設定」按「測試金鑰」。');
  if (grade) {
    const rewritten = await rewriteForGrade({ key, model, images, text, grade, onStatus });
    const result = await generateFromSource({ key, model, text: rewritten.articleContent, questionMode, languageMode, grade, onStatus });
    if (!result.data.title && rewritten.title) result.data.title = rewritten.title;
    return { ...result, grade };
  }
  return generateFromSource({ key, model, images, text, questionMode, languageMode, grade: '', onStatus });
}

async function generateFromSource({ key, model, images = [], text = '', questionMode, languageMode, grade = '', onStatus }) {
  const isText = !images.length;
  const prompt = isText ? textPrompt({ text, questionMode, languageMode, grade }) : imagePrompt({ questionMode, languageMode });
  const parts = [
    ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } })),
    { text: prompt },
    // 文字模式：原文由程式自己放回，不讓 AI 逐字抄一遍（長文章可省下大量時間）
    ...(isText ? [{ text: TEXT_MODE_NOTE }] : []),
    // PaGamO 預設打亂選項順序：講解不能用 A／B／C／D 代稱
    { text: OPTION_ORDER_NOTE },
  ];
  const schema = isText ? TEXT_SCHEMA : RESPONSE_SCHEMA;
  const hint = isText ? FORMAT_HINT_TEXT : FORMAT_HINT;
  let note = '';
  let last;
  let useSchema = true;
  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatus?.(attempt === 1 ? 'AI 正在閱讀並出題…' : '第一次結果不符合規定，AI 正在重新出題…');
    const request = () => call(`models/${model}:generateContent`, {
      key,
      method: 'POST',
      body: {
        contents: [{ role: 'user', parts: [...parts, ...(useSchema ? [] : [{ text: hint }]), ...(note ? [{ text: note }] : [])] }],
        generationConfig: useSchema
          ? { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7 }
          : { responseMimeType: 'application/json', temperature: 0.7 },
      },
    });
    let json;
    try {
      json = await request();
    } catch (e) {
      // 少數模型不接受完整的格式規定 → 改用一般 JSON 模式再試一次（內容一樣會由 checkResult 把關）
      if (!useSchema || e.status !== 400 || /api key|API_KEY/i.test(e.detail ?? '')) throw e;
      useSchema = false;
      json = await request();
    }
    const data = normalize(parseCandidate(json));
    if (isText) data.articleContent = text; // 與網站相同：文字模式一律保留老師提供的原文
    data.questions.sort((a, b) => (ORDER[a.pirlsLevel] ?? 9) - (ORDER[b.pirlsLevel] ?? 9));
    const check = checkResult(data, questionMode);
    last = { data, warnings: check.warnings, fatal: check.fatal, model };
    if (!check.fatal.length && !check.warnings.length) return last;
    note = `⚠️ 你上一次的輸出不符合規定：${[...check.fatal, ...check.warnings].join(' ')} 請嚴格依照題數與 PIRLS 層次分配重新輸出完整 JSON。`;
  }
  if (last.fatal.length) throw new GeminiError(`AI 產生的題目有問題：${last.fatal.slice(0, 3).join(' ')} 請再試一次。`);
  return last;
}
