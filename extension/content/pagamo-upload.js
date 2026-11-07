// PaGamO 批量上傳頁：自動選題型、放入 xlsx，框出「上傳」按鈕讓老師確認後自己按。
// 2026-11-07 實地偵察：React + Ant Design、無 iframe；選檔時不會上傳（customRequest 直接回報成功），按「上 傳」才送出。
(async () => {
  if (window.__pirlsPagamoBusy) return;
  window.__pirlsPagamoBusy = true;

  const VALID_MS = 10 * 60 * 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, ms = 20000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        const v = fn();
        if (v) return v;
      } catch { /* 頁面還在載入 */ }
      await sleep(300);
    }
    return null;
  }

  // ---------- 頂端提示列 ----------
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
    </style>
    <div class="bar" role="status"><span class="msg">📦 PIRLS 小幫手：正在準備上傳…</span><button class="x" aria-label="關閉提示">×</button></div>`;
  document.documentElement.appendChild(host);
  const bar = root.querySelector('.bar');
  const msg = root.querySelector('.msg');
  root.querySelector('.x').addEventListener('click', () => host.remove());
  const show = (kind, html) => { bar.className = `bar ${kind}`; msg.innerHTML = html; };

  const { pagamoPending: p } = await chrome.storage.local.get('pagamoPending');
  if (!p || Date.now() - p.ts > VALID_MS) {
    host.remove();
    window.__pirlsPagamoBusy = false;
    return;
  }
  const manual = `檔案「<b>${esc(p.name)}</b>」已經下載到電腦，可以自己選題型「<b>${esc(p.typeLabel)}</b>」，再把檔案拖進上傳區。`;

  try {
    // 1. 選題型
    const label = await waitFor(() => [...document.querySelectorAll('label.ant-radio-wrapper')].find((l) => l.textContent.trim() === p.typeLabel));
    if (!label) throw new Error(`找不到「${p.typeLabel}」題型選項（PaGamO 頁面可能改版了）。`);
    if (!label.classList.contains('ant-radio-wrapper-checked')) label.click();
    const picked = await waitFor(() => label.classList.contains('ant-radio-wrapper-checked'), 5000);
    if (!picked) throw new Error(`沒辦法選到「${p.typeLabel}」題型。`);
    await sleep(300);

    // 2. 放入檔案（只放進欄位，不會上傳）
    const input = await waitFor(() => document.querySelector('input[type=file]'));
    if (!input) throw new Error('找不到檔案上傳欄位。');
    const bytes = Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], p.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const listed = await waitFor(() => [...document.querySelectorAll('.ant-upload-list-item-name, .ant-upload-list-item')].some((e) => e.textContent.includes(p.name)), 6000);
    if (!listed) throw new Error('檔案沒有出現在 PaGamO 的上傳清單。');

    await chrome.storage.local.remove('pagamoPending');

    // 3. 框出「上傳」按鈕，讓老師確認後自己按
    const submit = [...document.querySelectorAll('button[type=submit], button')].find((b) => b.textContent.replace(/\s/g, '') === '上傳');
    if (submit) {
      submit.style.outline = '4px solid #E89B7B';
      submit.style.outlineOffset = '4px';
      submit.style.transition = 'outline-color .6s';
      let on = true;
      const blink = setInterval(() => { on = !on; submit.style.outlineColor = on ? '#E89B7B' : '#F2DC83'; }, 600);
      submit.addEventListener('click', () => {
        clearInterval(blink);
        submit.style.outline = '';
        show('ok', '⏳ 已按下上傳，請看 PaGamO 顯示的結果。完成後可到「題目總覽」確認題數與正解。');
      }, { once: true });
      submit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    show('ok', `✅ 已選好題型「<b>${esc(p.typeLabel)}</b>」並放入「<b>${esc(p.name)}</b>」。<br>請確認後按下方閃爍的「<b>上傳</b>」按鈕。`);
  } catch (e) {
    show('err', `⚠️ 自動放檔沒有完成：${esc(e.message)}<br>${manual}`);
  } finally {
    window.__pirlsPagamoBusy = false;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
})();
