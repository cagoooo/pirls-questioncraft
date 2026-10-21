// functions/test/privacy.test.cjs
// v0.3.0 學生隱私防線測試：先 npm run build 再跑（測 lib/ 編譯結果）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildSubmissionNotifyFields,
  extractTeacherKey,
  generateTeacherKey,
  hashTeacherKey,
  isTeacherKeyValid,
  stripTeacherSecrets,
} = require('../lib/privacy');

const STUDENT = { class: '五年甲班', seatNumber: '7', name: '王小明' };

test('交卷通知不含學生姓名，只有測驗代號、班級、座號與統計', () => {
  const fields = buildSubmissionNotifyFields({
    quizId: 'abc123',
    quizTitle: '森林裡的音樂會',
    studentInfo: STUDENT,
    correctCount: 6,
    totalCount: 8,
    accuracy: 75,
    studentWeakest: { label: '評估批判', accuracy: 50 },
    classAvgAccuracy: 70.25,
    totalSubs: 3,
    classWeakest: { label: '詮釋整合', accuracy: 60 },
  });
  const text = JSON.stringify(fields);
  assert.ok(!text.includes('王小明'), '通知不可出現學生姓名');
  assert.ok(text.includes('abc123'), '要有測驗代號');
  assert.ok(text.includes('五年甲班 7號'), '要有班級座號');
  assert.ok(text.includes('6 / 8（75%）'), '要有答對統計');
});

test('functions 原始碼的通知路徑都不再讀 studentInfo.name', () => {
  const srcDir = path.join(__dirname, '..', 'src');
  for (const f of fs.readdirSync(srcDir).filter((n) => n.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    assert.ok(!/studentInfo\??\.name/.test(src), `${f} 不可讀 studentInfo.name`);
  }
});

test('學生只有測驗代號（改網址、沒帶金鑰）讀不到全班成績', () => {
  const key = generateTeacherKey();
  const hash = hashTeacherKey(key);
  assert.equal(isTeacherKeyValid([hash, hash], null), false);
  assert.equal(isTeacherKeyValid([hash], ''), false);
  assert.equal(isTeacherKeyValid([hash], 'abc123'), false, '拿測驗代號當金鑰也不行');
  assert.equal(isTeacherKeyValid([hash], generateTeacherKey()), false, '別的金鑰不行');
});

test('出題老師帶正確金鑰可讀；測驗本體被清掉後靠作答紀錄上的雜湊仍可驗證', () => {
  const key = generateTeacherKey();
  const hash = hashTeacherKey(key);
  assert.equal(isTeacherKeyValid([hash, hash, hash], key), true);
  assert.equal(isTeacherKeyValid([undefined, hash], key), true);
});

test('安全更新前建立的舊測驗（沒有雜湊）一律拒絕', () => {
  assert.equal(isTeacherKeyValid([undefined, null], generateTeacherKey()), false);
  assert.equal(isTeacherKeyValid([], generateTeacherKey()), false);
});

test('混入不同雜湊（資料被竄改）要拒絕', () => {
  const key = generateTeacherKey();
  assert.equal(isTeacherKeyValid([hashTeacherKey(key), hashTeacherKey('other')], key), false);
});

test('金鑰只從 Authorization: Bearer 標頭讀取', () => {
  assert.equal(extractTeacherKey('Bearer xyz'), 'xyz');
  assert.equal(extractTeacherKey('xyz'), null);
  assert.equal(extractTeacherKey(undefined), null);
  assert.equal(extractTeacherKey('Bearer   '), null);
});

test('學生端讀測驗時不回傳老師金鑰雜湊', () => {
  const out = stripTeacherSecrets({ questionsOutput: {}, teacherKeyHash: 'x'.repeat(64) });
  assert.ok(!('teacherKeyHash' in out));
  assert.ok('questionsOutput' in out);
});

test('老師金鑰夠長且每次不同', () => {
  const a = generateTeacherKey();
  const b = generateTeacherKey();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
});
