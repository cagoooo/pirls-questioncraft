// 框選畫面：背景已先截好整個畫面，這裡只負責讓老師拖出範圍，再把座標交回背景裁切。
(() => {
  if (window.__pirlsOverlayActive) return;
  window.__pirlsOverlayActive = true;

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
  host.setAttribute('data-pirls-host', '');
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; }
      .mask { position: fixed; inset: 0; cursor: crosshair; background: rgba(61,46,30,.42); }
      .mask.dragging { background: transparent; }
      .box { position: fixed; display: none; border: 2px solid #F2DC83; border-radius: 4px;
             box-shadow: 0 0 0 99999px rgba(61,46,30,.42); pointer-events: none; }
      .size { position: absolute; right: 0; bottom: -26px; background: #3D2E1E; color: #FFF9EE;
              font-size: 12px; padding: 2px 8px; border-radius: 6px; white-space: nowrap; }
      .hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px);
              background: #FFF9EE; color: #3D2E1E; border: 1.5px solid #3D2E1E; box-shadow: 0 4px 0 #3D2E1E;
              border-radius: 999px; padding: 10px 20px; font-size: 15px; line-height: 1.4; text-align: center; }
      .hint b { color: #B2643F; }
      .toast { position: fixed; right: 16px; bottom: 16px; max-width: min(380px, calc(100vw - 32px));
               background: #FFF9EE; color: #3D2E1E; border: 1.5px solid #3D2E1E; box-shadow: 0 5px 0 #3D2E1E;
               border-radius: 18px; padding: 14px 16px; font-size: 15px; line-height: 1.5; }
      .toast p { margin: 0 0 10px; }
      .toast .row { display: flex; gap: 8px; flex-wrap: wrap; }
      .toast button { cursor: pointer; border: 1.5px solid #3D2E1E; border-radius: 999px; padding: 6px 14px;
                      font-size: 14px; font-weight: 700; background: #fff; color: #3D2E1E; box-shadow: 0 3px 0 #3D2E1E; }
      .toast button.primary { background: #F2DC83; }
      .toast button:active { transform: translateY(2px); box-shadow: 0 1px 0 #3D2E1E; }
    </style>
    <div class="mask"></div>
    <div class="box"><span class="size"></span></div>
    <div class="hint">拖曳框選要出題的範圍　<b>Enter</b> 擷取整個畫面　<b>Esc</b> 取消</div>`;
  document.documentElement.appendChild(host);

  const mask = root.querySelector('.mask');
  const box = root.querySelector('.box');
  const size = root.querySelector('.size');
  const hint = root.querySelector('.hint');
  let start = null;
  let rect = null;

  const block = (e) => { e.preventDefault(); e.stopPropagation(); };
  window.addEventListener('wheel', block, { passive: false, capture: true });
  window.addEventListener('touchmove', block, { passive: false, capture: true });

  function cleanup() {
    window.removeEventListener('pirls-overlay-reset', cleanup);
    window.removeEventListener('wheel', block, { capture: true });
    window.removeEventListener('touchmove', block, { capture: true });
    window.removeEventListener('keydown', onKey, true);
    window.__pirlsOverlayActive = false;
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      block(e);
      cleanup();
      host.remove();
      chrome.runtime.sendMessage({ type: 'CAPTURE_CANCEL' });
    } else if (e.key === 'Enter') {
      block(e);
      submit({ x: 0, y: 0, w: innerWidth, h: innerHeight });
    }
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pirls-overlay-reset', cleanup);

  mask.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    mask.setPointerCapture(e.pointerId);
    mask.classList.add('dragging');
    hint.style.display = 'none';
    draw(e);
  });
  mask.addEventListener('pointermove', (e) => { if (start) draw(e); });
  mask.addEventListener('pointerup', () => {
    if (!start) return;
    start = null;
    if (!rect || rect.w < 24 || rect.h < 24) {
      // 只是點一下：回到初始狀態，讓老師重新拖
      box.style.display = 'none';
      mask.classList.remove('dragging');
      hint.style.display = '';
      hint.innerHTML = '範圍太小了，請<b>按住滑鼠拖曳</b>出一個方框（Enter 擷取整個畫面、Esc 取消）';
      return;
    }
    submit(rect);
  });

  function draw(e) {
    const x = Math.min(start.x, e.clientX);
    const y = Math.min(start.y, e.clientY);
    rect = { x, y, w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) };
    Object.assign(box.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    size.textContent = `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
  }

  async function submit(r) {
    cleanup();
    mask.remove();
    box.remove();
    hint.remove();
    host.style.pointerEvents = 'none';
    let res;
    try {
      res = await chrome.runtime.sendMessage({ type: 'REGION_SELECTED', rect: r, viewport: { w: innerWidth, h: innerHeight } });
    } catch (e) {
      res = { ok: false, error: e?.message ?? String(e) };
    }
    showToast(res);
  }

  function showToast(res) {
    host.style.pointerEvents = 'none';
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.pointerEvents = 'auto';
    if (res?.ok) {
      t.innerHTML = `<p>✅ 已加入第 <b>${res.count}</b> 張截圖。文章跨頁的話，捲到下一段再框一次。</p>
        <div class="row"><button class="primary" data-act="go">前往工作台出題</button><button data-act="more">繼續框選</button><button data-act="close">關閉</button></div>`;
    } else {
      t.innerHTML = `<p>⚠️ 截圖沒有成功：${escapeHtml(res?.error ?? '未知原因')}</p><div class="row"><button data-act="close">關閉</button></div>`;
    }
    root.appendChild(t);
    const timer = setTimeout(() => host.remove(), 9000);
    t.addEventListener('click', (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;
      clearTimeout(timer);
      host.remove();
      if (act === 'go') chrome.runtime.sendMessage({ type: 'OPEN_WORKBENCH' });
      if (act === 'more') setTimeout(() => chrome.runtime.sendMessage({ type: 'START_CAPTURE' }), 80);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
})();
