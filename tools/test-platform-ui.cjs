// Optional browser smoke test: PLAYWRIGHT_MODULE may point to a bundled Playwright install.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..', 'out');
const artifacts = process.env.EXPORT_TEST_ARTIFACTS;
if (!artifacts) throw new Error('Set EXPORT_TEST_ARTIFACTS to a local output directory.');
fs.mkdirSync(artifacts, { recursive: true });
const data = { title: '測試閱讀題組', articleContent: 'READING_SOURCE 唯一原文。小明觀察溪流，發現水中有魚。', questions: Array.from({ length: 8 }, (_, i) => ({ question: `第 ${i + 1} 題：小明觀察什麼？`, options: ['溪流', '高山', '森林', '海洋'], correctAnswerIndex: i % 4, explanation: 'ANSWER_SECRET 解題說明。', pirlsLevel: ['locate & retrieve', 'make straightforward inferences', 'interpret & integrate', 'evaluate & critique'][i % 4] })) };
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/pirls-questioncraft\/?/, '');
  let file = path.resolve(root, rel || 'index.html');
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('cloudfunctions.net')) return route.fulfill({ json: { success: true, data } });
      if (url.includes('challenges.cloudflare.com')) return route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:(_,o)=>{o.callback("local-test");return "test"},reset:()=>{},remove:()=>{}};' });
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/pirls-questioncraft/`);
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: '貼上文本', exact: true }).click();
    await page.getByPlaceholder('請在此貼上您想出題的文章內容…').fill(data.articleContent);
    await page.getByRole('button', { name: /開始生成 PIRLS 四層次題目/ }).click();
    await page.getByRole('button', { name: '📦 更多平台／閱讀素材' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('8／8 題通過格式檢查', { exact: true }).waitFor();
    for (const platform of ['wayground', 'loilonote', 'wordwall', 'kahoot']) {
      console.log('Checking browser export:', platform);
      await page.getByLabel('目標平台', { exact: true }).selectOption(platform);
      const downloadPromise = page.waitForEvent('download');
      await dialog.getByRole('button', { name: platform === 'wordwall' ? '下載 Wordwall 貼題準備表' : new RegExp(`^下載 ${platform === 'wayground' ? 'Wayground' : platform === 'loilonote' ? 'LoiLoNote' : 'Kahoot'}`) }).click();
      const download = await downloadPromise;
      const file = path.join(artifacts, download.suggestedFilename());
      await download.saveAs(file);
      const book = XLSX.readFile(file);
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, blankrows: true });
      assert.equal(rows.length - (platform === 'kahoot' ? 8 : platform === 'wayground' ? 2 : 1), 8);
    }
    await dialog.locator('summary').click();
    await page.getByLabel('第 1 題題幹', { exact: true }).fill('字'.repeat(96));
    assert.equal(await dialog.getByRole('button', { name: '下載 Kahoot 題目', exact: true }).isDisabled(), true);
    await page.getByLabel('第 1 題題幹', { exact: true }).fill('修改後題幹');
    assert.equal(await dialog.getByRole('button', { name: '下載 Kahoot 題目', exact: true }).isEnabled(), true);
    await page.getByLabel('目標平台', { exact: true }).selectOption('wordwall');
    assert.equal(await page.getByLabel('第 1 題題幹', { exact: true }).inputValue(), data.questions[0].question);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await dialog.getByRole('button', { name: '複製第 1 題題幹', exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), data.questions[0].question);
    const pdfPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '📄 學生閱讀素材 PDF', exact: true }).click();
    await (await pdfPromise).saveAs(path.join(artifacts, 'student-reading.pdf'));
    const backupPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: '💾 教師題庫備份', exact: true }).click();
    const backupPath = path.join(artifacts, 'teacher-backup.json');
    await (await backupPromise).saveAs(backupPath);
    assert.equal(JSON.parse(fs.readFileSync(backupPath)).original.questions[0].explanation, data.questions[0].explanation);
    await dialog.locator('summary').click();
    await page.screenshot({ path: path.join(artifacts, 'desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'mobile.png') });
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto(`http://127.0.0.1:${server.address().port}/pirls-questioncraft/`);
    await page.locator('input[type="file"]').setInputFiles(path.join(artifacts, 'mobile.png'));
    await page.getByRole('button', { name: /開始生成 PIRLS 四層次題目/ }).click();
    await page.getByRole('button', { name: '📦 更多平台／閱讀素材' }).click();
    const imagePdfPromise = page.waitForEvent('download');
    await page.getByRole('dialog').getByRole('button', { name: '📄 學生閱讀素材 PDF', exact: true }).click();
    await (await imagePdfPromise).saveAs(path.join(artifacts, 'student-image-reading.pdf'));
    assert.deepEqual(errors, []);
    console.log('PASS: 4 browser XLSX downloads, Kahoot blocking/edit/reset, Wordwall clipboard, text/image reading PDF and backup downloads, mobile overflow, no page errors.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
