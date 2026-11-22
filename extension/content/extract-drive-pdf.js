// 讀取這頁全文：Google 雲端硬碟 PDF 預覽頁專用（v0.10.11）
// 雲端硬碟的 PDF 預覽是「捲到哪一頁才載入那一頁的文字」，直接讀只會拿到開頭幾頁。
// 做法：找到捲動區 → 一段一段捲到底、等文字載入 → 讀整個捲動區的文字 → 清掉頁碼與重複的頁首頁尾 → 捲回頂端。
// 由背景程式注入；最後一個運算式（Promise）的結果會回傳給背景程式。
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const STEP_WAIT = 450; // 每捲一段等文字載入
  const DEADLINE = Date.now() + 45000; // 最多 45 秒，不會卡死
  const PAGE_LABEL = /^\s*(第\s*\d+\s*頁\s*[，,]\s*共\s*\d+\s*頁|Page\s+\d+\s+of\s+\d+|\d+\s*\/\s*\d+)\s*$/i;

  const title = (document.title || '').replace(/\s*-\s*Google\s*(雲端硬碟|Drive)\s*$/i, '').replace(/\.pdf$/i, '').trim();

  // 捲動區：可以捲、而且內容最高的那一塊
  const scroller = [...document.querySelectorAll('div, main, section')]
    .filter((el) => {
      const oy = getComputedStyle(el).overflowY;
      return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 50;
    })
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (!scroller) return { title, text: '', method: 'drive-pdf', url: location.href, pages: 0, error: 'no-scroller' };

  // 從頂端一段一段捲到底；到底後再等內容高度穩定兩次（最後幾頁可能還在載入）
  scroller.scrollTop = 0;
  await sleep(300);
  let lastHeight = -1;
  let stable = 0;
  while (Date.now() < DEADLINE) {
    scroller.scrollTop += Math.max(300, Math.round(scroller.clientHeight * 0.8));
    await sleep(STEP_WAIT);
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    if (!atBottom) { stable = 0; continue; }
    stable = scroller.scrollHeight === lastHeight ? stable + 1 : 0;
    lastHeight = scroller.scrollHeight;
    if (stable >= 2) break;
    await sleep(STEP_WAIT);
  }
  await sleep(500);

  const raw = (scroller.innerText || '').replace(/ /g, ' ');
  const timedOut = Date.now() >= DEADLINE;
  scroller.scrollTop = 0; // 讀完捲回第一頁

  // 頁數：頁碼標籤裡「共 N 頁」的 N，以及實際出現過的頁碼
  const seen = new Set();
  let total = 0;
  for (const m of raw.matchAll(/第\s*(\d+)\s*頁\s*[，,]\s*共\s*(\d+)\s*頁/g)) { seen.add(Number(m[1])); total = Math.max(total, Number(m[2])); }

  // 清理：去掉頁碼標籤；短行如果在很多頁都重複出現（頁首、頁尾、校名），只留第一次
  let lines = raw.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim());
  lines = lines.filter((l) => !PAGE_LABEL.test(l));
  // 只算「像頁首頁尾」的行：4～40 字、不是「一、」「（二）」「第三條」這類條列編號（它們本來就會重複）
  const NUMBERING = /^([（(]?[一二三四五六七八九十百\d]+[)）、.．]|第\s*[一二三四五六七八九十百\d]+\s*[條章節款項])/;
  const headerLike = (l) => l.length >= 4 && l.length <= 40 && !NUMBERING.test(l);
  const count = new Map();
  for (const l of lines) if (headerLike(l)) count.set(l, (count.get(l) || 0) + 1);
  const repeatLimit = Math.max(3, Math.ceil((total || seen.size || 1) * 0.5));
  const kept = new Set();
  lines = lines.filter((l) => {
    if (!l || (count.get(l) || 0) < repeatLimit) return true;
    if (kept.has(l)) return false;
    kept.add(l);
    return true;
  });
  // PDF 的文字是「一行一行」：把被行尾切斷的句子接回段落。
  // 上一行以句號、問號、冒號等結尾，或下一行是「一、」「第一章」這類條列，或上一行是短標題，才換段。
  const END = /[。！？!?」』：:；;]$/;
  const startsItem = (l) => NUMBERING.test(l) || /^第\s*[一二三四五六七八九十百\d]+\s*章/.test(l);
  const paras = [];
  let cur = '';
  for (const l of lines) {
    if (!l) continue;
    if (!cur) { cur = l; continue; }
    if (END.test(cur) || startsItem(l) || (cur.length < 20 && !/[，,、]$/.test(cur))) {
      paras.push(cur);
      cur = l;
    } else {
      cur += (/[A-Za-z0-9]$/.test(cur) && /^[A-Za-z0-9]/.test(l) ? ' ' : '') + l;
    }
  }
  if (cur) paras.push(cur);
  const text = paras.join('\n\n').trim();

  return { title, text, method: 'drive-pdf', url: location.href, pages: seen.size, totalPages: total, timedOut };
})();
