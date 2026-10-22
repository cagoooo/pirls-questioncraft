// functions/test/prompt-explanation.test.cjs
// v0.3.1 解析改為「答後講解」：出題指令不可再同時要求「引用原文」又要求「不可洩漏答案」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FLOWS = ['generate-from-text.ts', 'generate-from-images.ts'].map((f) => ({
  name: f,
  src: fs.readFileSync(path.join(__dirname, '..', 'src', 'flows', f), 'utf8'),
}));

function section(src) {
  const start = src.indexOf('# ✍️ explanation 的寫法（答後講解）');
  const end = src.indexOf('# 📝 自我檢查');
  return start >= 0 && end > start ? src.slice(start, end) : '';
}

for (const { name, src } of FLOWS) {
  test(`${name}：不再有互相矛盾的「不可洩漏答案」規則`, () => {
    assert.ok(!/洩漏正確答案/.test(src));
  });

  test(`${name}：explanation 要求答後講解三要素`, () => {
    const s = section(src);
    assert.ok(s, '缺少答後講解段落');
    assert.match(s, /作答之後/);
    assert.match(s, /線索在哪裡/);
    assert.match(s, /為什麼正確答案對/);
    assert.match(s, /其他選項為什麼不對/);
  });

  test(`${name}：範例標明只示範格式`, () => {
    assert.match(section(src), /只示範格式/);
  });
}

test('文字版與圖片版的答後講解規則一致', () => {
  assert.equal(section(FLOWS[0].src), section(FLOWS[1].src));
});

test('學生端只在作答後顯示講解', () => {
  const quiz = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'QuizView.tsx'), 'utf8');
  const idx = quiz.indexOf('{currentQuestion.explanation}');
  assert.ok(idx > 0);
  const before = quiz.slice(Math.max(0, idx - 1500), idx);
  assert.ok(before.lastIndexOf('{isCurrentQuestionAnswered && (') > 0, '講解必須包在 isCurrentQuestionAnswered 條件內');
});
