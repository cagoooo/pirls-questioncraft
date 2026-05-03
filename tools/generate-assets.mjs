// tools/generate-assets.mjs
// 一次生成 favicon PNG（多尺寸）+ OG 預覽圖（1200×630），中文用 Noto Sans TC 嵌入避免方塊。
//
// 用法：node tools/generate-assets.mjs
// 輸出：
//   public/icons/favicon-32.png       (32x32, 一般瀏覽器分頁圖示)
//   public/icons/apple-touch-icon.png (180x180, iOS 主畫面)
//   public/icons/icon-192.png         (192x192, PWA / Android)
//   public/icons/icon-512.png         (512x512, PWA splash)
//   public/images/social-preview.png  (1200x630, FB / LINE / Twitter OG)

import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// 註冊已有的 Noto Sans TC 字型（避免中文方塊）
GlobalFonts.registerFromPath(resolve(ROOT, 'public/fonts/NotoSansTC-Bold.ttf'),    'NotoSansTC');
GlobalFonts.registerFromPath(resolve(ROOT, 'public/fonts/NotoSansTC-Black.ttf'),   'NotoSansTC-Black');
GlobalFonts.registerFromPath(resolve(ROOT, 'public/fonts/NotoSansTC-Regular.ttf'), 'NotoSansTC-Regular');

// ---------- 1. 從 SVG 渲染 favicon PNG（多尺寸）----------
async function renderFaviconPNGs() {
  const svgBuf = await readFile(resolve(ROOT, 'public/icons/favicon.svg'));
  const sizes = [
    { size: 32,  out: 'public/icons/favicon-32.png' },
    { size: 180, out: 'public/icons/apple-touch-icon.png' },
    { size: 192, out: 'public/icons/icon-192.png' },
    { size: 512, out: 'public/icons/icon-512.png' },
  ];
  for (const { size, out } of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(svgBuf);
    ctx.drawImage(img, 0, 0, size, size);
    await writeFile(resolve(ROOT, out), canvas.toBuffer('image/png'));
    console.log(`✓ ${out} (${size}×${size})`);
  }
}

// ---------- 2. 生成 OG 預覽圖 1200×630 ----------
async function renderOGImage() {
  const W = 1200, H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 背景：藍紫漸層
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   '#3B82F6');
  grad.addColorStop(0.6, '#6366F1');
  grad.addColorStop(1,   '#A387D9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 半透明圓角白底卡片（讓文字可讀）
  const cardX = 60, cardY = 60, cardW = W - 120, cardH = H - 120, r = 32;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  roundRect(ctx, cardX, cardY, cardW, cardH, r);
  ctx.fill();

  // 左側文字區
  const padL = 96, padT = 130;

  // 上方標籤
  ctx.fillStyle = '#A387D9';
  ctx.font = 'bold 28px NotoSansTC';
  ctx.textBaseline = 'top';
  ctx.fillText('PIRLS · 國際閱讀素養評量', padL, padT);

  // 主標題（兩行）
  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 72px NotoSansTC-Black';
  ctx.fillText('閱讀素養題組', padL, padT + 56);
  ctx.fillText('生成站', padL, padT + 56 + 92);

  // 副標題
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 30px NotoSansTC';
  ctx.fillText('上傳圖片或貼上文章 → AI 自動出', padL, padT + 56 + 92 + 110);
  ctx.fillStyle = '#3B82F6';
  ctx.fillText('PIRLS 四層次選擇題', padL, padT + 56 + 92 + 110 + 42);

  // 底部署名
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 22px NotoSansTC-Regular';
  ctx.fillText('阿凱老師 · 桃園市石門國小資訊組', padL, H - 130);
  ctx.fillStyle = '#A387D9';
  ctx.fillText('cagoooo.github.io/pirls-questioncraft', padL, H - 100);

  // 右側 logo（攤開的書 + 4 色 PIRLS 條 + sparkle）
  drawDecoration(ctx, W - 320, H / 2, 240);

  await writeFile(resolve(ROOT, 'public/images/social-preview.png'), canvas.toBuffer('image/png'));
  console.log('✓ public/images/social-preview.png (1200×630)');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawDecoration(ctx, cx, cy, size) {
  // 圓角方形漸層底（呼應 favicon）
  const bgSize = size * 1.1;
  const bx = cx - bgSize / 2, by = cy - bgSize / 2;
  const grad = ctx.createLinearGradient(bx, by, bx + bgSize, by + bgSize);
  grad.addColorStop(0, '#3B82F6');
  grad.addColorStop(1, '#A387D9');
  ctx.fillStyle = grad;
  roundRect(ctx, bx, by, bgSize, bgSize, 36);
  ctx.fill();

  // 攤開的書
  ctx.save();
  ctx.translate(cx, cy + 8);
  const bookW = size * 0.78, bookH = size * 0.50;
  // 左頁
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E40AF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-bookW/2,  -bookH/2 - 2);
  ctx.lineTo(-2,        -bookH/2 + 5);
  ctx.lineTo(-2,         bookH/2 - 1);
  ctx.lineTo(-bookW/2,   bookH/2 + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 右頁
  ctx.beginPath();
  ctx.moveTo(bookW/2,   -bookH/2 - 2);
  ctx.lineTo(2,         -bookH/2 + 5);
  ctx.lineTo(2,          bookH/2 - 1);
  ctx.lineTo(bookW/2,    bookH/2 + 6);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 4 條 PIRLS 層次彩色橫線
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#A387D9'];
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const yOffset = -bookH/2 + 22 + i * 18;
    ctx.strokeStyle = colors[i];
    // 左頁
    ctx.beginPath();
    ctx.moveTo(-bookW/2 + 12, yOffset + 4);
    ctx.lineTo(-12, yOffset + 4);
    ctx.stroke();
    // 右頁
    ctx.beginPath();
    ctx.moveTo(12, yOffset + 4);
    ctx.lineTo(bookW/2 - 12, yOffset + 4);
    ctx.stroke();
  }
  ctx.restore();

  // sparkle
  ctx.save();
  ctx.translate(cx + size * 0.42, cy - size * 0.42);
  ctx.fillStyle = '#FBBF24';
  ctx.beginPath();
  const s = 18;
  ctx.moveTo(0, -s);
  ctx.lineTo(s/4, -s/4);
  ctx.lineTo(s, 0);
  ctx.lineTo(s/4, s/4);
  ctx.lineTo(0, s);
  ctx.lineTo(-s/4, s/4);
  ctx.lineTo(-s, 0);
  ctx.lineTo(-s/4, -s/4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- main ----------
console.log('Generating PIRLS QuestionCraft assets...\n');
await renderFaviconPNGs();
await renderOGImage();
console.log('\n✅ Done.');
