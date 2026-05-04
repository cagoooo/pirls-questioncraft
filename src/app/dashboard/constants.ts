// 共用 PIRLS 四層次標籤與配色（page.tsx 與 dashboard-charts.tsx 共用）

export const PIRLS_LEVEL_LABEL: Record<string, string> = {
  'locate & retrieve': '訊息提取',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋整合',
  'evaluate & critique': '評估批判',
};

export const PIRLS_LEVEL_COLOR: Record<string, string> = {
  'locate & retrieve': '#3B82F6',
  'make straightforward inferences': '#10B981',
  'interpret & integrate': '#F59E0B',
  'evaluate & critique': '#A387D9',
};
