// functions/test/guide-click.test.cjs
// 2026-11-26：引導按鈕點擊計數白名單（新增 Gemini 技能兩個按鈕）
const test = require('node:test');
const assert = require('node:assert/strict');
const { guideClickEvent } = require('../lib/guide-click');

test('原本的擴充套件按鈕照常計數', () => {
  assert.equal(guideClickEvent('daily', 'store'), 'guide-daily-store');
  assert.equal(guideClickEvent('pool', 'review'), 'guide-pool-review');
  assert.equal(guideClickEvent('banner', 'install'), 'guide-banner-install');
});

test('新增：下載 Gemini 技能、看技能安裝教學', () => {
  assert.equal(guideClickEvent('daily', 'skill'), 'guide-daily-skill');
  assert.equal(guideClickEvent('pool', 'skill-guide'), 'guide-pool-skill-guide');
});

test('不在白名單的來源或按鈕一律拒絕', () => {
  assert.equal(guideClickEvent('evil', 'skill'), null);
  assert.equal(guideClickEvent('daily', 'anything'), null);
  assert.equal(guideClickEvent(undefined, undefined), null);
  assert.equal(guideClickEvent('daily', '__proto__'), null);
});
