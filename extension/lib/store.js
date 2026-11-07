// 擴充套件的資料都放在 chrome.storage.local（只存在這台電腦，不跨電腦同步）。
// 金鑰也在這裡，所以把資料夾壓成 ZIP 分享時，不會把金鑰帶出去。

export const KEYS = {
  settings: 'settings',
  shots: 'shots',
  text: 'sourceText',
  draft: 'draft',
};

export function currentTerm(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  // 8 月～隔年 1 月是上學期；2～7 月是下學期（民國學年度）
  if (m >= 8) return `${y - 1911}上`;
  if (m === 1) return `${y - 1912}上`;
  return `${y - 1912}下`;
}

export const DEFAULT_SETTINGS = {
  apiKey: '',
  model: '',
  models: [],
  modelChosenByUser: false, // 老師自己在設定頁改過模型才是 true；否則升級時會換成新的預設
  subject: '閱讀素養題組',
  book: '',            // 空白＝自動用目前學期（例：115上）
  chapterMode: 'title', // title＝用文章標題當章節；custom＝用下方自訂文字
  chapter: 'PIRLS閱讀理解',
  questionMode: '8-questions',
  languageMode: 'zh-TW',
};

export async function getSettings() {
  const { [KEYS.settings]: s } = await chrome.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEYS.settings]: next });
  return next;
}

export async function getShots() {
  const { [KEYS.shots]: shots } = await chrome.storage.local.get(KEYS.shots);
  return Array.isArray(shots) ? shots : [];
}

export async function setShots(shots) {
  await chrome.storage.local.set({ [KEYS.shots]: shots });
}
