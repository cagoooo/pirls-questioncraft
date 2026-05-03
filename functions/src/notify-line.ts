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

export type CardSpec = {
  status: keyof typeof CARD_THEMES;
  title: string;
  appName?: string;
  fields: Array<{ icon?: string; label: string; value: string }>;
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

  return {
    type: 'bubble',
    size: 'kilo',
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
      contents: card.fields.map((f) => ({
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `${f.icon ? f.icon + ' ' : ''}${f.label}`,
            color: '#888888',
            size: 'sm',
            flex: 3,
          },
          {
            type: 'text',
            text: f.value || '—',
            color: '#1E293B',
            size: 'sm',
            flex: 7,
            wrap: true,
          },
        ],
      })),
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'text',
          text: card.footerNote ? `${now} · ${card.footerNote}` : now,
          color: '#94A3B8',
          size: 'xxs',
          align: 'end',
          wrap: true,
        },
      ],
    },
  };
}

function cardToPlainText(card: CardSpec): string {
  const theme = CARD_THEMES[card.status];
  const lines = [
    `${theme.icon} ${card.title}`,
    card.appName ? `(${card.appName})` : '',
    '',
    ...card.fields.map((f) => `${f.icon || ''} ${f.label}：${f.value || '—'}`),
    card.footerNote ? `\n${card.footerNote}` : '',
  ].filter(Boolean);
  return lines.join('\n').substring(0, 4900);
}
