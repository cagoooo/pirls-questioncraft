// PaGamO 批量上傳頁：自動選題型、放入 xlsx，倒數 5 秒自動按「上傳」（可取消改自己按）；
// PaGamO 回報「檔案檢查通過」後，帶老師到「題目總覽」，由 content/pagamo-overview.js 標出剛上傳的題目。
// 2026-11-07 實地偵察：React + Ant Design、無 iframe；選檔時不會上傳（customRequest 直接回報成功），按「上 傳」才送出。
(async () => {
  if (window.__pirlsPagamoBusy) return;
  window.__pirlsPagamoBusy = true;

  const VALID_MS = 10 * 60 * 1000;
  const AUTO_SECONDS = 5; // 放好檔案後倒數幾秒自動按「上傳」
  const OVERVIEW_URL = 'https://www.pagamo.org/api/teacher_console/questions/overview';
  const pageText = () => document.body?.innerText || '';
  const count = (t, w) => t.split(w).length - 1;
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
      a { color:#7A3E1E; font-weight:700; }
      .act { margin-left:10px; font:inherit; font-size:14px; padding:2px 12px; border:1.5px solid #3D2E1E; border-radius:999px;
             background:#FFF9EE; color:#3D2E1E; cursor:pointer; box-shadow:0 2px 0 #3D2E1E; }
      .act:hover { background:#F2DC83; }
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
    const toBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([toBytes(p.base64)], p.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    // 題組附圖：官方規定圖片要和 Excel「在上傳頁一起選擇」
    const media = Array.isArray(p.media) ? p.media : [];
    if (media.length && !input.multiple) throw new Error('上傳欄位不能一次選多個檔案（PaGamO 頁面可能改版了），請改用下載的壓縮檔手動上傳。');
    media.forEach((m) => dt.items.add(new File([toBytes(m.base64)], m.name, { type: m.type || 'image/jpeg' })));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const names = [p.name, ...media.map((m) => m.name)];
    const listedAll = () => {
      const shown = [...document.querySelectorAll('.ant-upload-list-item-name, .ant-upload-list-item')].map((e) => e.textContent);
      return names.every((n) => shown.some((t) => t.includes(n)));
    };
    const listed = await waitFor(listedAll, 6000);
    if (!listed) throw new Error(media.length ? 'Excel 或附圖沒有全部出現在 PaGamO 的上傳清單。' : '檔案沒有出現在 PaGamO 的上傳清單。');

    await chrome.storage.local.remove('pagamoPending');

    // 3. 倒數幾秒後自動按「上傳」；老師可以取消，改成自己按
    const submit = [...document.querySelectorAll('button[type=submit], button')].find((b) => b.textContent.replace(/\s/g, '') === '上傳');
    if (!submit) throw new Error('找不到「上傳」按鈕（PaGamO 頁面可能改版了），請自己按頁面上的上傳。');
    submit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const extra = media.length ? `，以及 <b>${media.length}</b> 張${p.mediaLabel ? esc(p.mediaLabel) : '附圖'}` : '';
    const ready = `✅ 已選好題型「<b>${esc(p.typeLabel)}</b>」並放入「<b>${esc(p.name)}</b>」${extra}。`;

    let clicked = false;
    let timer = null;
    submit.addEventListener('click', () => {
      clicked = true;
      clearInterval(timer);
      submit.style.outline = '';
      watchResult();
    }, { once: true });

    let left = AUTO_SECONDS;
    const tick = () => {
      if (clicked) return;
      if (!host.isConnected) { clearInterval(timer); return; } // 老師按 × 關掉提示列：不自動上傳
      if (left <= 0) {
        clearInterval(timer);
        if (!submit.disabled) submit.click();
        else manualMode('「上傳」按鈕還不能按，請確認後自己按下。');
        return;
      }
      show('ok', `${ready}<br>⏱️ <b>${left}</b> 秒後自動按下「上傳」<button class="act" data-act="cancel">先不要，我自己按</button>`);
      left -= 1;
    };
    tick();
    timer = setInterval(tick, 1000);
    root.addEventListener('click', (ev) => {
      if (ev.target?.dataset?.act !== 'cancel' || clicked) return;
      clearInterval(timer);
      manualMode('已取消自動上傳。');
    });

    function manualMode(why) {
      submit.style.outline = '4px solid #E89B7B';
      submit.style.outlineOffset = '4px';
      let on = true;
      const blink = setInterval(() => {
        if (clicked) { clearInterval(blink); submit.style.outline = ''; return; }
        on = !on;
        submit.style.outlineColor = on ? '#E89B7B' : '#F2DC83';
      }, 600);
      show('ok', `${ready}<br>${why}請確認後按下方閃爍的「<b>上傳</b>」按鈕。`);
    }

    // 4. 按下上傳後，看 PaGamO 的回應：檢查通過就帶老師到「題目總覽」
    async function watchResult() {
      show('ok', '⏳ 已按下上傳，PaGamO 正在檢查檔案…');
      const before = pageText();
      const outcome = await waitFor(() => {
        const now = pageText();
        const pass = now.match(/檔案檢查通過[^\n]{0,80}/);
        if (pass && count(now, '檢查通過') > count(before, '檢查通過')) return { ok: true, text: pass[0] };
        const errEl = document.querySelector('.ant-message-error, .ant-notification-notice-error, .ant-alert-error, .ant-modal-confirm-error, .ant-upload-list-item-error');
        if (errEl) return { ok: false, text: errEl.textContent.trim() };
        for (const w of ['失敗', '錯誤', '不符合', '無法上傳']) {
          if (count(now, w) > count(before, w)) {
            const line = now.split('\n').find((l) => l.includes(w) && !before.includes(l));
            return { ok: false, text: line || '' };
          }
        }
        return null;
      }, 90000);

      if (!outcome) {
        show('ok', `⌛ 等了 90 秒還沒看到 PaGamO 的檢查結果，請看頁面上的訊息。<br>上傳成功的話，可以到 <a href="${OVERVIEW_URL}">題目總覽</a> 確認。`);
        return;
      }
      if (!outcome.ok) {
        show('err', `⚠️ PaGamO 回報檔案有問題，請看頁面上的說明：<br><b>${esc(outcome.text.slice(0, 200))}</b><br>${manual}`);
        return;
      }
      await chrome.storage.local.set({ pagamoWatch: { matches: p.matches || [], title: p.title || p.name, ts: Date.now(), tries: 0 } });
      let sec = 3;
      let stay = false;
      const go = () => {
        if (stay) return;
        if (sec <= 0) { location.href = OVERVIEW_URL; return; }
        show('ok', `🎉 ${esc(outcome.text)}<br><b>${sec}</b> 秒後帶你到「題目總覽」看結果<button class="act" data-act="stay">留在這頁</button>`);
        sec -= 1;
        setTimeout(go, 1000);
      };
      root.addEventListener('click', async (ev) => {
        if (ev.target?.dataset?.act !== 'stay') return;
        stay = true;
        await chrome.storage.local.remove('pagamoWatch');
        show('ok', `🎉 ${esc(outcome.text)}<br>想看結果時，到 <a href="${OVERVIEW_URL}">題目總覽</a> 就找得到。`);
      });
      go();
    }
  } catch (e) {
    show('err', `⚠️ 自動放檔沒有完成：${esc(e.message)}<br>${manual}`);
  } finally {
    window.__pirlsPagamoBusy = false;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
})();
