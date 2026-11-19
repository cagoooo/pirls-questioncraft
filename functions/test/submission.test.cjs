// functions/test/submission.test.cjs
// v0.3.9：全校共用網路位址也不會被交卷限流擋下；重送只存一筆
const test = require('node:test');
const assert = require('node:assert/strict');
const { submitRateKey, isValidClientSubmissionId, SUBMIT_PER_MINUTE } = require('../lib/submission');

test('限流鍵包含網路位址與測驗代號：同校不同測驗分開計算', () => {
  const ip = '203.71.1.1';
  assert.notEqual(submitRateKey(ip, 'quizA'), submitRateKey(ip, 'quizB'));
  assert.equal(submitRateKey(ip, 'quizA'), submitRateKey(ip, 'quizA'));
  assert.ok(submitRateKey(ip, 'quizA').includes(ip));
});

test('限流鍵不受奇怪的測驗代號影響', () => {
  assert.equal(submitRateKey('1.1.1.1', undefined), '1.1.1.1|submit|none');
  assert.equal(submitRateKey('1.1.1.1', 'a/b../c'), '1.1.1.1|submit|abc');
  assert.ok(submitRateKey('1.1.1.1', 'x'.repeat(500)).length < 80);
});

test('一班 30 人同一分鐘交卷不會被擋', () => {
  assert.ok(SUBMIT_PER_MINUTE >= 30);
});

test('交卷編號格式檢查', () => {
  assert.equal(isValidClientSubmissionId('a3f9c2e1b7d4a6f8c0e2b4d6f8a1c3e5'), true);
  assert.equal(isValidClientSubmissionId('short'), false);
  assert.equal(isValidClientSubmissionId('has/slash/aaaaaaaaaaaa'), false);
  assert.equal(isValidClientSubmissionId(12345678901234), false);
  assert.equal(isValidClientSubmissionId(undefined), false);
  assert.equal(isValidClientSubmissionId('x'.repeat(65)), false);
});
