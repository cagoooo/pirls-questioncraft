// YouTube 影片出題（v0.9.0）：網址解析、時間格式、題組文章開頭、影片資訊。
// 只用公開影片；不需要額外權限（oEmbed 與 i.ytimg.com 都允許跨網域讀取，2026-11-14 實測）。

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** 從各種 YouTube 網址取出 11 碼影片編號；不是影片網址就回 null。 */
export function parseYouTubeId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (ID_RE.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

/** 網址上的起始時間（?t=90、?t=1m30s、&start=90）→ 秒；沒有就回 null。 */
export function startFromUrl(input) {
  try {
    const u = new URL(String(input));
    const t = u.searchParams.get('t') ?? u.searchParams.get('start');
    if (!t) return null;
    if (/^\d+s?$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m || !t) return null;
    return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
  } catch { return null; }
}

/** 「2:30」「1:02:03」「150」→ 秒；空白回 null；格式不對回 NaN。 */
export function parseTime(text) {
  const s = String(text ?? '').trim().replace(/：/g, ':');
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m || +m[3] >= 60 || (m[1] && +m[2] >= 60)) return NaN;
  return (+(m[1] ?? 0)) * 3600 + (+m[2]) * 60 + (+m[3]);
}

/** 秒 → 「02:30」或「1:02:03」。 */
export function formatTime(sec) {
  const n = Math.max(0, Math.floor(sec));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const ss = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

/** 檢查片段：回傳 { start, end, error }（秒，沒填是 null）。 */
export function checkRange(startText, endText) {
  const start = parseTime(startText);
  const end = parseTime(endText);
  if (Number.isNaN(start)) return { error: '開始時間的格式不對，請寫成「02:30」這樣。' };
  if (Number.isNaN(end)) return { error: '結束時間的格式不對，請寫成「08:30」這樣。' };
  if (start != null && end != null && end <= start) return { error: '結束時間要比開始時間晚。' };
  if (start != null && end != null && end - start < 30) return { error: '片段太短了（至少 30 秒），題目會出不出來。' };
  return { start, end, error: '' };
}

export const canonicalUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

/** 給學生點的網址：有開始時間就直接跳到那裡。 */
export function watchUrl(id, start) {
  return start ? `https://youtu.be/${id}?t=${Math.floor(start)}` : `https://youtu.be/${id}`;
}

export const thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** 片段說明：「02:00～08:30」「從 02:00 開始」「到 08:30 為止」「完整影片」。 */
export function rangeLabel(start, end) {
  if (start != null && end != null) return `${formatTime(start)}～${formatTime(end)}`;
  if (start != null) return `從 ${formatTime(start)} 開始`;
  if (end != null) return `開頭到 ${formatTime(end)}`;
  return '完整影片';
}

/**
 * 題組文章：影片標題＋觀看連結（PaGamO 支援 [文字](網址) 超連結）＋重點摘要。
 * 學生在 PaGamO 題組會先看到這段，點連結看影片，再回答題目。
 */
export function videoArticle({ id, title, start, end, summary }) {
  const range = rangeLabel(start, end);
  const watch = range === '完整影片' ? '▶ 觀看影片' : `▶ 觀看影片（${range}）`;
  return [
    `🎬 影片：${title || 'YouTube 影片'}`,
    `[${watch}](${watchUrl(id, start)})`,
    '請先看完影片，再回答下面的題目。',
    '',
    '影片重點摘要：',
    String(summary ?? '').trim(),
  ].join('\n');
}

/** LoiLoNote 不認得 [文字](網址)：改成「文字：網址」。 */
export function plainLinks(text) {
  return String(text ?? '').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1：$2');
}

/** 用 oEmbed 取影片標題與頻道名稱（不需要金鑰）。私人或不存在的影片會失敗。 */
export async function fetchVideoInfo(id, { timeout = 10000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl(id))}`, { signal: ctrl.signal });
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'private' };
    if (res.status === 404 || res.status === 400) return { ok: false, reason: 'notfound' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const j = await res.json();
    return { ok: true, title: String(j.title ?? ''), author: String(j.author_name ?? '') };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** 下載影片封面圖（JPG），失敗回 null。 */
export async function fetchThumbnail(id) {
  try {
    const res = await fetch(thumbUrl(id));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 1000 ? bytes : null;
  } catch { return null; }
}
