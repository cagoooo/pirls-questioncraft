// public/sw.js
// PIRLS QuestionCraft Service Worker（B.18：自動更新版本機制）
// 分策略快取（依 skill pwa-cache-bust 最佳實踐）：
//   - HTML / navigate：network-first（永遠拿最新 HTML，斷線才用快取）
//   - _next/static/* 已含 content hash：cache-first（檔名變了自然取新版）
//   - version.json：bypass SW，永遠走 network（讓 polling 不被快取騙）
//   - Cloud Functions / 第三方 (Cloudflare Turnstile / fonts)：bypass SW
//   - 圖片 / 字型 / icons：cache-first（不常變動）
//
// SW 自身的更新流程：
//   1. 新版 sw.js 部署 → 瀏覽器自動偵測 byte 差異 → install 新 SW
//   2. skipWaiting() 立即從 waiting 變 active
//   3. clients.claim() 立刻接管所有開啟的 tab
//   4. controllerchange 觸發前端 banner → 使用者點「更新」reload

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `pirls-static-${CACHE_VERSION}`;
const HTML_CACHE = `pirls-html-${CACHE_VERSION}`;

self.addEventListener('install', (e) => {
  // 不等舊 SW 退場，立刻 active
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // 清掉舊版 cache（不同 CACHE_VERSION 的）
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('pirls-') && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      // 立刻接管所有 tab
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 跳過非 http/https（chrome-extension、file://）
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 跳過跨域請求（Cloud Functions / Cloudflare Turnstile / Google Fonts CDN 等）
  if (url.origin !== self.location.origin) return;

  // version.json 強制走 network，**絕對不能 cache**
  if (url.pathname.endsWith('/version.json') || url.pathname.includes('/export-templates/')) return;

  // HTML / navigate → network-first
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(req, HTML_CACHE));
    return;
  }

  // 其他 GET（_next chunks、images、icons、fonts）→ cache-first
  event.respondWith(cacheFirst(req, STATIC_CACHE));
});

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok && fresh.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // 連 network 都連不上、也沒快取 → 回 fallback HTML
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>離線</title><h1>離線</h1><p>請檢查網路後重新整理。</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok && fresh.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    return new Response('', { status: 503 });
  }
}

// 接收前端訊息：使用者按「立即更新」時，前端會 postMessage('SKIP_WAITING')
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
