// functions/test/prompt-explanation.test.cjs
// v0.3.1 解析改為「答後講解」（會說出答案）；v0.4.5 依阿凱老師要求改為「閱讀引導」：
// 指出回到哪一段、提示找什麼或怎麼想，不可說出答案，讓學生自己回文章找。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const norm = (t) => t.split(String.fromCharCode(13)).join('');
const FLOWS = ['generate-from-text.ts', 'generate-from-images.ts'].map((f) => ({
  name: f,
  src: norm(fs.readFileSync(path.join(__dirname, '..', 'src', 'flows', f), 'utf8')),
}));
const EXT = norm(fs.readFileSync(path.join(__dirname, '..', '..', 'extension', 'lib', 'prompt.js'), 'utf8'));
const HEAD = '# ✍️ explanation 的寫法（閱讀引導：不可說出答案）';

function section(src, from = 0) {
  const start = src.indexOf(HEAD, from);
  const end = src.indexOf('# 📝 自我檢查', start);
  return start >= 0 && end > start ? src.slice(start, end) : '';
}

for (const { name, src } of FLOWS) {
  test(`${name}：沒有舊的「答後講解、直接說明答案」規則`, () => {
    assert.ok(!/答後講解/.test(src));
    assert.ok(!/應該直接說明答案/.test(src));
    assert.ok(!/為什麼正確答案對/.test(src));
  });

  test(`${name}：explanation 是閱讀引導三要素，且明確禁止說出答案`, () => {
    const s = section(src);
    assert.ok(s, '缺少閱讀引導段落');
    assert.match(s, /回到哪裡/);
    assert.match(s, /找什麼、怎麼想/);
    assert.match(s, /練習的能力/);
    assert.match(s, /絕對不可以寫出正確答案/);
    assert.match(s, /答案是/); // 列在「不可以」清單裡
  });

  test(`${name}：好的範例本身沒有說出答案，範例標明只示範格式`, () => {
    const s = section(src);
    assert.match(s, /只示範格式/);
    const good = s.slice(s.indexOf('✅'), s.indexOf('❌'));
    assert.ok(!/答案是|正確答案|所以選|重新綁好/.test(good), '好的範例不可以說出答案');
  });

  test(`${name}：自我檢查要求完全沒有寫出答案`, () => {
    assert.match(src, /完全沒有寫出正確答案或它的意思/);
  });
}

test('文字版與圖片版的閱讀引導規則一致', () => {
  assert.equal(section(FLOWS[0].src), section(FLOWS[1].src));
});

test('擴充功能的文字、圖片提示詞與網站後端的閱讀引導規則一致，影片版也禁止說出答案', () => {
  const first = section(EXT);
  const second = section(EXT, EXT.indexOf(HEAD) + 1);
  assert.equal(first, section(FLOWS[0].src));
  assert.equal(second, section(FLOWS[0].src));
  assert.ok(!/答後講解/.test(EXT));
  const video = EXT.slice(EXT.lastIndexOf(HEAD));
  assert.match(video, /影片時間點/);
  assert.match(video, /絕對不可以寫出正確答案/);
});

test('學生端只在作答後顯示閱讀引導，標題已改名', () => {
  const quiz = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'QuizView.tsx'), 'utf8');
  const idx = quiz.indexOf('{currentQuestion.explanation}');
  assert.ok(idx > 0);
  const before = quiz.slice(Math.max(0, idx - 1500), idx);
  assert.ok(before.lastIndexOf('{isCurrentQuestionAnswered && (') > 0, '引導必須包在 isCurrentQuestionAnswered 條件內');
  assert.ok(!/答後講解/.test(quiz));
  assert.match(quiz, /閱讀引導：/);
});

// v0.4.6 答案依據（answerEvidence）：只給老師看，先寫依據再選正解
const EVID_HEAD = '# 🔍 answerEvidence 的寫法（答案依據：只給老師看）';
function evidence(src, from = 0) {
  const start = src.indexOf(EVID_HEAD, from);
  const end = src.indexOf('# ✍️ explanation 的寫法', start);
  return start >= 0 && end > start ? src.slice(start, end) : '';
}

test('答案依據段落：網站文字、截圖與擴充功能兩份逐字相同，寫明只給老師看、先依據再正解', () => {
  const s = evidence(FLOWS[0].src);
  assert.ok(s, '缺少答案依據段落');
  assert.match(s, /學生完全看不到、也不會匯出/);
  assert.match(s, /先寫好 .{0,3}answerEvidence.{0,3}，再決定 .{0,3}correctAnswerIndex/);
  assert.match(s, /explanation.{0,3}（閱讀引導）仍然不可以/);
  assert.equal(evidence(FLOWS[1].src), s);
  assert.equal(evidence(EXT), s);
  assert.equal(evidence(EXT, EXT.indexOf(EVID_HEAD) + 1), s);
  assert.match(EXT.slice(EXT.lastIndexOf(EVID_HEAD)), /影片時間點/);
});

test('輸出格式：answerEvidence 是必填，而且排在 correctAnswerIndex 前面', () => {
  for (const { name, src } of FLOWS) {
    const i = src.indexOf('answerEvidence: z.string()');
    assert.ok(i > 0, `${name} 缺少 answerEvidence`);
    assert.ok(i < src.indexOf('correctAnswerIndex: z.number()'), `${name} 答案依據要在正解前面`);
  }
});
