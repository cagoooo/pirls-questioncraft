const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..');
const cache = new Map();
let captured;
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full);
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { esModuleInterop: true, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, console, process, setTimeout, require: id => {
    if (id === 'xlsx') return { ...XLSX, writeFile: book => { captured = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }); } };
    if (id.endsWith('.json')) return require(path.resolve(path.dirname(full), id));
    if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(full), id + '.ts')));
    return require(id);
  } }, { filename: full });
  cache.set(full, module.exports);
  return module.exports;
}
const { buildPlatformWorkbook, validateExport, cloneQuestionSet } = load('src/lib/platformExports.ts');
const make = count => ({ title: '測試題組', articleContent: '閱讀文章', questions: Array.from({ length: count }, (_, i) => ({ question: `第${i + 1}題：中文，"引號"\n第二行😀`, options: ['=SUM(1,2)', '+123', '-456', '@文字'], correctAnswerIndex: i % 4, explanation: '解析與依據', pirlsLevel: 'locate & retrieve' })) });
let checks = 0;
for (const count of [8, 10]) {
  const data = make(count), original = JSON.stringify(data);
  for (const platform of ['wayground', 'loilonote', 'wordwall', 'kahoot']) {
    const template = ['kahoot', 'wayground'].includes(platform) ? XLSX.readFile(path.join(root, 'public/export-templates', `${platform}.xlsx`)) : undefined;
    const book = buildPlatformWorkbook(data, platform, 60, template);
    const roundtrip = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    const sheet = roundtrip.Sheets[roundtrip.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true });
    const start = platform === 'kahoot' ? 8 : platform === 'wayground' ? 2 : 1;
    assert.equal(rows.length - start, count);
    const questionCol = platform === 'kahoot' ? 1 : 0;
    const optionCol = platform === 'loilonote' ? 5 : platform === 'wordwall' ? 1 : 2;
    const answerCol = { kahoot: 7, wayground: 7, loilonote: 3, wordwall: 5 }[platform];
    rows.slice(start).forEach((r, i) => {
      assert.equal(r[questionCol], data.questions[i].question);
      assert.equal(Number(r[answerCol]), i % 4 + 1);
      assert.deepEqual(r.slice(optionCol, optionCol + 4), data.questions[i].options);
    });
    for (const [address, cell] of Object.entries(sheet)) if (!address.startsWith('!')) assert.equal(cell.f, undefined);
    assert.equal(JSON.stringify(data), original);
    checks++;
  }
  for (const group of [false, true]) {
    captured = null;
    const name = group ? 'generatePaGamOQuizGroupExcel' : 'generatePaGamOExcel';
    const fn = load(`src/lib/${name}.ts`)[group ? 'exportPIRLStoPaGamOQuizGroup' : 'exportPIRLStoPaGamO'];
    fn(group ? { questionsOutput: data, articleContent: data.articleContent, articleTitle: data.title } : data, () => {}, () => {});
    assert.ok(captured);
    const official = XLSX.readFile(path.join(root, 'public/export-templates', group ? 'pagamo-group.xlsx' : 'pagamo-choice.xlsx'));
    assert.deepEqual(captured.SheetNames, official.SheetNames);
    assert.deepEqual(
      XLSX.utils.sheet_to_json(captured.Sheets[captured.SheetNames[0]], { header: 1, defval: null, blankrows: true }).slice(0, 10),
      XLSX.utils.sheet_to_json(official.Sheets[official.SheetNames[0]], { header: 1, defval: null, blankrows: true }).slice(0, 10),
    );
    const rows = XLSX.utils.sheet_to_json(captured.Sheets[captured.SheetNames[0]], { header: 1, defval: '' }).slice(group ? 11 : 10);
    assert.equal(rows.length, count);
    assert.equal(new Set(rows.map(r => r[0])).size, count);
    rows.forEach((r, i) => assert.equal(r[group ? 20 : 17], 'ABCD'[i % 4]));
    checks++;
  }
}
for (const mutate of [d => d.questions = [], d => d.questions[0].options.pop(), d => d.questions[0].options.push('extra'), d => d.questions[0].question = ' ', d => d.questions[0].options[0] = ' ', ...[-1, 4, 1.5, NaN].map(v => d => d.questions[0].correctAnswerIndex = v)]) {
  const d = make(1); mutate(d);
  assert.ok(validateExport(d).some(i => i.severity === 'error'));
  assert.throws(() => buildPlatformWorkbook(d, 'wordwall'));
  checks++;
}
for (const [length, expected] of [[95, false], [96, true], [120, true], [121, true]]) {
  const d = make(1); d.questions[0].question = '字'.repeat(length);
  assert.equal(validateExport(d, 'kahoot').some(i => i.severity === 'error'), expected); checks++;
}
for (const [length, expected] of [[60, false], [61, true], [75, true], [76, true]]) {
  const d = make(1); d.questions[0].options[0] = '字'.repeat(length);
  assert.equal(validateExport(d, 'kahoot').some(i => i.severity === 'error'), expected); checks++;
}
assert.ok(validateExport(make(1), 'kahoot', 15).some(i => i.severity === 'error')); checks++;
const data = make(1), draft = cloneQuestionSet(data); draft.questions[0].options[0] = 'modified';
assert.equal(data.questions[0].options[0], '=SUM(1,2)'); checks++;
console.log(`PASS: ${checks} export regression cases (workbook roundtrips, answers, counts, text, boundaries, immutability)`);
