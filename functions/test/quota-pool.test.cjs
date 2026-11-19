// functions/test/quota-pool.test.cjs
// v0.4.0：開發者每月共用額度池（金額換算、換月、通知門檻、引導訊息）
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  estimateCostTwd,
  taipeiMonth,
  nextTaipeiMonthStart,
  crossedThreshold,
  POOL_EXHAUSTED_MESSAGE,
  dailyLimitMessage,
  EXTENSION_REVIEW_URL,
  DEFAULT_BUDGET_TWD,
} = require('../lib/quota-pool');

test('花費換算：輸入 0.30、輸出（含思考）2.50 美元／百萬 token，匯率 32', () => {
  // 100 萬輸入 = 0.30 美元 = 9.6 元
  assert.ok(Math.abs(estimateCostTwd({ inputTokens: 1_000_000 }) - 9.6) < 1e-9);
  // 50 萬輸出 + 50 萬思考 = 2.50 美元 = 80 元
  assert.ok(Math.abs(estimateCostTwd({ outputTokens: 500_000, thoughtsTokens: 500_000 }) - 80) < 1e-9);
  // 缺欄位、負數、非數字都當 0
  assert.equal(estimateCostTwd({}), 0);
  assert.equal(estimateCostTwd({ inputTokens: -5, outputTokens: 'x' }), 0);
});

test('一般出題一次大約幾毛錢，NT$50 夠用幾十次', () => {
  // 典型：輸入 4000、輸出 3000、思考 6000 token
  const one = estimateCostTwd({ inputTokens: 4000, outputTokens: 3000, thoughtsTokens: 6000 });
  assert.ok(one > 0.3 && one < 1.5, `一次約 ${one.toFixed(2)} 元`);
  assert.equal(DEFAULT_BUDGET_TWD, 50);
});

test('台北時間換月：UTC 1/31 16:00 已經是台北 2/1', () => {
  assert.equal(taipeiMonth(Date.UTC(2026, 0, 31, 15, 59)), '2026-01');
  assert.equal(taipeiMonth(Date.UTC(2026, 0, 31, 16, 0)), '2026-02');
});

test('重新開放時間是下個月 1 日台北午夜（含 12 月跨年）', () => {
  assert.equal(nextTaipeiMonthStart(Date.UTC(2026, 10, 19, 3)), Date.UTC(2026, 10, 30, 16));
  assert.equal(nextTaipeiMonthStart(Date.UTC(2026, 11, 20, 3)), Date.UTC(2026, 11, 31, 16));
});

test('通知門檻：跨過 8 成通知一次、跨過上限通知一次', () => {
  assert.equal(crossedThreshold(30, 39, 50), null);
  assert.equal(crossedThreshold(39, 40.5, 50), 80);
  assert.equal(crossedThreshold(45, 50.2, 50), 100);
  assert.equal(crossedThreshold(30, 55, 50), 100); // 一次跨兩個門檻，只發「用完」
  assert.equal(crossedThreshold(51, 52, 50), null); // 已經超過，不再通知
  assert.equal(crossedThreshold(0, 1, 0), null);
});

test('引導訊息：提到 Chrome 擴充套件、自己的免費金鑰、五星好評', () => {
  for (const msg of [POOL_EXHAUSTED_MESSAGE, dailyLimitMessage(3)]) {
    assert.match(msg, /Chrome 擴充套件/);
    assert.match(msg, /免費 Gemini 金鑰/);
    assert.match(msg, /五星好評/);
  }
  assert.match(dailyLimitMessage(3), /今天的 3 次/);
  assert.match(EXTENSION_REVIEW_URL, /^https:\/\/chromewebstore\.google\.com\/detail\/cfbehdinangicblpbnockoofeccmoidp\/reviews$/);
});

const { guideClickEvent } = require('../lib/guide-click');

test('v0.4.1 引導點擊：只接受白名單內的來源與按鈕', () => {
  assert.equal(guideClickEvent('daily', 'store'), 'guide-daily-store');
  assert.equal(guideClickEvent('pool', 'review'), 'guide-pool-review');
  assert.equal(guideClickEvent('last-one', 'install'), 'guide-last-one-install');
  assert.equal(guideClickEvent('banner', 'store'), 'guide-banner-store');
  assert.equal(guideClickEvent('hero', 'install'), 'guide-hero-install');
  assert.equal(guideClickEvent('daily', 'hack'), null);
  assert.equal(guideClickEvent('x.y', 'store'), null);
  assert.equal(guideClickEvent(undefined, undefined), null);
  assert.equal(guideClickEvent({ toString: () => 'daily' }, 'store'), null);
});
