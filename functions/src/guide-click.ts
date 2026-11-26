// functions/src/guide-click.ts
// v0.4.1：記錄老師點了哪個「改用 Chrome 擴充套件」引導按鈕，看引導有沒有效。
// 只記次數（usageStats/{日期} 的 guide-來源-按鈕 欄位），不記是誰點的。

/** 引導出現的位置 */
export const GUIDE_SOURCES = ['daily', 'pool', 'last-one', 'banner', 'hero'] as const;
/** 點了哪個按鈕：商店頁、評論頁、安裝說明、下載 Gemini 技能、Gemini 技能安裝教學（2026-11-26） */
export const GUIDE_TARGETS = ['store', 'review', 'install', 'skill', 'skill-guide'] as const;

export type GuideSource = (typeof GUIDE_SOURCES)[number];
export type GuideTarget = (typeof GUIDE_TARGETS)[number];

/** 檢查來源與按鈕都在白名單內，回傳計數欄位名；不合法回 null（避免被灌入任意欄位） */
export function guideClickEvent(source: unknown, target: unknown): `guide-${GuideSource}-${GuideTarget}` | null {
  if (!GUIDE_SOURCES.includes(source as GuideSource)) return null;
  if (!GUIDE_TARGETS.includes(target as GuideTarget)) return null;
  return `guide-${source as GuideSource}-${target as GuideTarget}`;
}
