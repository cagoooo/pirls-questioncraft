// functions/src/notify-line.ts
// LINE Flex Message 卡片通知 helper（純 Push 模式，不需 webhook）。
//
// 共用阿凱老師既有的 LINE Bot Channel（Channel ID 2008810864）。
// Secret 命名前綴為 PIRLS_LINE_*，區分不同專案。
//
// Token / userId 沒設或為 placeholder 時，整個函式變 no-op，部署不會擋住。

import * as logger from 'firebase-functions/logger';

const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

const CARD_THEMES = {
  started: { headerBg: '#3B82F6', headerSubColor: '#DBEAFE', icon: '🆕' },
  success: { headerBg: '#10B981', headerSubColor: '#D1FAE5', icon: '✅' },
  failed:  { headerBg: '#EF4444', headerSubColor: '#FEE2E2', icon: '❌' },
  warning: { headerBg: '#F59E0B', headerSubColor: '#FEF3C7', icon: '⚠️' },
} as const;

export type CardAction = {
  /** 按鈕文字（≤ 12 字才不會擠） */
  label: string;
  /** 點擊後開的 URL（必須 https） */
  uri: string;
  /** 視覺：primary（主按鈕，深色填滿）／secondary（次要，邊框） */
  style?: 'primary' | 'secondary';
};

export type CardSpec = {
  status: keyof typeof CARD_THEMES;
  title: string;
  appName?: string;
  /** Header 副標：放在 appName 下方（例如週報的日期區間） */
  headline?: string;
  /** Hero KPI：3 欄大數字，視覺最突出（適合週報/月報這類數據卡） */
  heroKpis?: Array<{ value: string | number; label: string; sub?: string }>;
  fields: Array<{ icon?: string; label: string; value: string }>;
  /** 額外段落（在 fields 與 footer 之間，例如貼文章摘要） */
  body?: string;
  /** 底部 CTA 按鈕（最多 3 顆，會渲染成 footer block） */
  actions?: CardAction[];
  footerNote?: string;
};

function isConfigured(token?: string, userId?: string): boolean {
  return Boolean(
    token &&
      userId &&
      token !== 'PLACEHOLDER_NOT_CONFIGURED' &&
      userId !== 'PLACEHOLDER_NOT_CONFIGURED' &&
      token !== 'DISABLED' &&
      userId !== 'DISABLED'
  );
}

/**
 * 推送 Flex 卡片到 LINE。Best-effort：失敗只 log，不擋呼叫端。
 * 若 token / userId 未設或為 placeholder 自動 no-op。
 */
export function notifyAdminCard(card: CardSpec): void {
  const token = process.env.PIRLS_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  const userId = process.env.PIRLS_LINE_ADMIN_USER_ID?.trim();
  if (!isConfigured(token, userId)) return;

  const flex = buildFlexBubble(card);
  const altText = `${CARD_THEMES[card.status].icon} ${card.title}`;

  fetch(LINE_PUSH_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'flex', altText, contents: flex }],
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        // 雷 #9 安全網：Flex 失敗自動 fallback 純文字
        const errBody = await res.text().catch(() => '');
        logger.warn('[notify-line] Flex failed, fallback to text', {
          status: res.status,
          body: errBody.slice(0, 300),
        });
        const text = cardToPlainText(card);
        await fetch(LINE_PUSH_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: userId,
            messages: [{ type: 'text', text }],
          }),
        }).catch((e) => logger.warn('[notify-line] text fallback also failed', { msg: e?.message }));
      }
    })
    .catch((err) => logger.warn('[notify-line] push failed', { msg: err?.message }));
}

function buildFlexBubble(card: CardSpec) {
  const theme = CARD_THEMES[card.status];
  const now = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  const headerContents: any[] = [
    {
      type: 'text',
      text: `${theme.icon}  ${card.title}`,
      color: '#FFFFFF',
      weight: 'bold',
      size: 'md',
      wrap: true,
    },
  ];
  if (card.appName) {
    headerContents.push({
      type: 'text',
      text: card.appName,
      color: theme.headerSubColor,
      size: 'xs',
      margin: 'sm',
    });
  }
  if (card.headline) {
    headerContents.push({
      type: 'text',
      text: card.headline,
      color: '#FFFFFF',
      size: 'sm',
      weight: 'bold',
      margin: 'md',
    });
  }

  const bodyContents: any[] = [];

  // Hero KPI：3 欄大數字（視覺最突出區塊）
  if (card.heroKpis?.length) {
    const kpis = card.heroKpis.slice(0, 3);
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: kpis.map((k) => ({
        type: 'box',
        layout: 'vertical',
        flex: 1,
        contents: [
          {
            type: 'text',
            text: String(k.value),
            color: theme.headerBg,
            weight: 'bold',
            size: 'xxl',
            align: 'center',
          },
          {
            type: 'text',
            text: k.label,
            color: '#64748B',
            size: 'xs',
            align: 'center',
            margin: 'xs',
          },
          ...(k.sub
            ? [
                {
                  type: 'text',
                  text: k.sub,
                  color: '#94A3B8',
                  size: 'xxs',
                  align: 'center',
                },
              ]
            : []),
        ],
      })),
    });
    if (card.fields.length) {
      bodyContents.push({ type: 'separator', margin: 'lg', color: '#E5E7EB' });
    }
  }

  // 次要 fields：label 與 value 雙欄（label 短，避免截斷）
  if (card.fields.length) {
    const fieldRows = card.fields.map((f, i) => ({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: i === 0 && card.heroKpis?.length ? 'lg' : 'sm',
      contents: [
        {
          type: 'text',
          text: `${f.icon ? f.icon + ' ' : ''}${f.label}`,
          color: '#64748B',
          size: 'sm',
          flex: 4,
        },
        {
          type: 'text',
          text: f.value || '—',
          color: '#1E293B',
          size: 'sm',
          weight: 'bold',
          flex: 6,
          align: 'end',
          wrap: true,
        },
      ],
    }));
    bodyContents.push(...fieldRows);
  }

  if (card.body) {
    bodyContents.push({
      type: 'separator',
      margin: 'lg',
      color: '#E5E7EB',
    });
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F8FAFC',
      cornerRadius: '8px',
      paddingAll: '10px',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: card.body,
          color: '#475569',
          size: 'xs',
          wrap: true,
        },
      ],
    });
  }

  // footer：時間戳 + 可選的 action buttons
  const footerContents: any[] = [
    {
      type: 'text',
      text: card.footerNote ? `${now} · ${card.footerNote}` : now,
      color: '#94A3B8',
      size: 'xxs',
      align: 'end',
      wrap: true,
    },
  ];
  if (card.actions?.length) {
    footerContents.unshift(
      ...card.actions.slice(0, 3).map((a) => ({
        type: 'button',
        style: a.style === 'primary' ? 'primary' : 'secondary',
        height: 'sm',
        action: {
          type: 'uri',
          label: a.label.slice(0, 12),
          uri: a.uri,
        },
        margin: 'sm',
      })),
    );
  }

  return {
    type: 'bubble',
    size: card.heroKpis?.length ? 'mega' : 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: theme.headerBg,
      paddingAll: '16px',
      contents: headerContents,
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: '16px',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      spacing: 'sm',
      contents: footerContents,
    },
  };
}

function cardToPlainText(card: CardSpec): string {
  const theme = CARD_THEMES[card.status];
  const lines = [
    `${theme.icon} ${card.title}`,
    card.appName ? `(${card.appName})` : '',
    card.headline ? card.headline : '',
    '',
    ...(card.heroKpis?.map((k) => `${k.label}：${k.value}${k.sub ? ` ${k.sub}` : ''}`) ?? []),
    ...(card.heroKpis?.length ? [''] : []),
    ...card.fields.map((f) => `${f.icon || ''} ${f.label}：${f.value || '—'}`),
    card.body ? `\n${card.body}` : '',
    card.footerNote ? `\n${card.footerNote}` : '',
  ].filter(Boolean);
  return lines.join('\n').substring(0, 4900);
}
