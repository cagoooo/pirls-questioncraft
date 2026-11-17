// PaGamO「題目總覽」：上傳後由 pagamo-upload.js 帶過來，找出剛上傳的題目並標出來。
// PaGamO 檢查通過後會在背景處理（實測不到 1 分鐘），還沒出現就每 15 秒重新整理一次，最多 3 分鐘。
// 2026-11-15 偵察：每題是一張 .ant-card，內含「ID 1234567」與題組標題／題幹，最新的排最前面。
(async () => {
  if (window.__pirlsOverviewBusy) return;
  window.__pirlsOverviewBusy = true;

  const VALID_MS = 15 * 60 * 1000;
  const RETRY_MS = 15000;
  const MAX_TRIES = 12;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const { pagamoWatch: w } = await chrome.storage.local.get('pagamoWatch');
  if (!w || Date.now() - w.ts > VALID_MS) {
    window.__pirlsOverviewBusy = false;
    return;
  }

  const host = document.createElement('div');
  host.setAttribute('data-pirls-pagamo', '');
  host.style.cssText = 'all:initial;position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(720px,calc(100vw - 24px));';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .bar { font: 15px/1.6 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif; color:#3D2E1E; background:#FFF9EE;
             border:1.5px solid #3D2E1E; border-radius:16px; box-shadow:0 5px 0 #3D2E1E; padding:12px 44px 12px 16px; position:relative; }
      .bar.ok { background:#E3F0E1; } .bar.err { background:#FBE1D8; border-color:#B9472E; }
      .x { position:absolute; right:10px; top:8px; border:0; background:transparent; font-size:20px; cursor:pointer; color:#3D2E1E; }
      b { color:#7A3E1E; }
      .act { margin-left:10px; font:inherit; font-size:14px; padding:2px 12px; border:1.5px solid #3D2E1E; border-radius:999px;
             background:#FFF9EE; color:#3D2E1E; cursor:pointer; box-shadow:0 2px 0 #3D2E1E; }
      .act:hover { background:#F2DC83; }
    </style>
    <div class="bar" role="status"><span class="msg"></span><button class="x" aria-label="關閉提示">×</button></div>`;
  document.documentElement.appendChild(host);
  const bar = root.querySelector('.bar');
  const msg = root.querySelector('.msg');
  const show = (kind, html) => { bar.className = `bar ${kind}`; msg.innerHTML = html; };
  let stopped = false;
  const stop = async () => { stopped = true; await chrome.storage.local.remove('pagamoWatch'); };
  root.querySelector('.x').addEventListener('click', async () => { await stop(); host.remove(); });
  root.addEventListener('click', async (ev) => {
    if (ev.target?.dataset?.act !== 'stop') return;
    await stop();
    show('ok', '已停止自動重新整理。之後按瀏覽器的重新整理，就會看到最新的題目。');
  });

  const norm = (s) => String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, '').slice(0, 24);
  const keys = (w.matches || []).map(norm).filter((k) => k.length >= 4);
  const title = esc(w.title || '');

  try {
    // 等題目清單載入（最多 15 秒）
    const end = Date.now() + 15000;
    let cards = [];
    while (Date.now() < end) {
      cards = [...document.querySelectorAll('.ant-card')].filter((c) => /ID\s*\d+/.test(c.textContent));
      if (cards.length) break;
      await sleep(400);
    }
    const found = keys.length ? cards.filter((c) => { const t = c.textContent.replace(/\s+/g, ''); return keys.some((k) => t.includes(k)); }) : [];

    if (found.length) {
      await stop();
      found.forEach((c) => {
        c.style.outline = '4px solid #E89B7B';
        c.style.outlineOffset = '2px';
        c.style.boxShadow = '0 0 0 8px rgba(242,220,131,.55)';
      });
      found[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      const ids = found.map((c) => (c.textContent.match(/ID\s*(\d+)/) || [])[1]).filter(Boolean);
      const what = found.length > 1 ? `<b>${found.length}</b> 題` : '題目';
      show('ok', `🎉 上傳完成！「<b>${title}</b>」的${what}已經在題目總覽（ID ${esc(ids.join('、'))}，已用橘框標出）。<br>直接點一下橘框裡的題目，右邊會打開「查看題目」，可以檢查正解與附圖。`);
      return;
    }

    const tries = (w.tries || 0) + 1;
    if (tries > MAX_TRIES || !keys.length) {
      await stop();
      show('ok', `⌛ PaGamO 還在處理「<b>${title}</b>」（官方說最久約 10 分鐘），稍後按瀏覽器的重新整理就會出現在最上面。`);
      return;
    }
    await chrome.storage.local.set({ pagamoWatch: { ...w, tries } });
    let sec = RETRY_MS / 1000;
    const tick = () => {
      if (stopped) return;
      if (sec <= 0) { location.reload(); return; }
      show('ok', `⏳ PaGamO 正在處理剛上傳的「<b>${title}</b>」（通常不到 1 分鐘）。<b>${sec}</b> 秒後自動重新整理（第 ${tries} 次）<button class="act" data-act="stop">不用了</button>`);
      sec -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  } catch (e) {
    show('err', `⚠️ 找剛上傳的題目時出了問題：${esc(e.message)}。請自己看題目總覽最上面幾題。`);
  } finally {
    window.__pirlsOverviewBusy = false;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
})();
