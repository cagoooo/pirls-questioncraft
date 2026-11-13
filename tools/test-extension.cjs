// 擴充套件的回歸測試：PaGamO 檔案必須與網站版完全一致、範本與提示詞不可與網站版分歧。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..');
const ext = (p) => path.join(root, 'extension', p);
let checks = 0;

// ---- 1. 範本同步 ----
const tplJson = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/pagamoTemplates.json'), 'utf8'));
const extCtx = { XLSX, console };
extCtx.globalThis = extCtx;
vm.createContext(extCtx);
vm.runInContext(fs.readFileSync(ext('lib/pagamoTemplates.js'), 'utf8'), extCtx);
assert.deepEqual(JSON.parse(JSON.stringify(extCtx.PAGAMO_TEMPLATES)), tplJson, '擴充套件範本與網站不一致，請執行 node tools/sync-extension.cjs');
checks++;
vm.runInContext(fs.readFileSync(ext('lib/pagamo.js'), 'utf8'), extCtx);
const { buildWorkbook, validate, toBytes } = extCtx.PirlsPagamo;

// 內建的 SheetJS 版本要與網站相同
const vendorSrc = fs.readFileSync(ext('vendor/xlsx.full.min.js'), 'utf8');
assert.ok(vendorSrc.includes(`version="${XLSX.version}"`), `vendor/xlsx.full.min.js 不是 ${XLSX.version}`);
checks++;

// ---- 2. 載入網站版 buildPaGamOWorkbook ----
const cache = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full);
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { esModuleInterop: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, console, require: (id) => {
    if (id.endsWith('.json')) return require(path.resolve(path.dirname(full), id));
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(full), id + '.ts')));
    return require(id);
  } }, { filename: full });
  cache.set(full, module.exports);
  return module.exports;
}
const { buildPaGamOWorkbook } = load('src/lib/buildPaGamOWorkbook.ts');

const roundtrip = (wb) => XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true }), { type: 'buffer' });
const rowsOf = (wb) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: true });
const make = (count) => ({
  title: '測試文章：小水滴的旅行',
  articleContent: '第一段。\n第二段，含"引號"與😀。',
  questions: Array.from({ length: count }, (_, i) => ({
    question: `第${i + 1}題：中文，"引號"\n第二行`,
    options: ['=SUM(1,2)', '+123', '-456', '@文字'],
    correctAnswerIndex: i % 4,
    explanation: `解析 ${i + 1}`,
    pirlsLevel: 'locate & retrieve',
  })),
});

for (const count of [8, 10]) {
  for (const group of [false, true]) {
    const data = make(count);
    const site = roundtrip(buildPaGamOWorkbook(data, group));
    const mine = roundtrip(buildWorkbook(data, { group, subject: '閱讀素養題組', book: '資訊冊', chapter: '資訊章' }));
    assert.deepEqual(mine.SheetNames, site.SheetNames);
    assert.deepEqual(rowsOf(mine), rowsOf(site), `${group ? '題組' : '選擇題'} ${count} 題與網站版不一致`);
    assert.deepEqual(mine.Sheets[mine.SheetNames[0]]['!merges'], site.Sheets[site.SheetNames[0]]['!merges']);
    for (const [addr, cell] of Object.entries(mine.Sheets[mine.SheetNames[0]])) if (!addr.startsWith('!')) assert.equal(cell.f, undefined, `${addr} 被當成公式`);
    checks++;

    // 自訂分類寫在正確欄位
    const custom = rowsOf(roundtrip(buildWorkbook(data, { group, subject: '國語', book: '115上', chapter: data.title })));
    const r = custom[10];
    assert.deepEqual([r[1], r[2], r[3]], ['國語', '115上', data.title]);
    if (group) {
      assert.equal(r[5], data.title);
      assert.equal(r[6], data.articleContent);
      assert.equal(custom[11][0], '1_1');
      assert.equal(custom.length, 10 + 1 + count);
    } else {
      assert.equal(custom.length, 10 + count);
    }
    // 選項隨機：v 寫在「選項排列」欄；預設（不給）是 x，與網站版相同
    const randomRows = rowsOf(roundtrip(buildWorkbook(data, { group, randomOptions: true })));
    const col = group ? 23 : 20;
    assert.ok(randomRows.slice(group ? 11 : 10).every((row) => row[col] === 'v'));
    assert.ok(custom.slice(group ? 11 : 10).every((row) => row[col] === 'x'));
    // toBytes 產生的是合法 xlsx
    const bytes = toBytes(data, { group });
    assert.ok(bytes.byteLength > 1000);
    assert.equal(rowsOf(XLSX.read(bytes, { type: 'array' })).length, custom.length);
    checks++;
  }
}

// 錯誤資料要被擋下
const bad = make(8);
bad.questions[2].options = ['a', 'b', 'c'];
bad.questions[3].correctAnswerIndex = 4;
assert.equal(validate(bad).length, 2);
assert.throws(() => buildWorkbook(bad, {}));
checks++;

// ---- 2b. LoiLoNote 測驗卡（v1.2.0 題組：questionOnly 文章＋radio 單選題）----
vm.runInContext(fs.readFileSync(ext('lib/loilo.js'), 'utf8'), extCtx);
const loilo = extCtx.PirlsLoilo;
const LOILO_OFFICIAL_HEADERS = ['Question Type', 'Question', 'Answer Required', 'Score', 'Correct answer(s)', 'Explanation',
  'Choices or Correct Answer 1', 'Choices or Correct Answer 2', 'Choices or Correct Answer 3', 'Choices or Correct Answer 4', '…'];
{
  const data = make(8);
  const wb = roundtrip(loilo.buildWorkbook(data));
  assert.deepEqual(wb.SheetNames, ['Import']);
  const rows = rowsOf(wb);
  assert.equal(rows[0][0], 'v1.2.0', 'A1 要是官方版本字串');
  assert.deepEqual(rows[1], LOILO_OFFICIAL_HEADERS, '第 2 列要與官方範例檔欄名相同');
  assert.equal(rows.length, 2 + 1 + 8);
  assert.equal(rows[2][0], 'questionOnly');
  assert.ok(rows[2][1].includes(data.title) && rows[2][1].includes(data.articleContent), '文章項目要含標題與全文');
  assert.ok(rows[2].slice(2).every((v) => v === null), 'questionOnly 只填 B 欄');
  data.questions.forEach((q, i) => {
    const r = rows[3 + i];
    assert.deepEqual(r.slice(0, 10), ['radio', q.question, 1, 1, q.correctAnswerIndex + 1, q.explanation, ...q.options]);
    assert.equal(typeof r[4], 'number', '正確答案要是數字');
  });
  for (const [addr, cell] of Object.entries(wb.Sheets.Import)) if (!addr.startsWith('!')) assert.equal(cell.f, undefined, `LoiLoNote ${addr} 被當成公式`);
  assert.equal(loilo.fileName(data), '測試文章：小水滴的旅行.xlsx');
  checks++;

  // 長文章：自動分段，每段少於 1000 字，內容不遺漏
  const para = '小水滴從海面升起，變成雲，又落到山上。'.repeat(12);
  const longData = { ...make(8), articleContent: Array.from({ length: 8 }, (_, k) => `第${k + 1}段：${para}`).join('\n') };
  const longRows = rowsOf(roundtrip(loilo.buildWorkbook(longData)));
  const passages = longRows.filter((r) => r[0] === 'questionOnly').map((r) => r[1]);
  assert.ok(passages.length >= 2, '長文要分成多段');
  assert.ok(passages.every((p) => p.length <= 999), '每段都要少於 1000 字');
  const joined = passages.join('').replace(/\s/g, '');
  longData.articleContent.split('\n').forEach((line) => assert.ok(joined.includes(line.replace(/\s/g, '')), '分段後漏了文章內容'));
  assert.equal(longRows.length, 2 + passages.length + 8);
  assert.ok(longRows.slice(2, 2 + passages.length).every((r) => r[0] === 'questionOnly'), '文章要排在所有題目前面');
  checks++;

  // 題組檔（九欄）：必須與網站「匯出 Loilonote」逐格相同
  const { buildPlatformWorkbook, LOILO_HEADERS } = load('src/lib/platformExports.ts');
  assert.equal(JSON.stringify(loilo.LEGACY_HEADERS), JSON.stringify(LOILO_HEADERS), '九欄欄名與網站不一致');
  for (const count of [8, 10]) {
    const d = make(count);
    const site = roundtrip(buildPlatformWorkbook(d, 'loilonote'));
    const mine = roundtrip(loilo.buildLegacyWorkbook(d));
    assert.deepEqual(mine.SheetNames, site.SheetNames);
    assert.deepEqual(rowsOf(mine), rowsOf(site), `LoiLoNote 九欄 ${count} 題與網站版不一致`);
    for (const [addr, cell] of Object.entries(mine.Sheets[mine.SheetNames[0]])) if (!addr.startsWith('!')) assert.equal(cell.f, undefined, `九欄 ${addr} 被當成公式`);
  }
  assert.throws(() => loilo.buildLegacyWorkbook(bad));
  checks++;

  // 沒有文章就不放 questionOnly；錯誤資料要擋下
  const noArticle = rowsOf(roundtrip(loilo.buildWorkbook({ ...make(3), articleContent: '' })));
  assert.equal(noArticle.length, 2 + 3);
  assert.equal(noArticle[2][0], 'radio');
  assert.equal(loilo.validate(bad).length, 2);
  const tooLong = make(2);
  tooLong.questions[0].question = '字'.repeat(1000);
  assert.equal(loilo.validate(tooLong).length, 1);
  assert.throws(() => loilo.buildWorkbook(tooLong));
  checks++;
}

// ---- 3. 提示詞不可與網站後端分歧 ----
function backendLines(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const body = src.slice(src.indexOf('prompt: `') + 9, src.indexOf('`,\n});'));
  return body.replace(/\\`/g, '`').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.includes('{{') && !l.includes('{{{'));
}

(async () => {
  const prompt = await import(path.join(root, 'extension/lib/prompt.js').replace(/\\/g, '/').replace(/^/, 'file:///'));
  const gemini = await import(path.join(root, 'extension/lib/gemini.js').replace(/\\/g, '/').replace(/^/, 'file:///'));
  const opts = [['8-questions', 'zh-TW'], ['10-questions', 'en']];
  const imageAll = opts.map(([questionMode, languageMode]) => prompt.imagePrompt({ questionMode, languageMode })).join('\n');
  const textAll = opts.map(([questionMode, languageMode]) => prompt.textPrompt({ text: 'X', questionMode, languageMode })).join('\n');
  for (const line of backendLines('functions/src/flows/generate-from-images.ts')) assert.ok(imageAll.includes(line), `圖片提示詞少了：${line}`);
  for (const line of backendLines('functions/src/flows/generate-from-text.ts')) assert.ok(textAll.includes(line), `文字提示詞少了：${line}`);
  checks++;

  // ---- 4. 結果檢查與模型排序 ----
  const good = { title: 't', articleContent: 'a', questions: prompt.PIRLS_LEVELS.flatMap((l) => [0, 1].map(() => ({ question: 'q', options: ['1', '2', '3', '4'], correctAnswerIndex: 1, explanation: 'e', pirlsLevel: l }))) };
  assert.deepEqual(gemini.checkResult(gemini.normalize(good), '8-questions'), { fatal: [], warnings: [] });
  const tenWarn = gemini.checkResult(gemini.normalize(good), '10-questions');
  assert.equal(tenWarn.fatal.length, 0);
  assert.equal(tenWarn.warnings.length, 2);
  const broken = JSON.parse(JSON.stringify(good));
  broken.questions[0].options.pop();
  broken.questions[1].pirlsLevel = 'guess';
  assert.equal(gemini.checkResult(gemini.normalize(broken), '8-questions').fatal.length, 2);
  checks++;

  const sorted = gemini.sortModels(['gemini-2.5-pro', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-3.0-flash-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-embedding-001', 'gemma-3-27b-it', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite-preview']);
  assert.deepEqual(sorted, ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-3.0-flash-preview', 'gemini-2.5-pro']);
  checks++;

  // 升級時：沒手動選過模型 → 換成 Flash-Lite；手動選過 → 不動
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  assert.equal(gemini.upgradeDefaultModel({ apiKey: 'k', model: 'gemini-2.5-flash', models }), 'gemini-2.5-flash-lite');
  assert.equal(gemini.upgradeDefaultModel({ apiKey: 'k', model: 'gemini-2.5-flash', models, modelChosenByUser: true }), null);
  assert.equal(gemini.upgradeDefaultModel({ apiKey: 'k', model: 'gemini-2.5-flash-lite', models }), null);
  assert.equal(gemini.upgradeDefaultModel({ apiKey: '', model: 'gemini-2.5-flash', models }), null);
  checks++;

  // 版本比較
  const upd = await import(path.join(root, 'extension/lib/update.js').replace(/\\/g, '/').replace(/^/, 'file:///'));
  assert.ok(upd.isNewer('0.10.0', '0.9.9'));
  assert.ok(upd.isNewer('1.0', '0.9.9'));
  assert.ok(!upd.isNewer('0.5.0', '0.5.0'));
  assert.ok(!upd.isNewer('0.4.9', '0.5.0'));
  checks++;

  // 商店安裝判斷：商店版不查網站版號（Chrome 會自動更新），手動載入的才提醒
  assert.ok(upd.isStoreInstall({ update_url: 'https://clients2.google.com/service/update2/crx' }, 'someotherid'));
  assert.ok(upd.isStoreInstall({}, upd.STORE_ID));
  assert.ok(!upd.isStoreInstall({}, 'abcdefghijklmnopabcdefghijklmnop'));
  assert.equal(upd.STORE_URL, 'https://chromewebstore.google.com/detail/cfbehdinangicblpbnockoofeccmoidp');
  checks++;

  // ZIP 打包：版本要與 CHANGELOG 最新一筆一致
  const manifest = JSON.parse(fs.readFileSync(ext('manifest.json'), 'utf8'));
  const changelog = JSON.parse(fs.readFileSync(ext('CHANGELOG.json'), 'utf8'));
  assert.equal(changelog[0].version, manifest.version, 'manifest 版本與 CHANGELOG.json 最新一筆不一致');
  checks++;

  console.log(`Extension tests passed: ${checks} checks.`);
})().catch((e) => { console.error(e); process.exit(1); });
