// functions/src/weekly-digest.ts
// B.27: 每週日 21:00 Asia/Taipei 推 LINE 週報卡片給管理員。
//
// 來源資料：
//  - usageStats (每日計數器：generate/share/submit/失敗)
//  - sharedQuizzes (本週老師建的分享連結)
//  - submissions collectionGroup (本週所有學生作答)
//
// 設計：純函式 runWeeklyDigest()，由 onSchedule cron 與 manual HTTP 兩處共用，
//      方便部署後立刻 curl 驗證不用等到週日。

import { getFirestore, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getRecentUsage } from './usage-tracker';
import { notifyAdminCard, type CardSpec } from './notify-line';

const APP_NAME = 'PIRLS閱讀理解生成站 PRO';
const SITE_BASE_URL = 'https://cagoooo.github.io/pirls-questioncraft';

const PIRLS_LEVEL_LABEL: Record<string, string> = {
  'locate & retrieve': '訊息提取',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋整合',
  'evaluate & critique': '評估批判',
};

export interface WeeklyDigestResult {
  totalGenerations: number;
  imageGenerations: number;
  textGenerations: number;
  failedGenerations: number;
  failureRate: number;
  totalShares: number;
  totalSubmissions: number;
  classAvgAccuracy: number | null;
  weakestPirlsLevel: string | null;
  busiestDay: { date: string; count: number } | null;
}

/** 跑週報邏輯，回傳統計結果（同時推 LINE 卡片）。 */
export async function runWeeklyDigest(): Promise<WeeklyDigestResult> {
  const db = getFirestore();

  // 1. 撈過去 7 天 usage 計數
  const usage = await getRecentUsage(7);

  let imageGenerations = 0;
  let textGenerations = 0;
  let failedGenerations = 0;
  let totalShares = 0;
  let totalSubmissions = 0;
  let busiestDay: { date: string; count: number } | null = null;

  for (const day of usage) {
    const imgs = day['generate-images'] ?? 0;
    const txts = day['generate-text'] ?? 0;
    const failsImg = day['generate-images-failed'] ?? 0;
    const failsTxt = day['generate-text-failed'] ?? 0;
    const shares = day['share-quiz'] ?? 0;
    const subs = day['submit-quiz'] ?? 0;

    imageGenerations += imgs;
    textGenerations += txts;
    failedGenerations += failsImg + failsTxt;
    totalShares += shares;
    totalSubmissions += subs;

    const dayCount = imgs + txts;
    if (!busiestDay || dayCount > busiestDay.count) {
      if (dayCount > 0) busiestDay = { date: day.date, count: dayCount };
    }
  }

  const totalGenerations = imageGenerations + textGenerations;
  const failureRate = totalGenerations > 0 ? failedGenerations / totalGenerations : 0;

  // 2. 撈過去 7 天的 submissions（用 collectionGroup 跨所有 quiz）
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let classAvgAccuracy: number | null = null;
  const aggregatePirls: Record<string, { correct: number; total: number }> = {};

  try {
    const subsSnap = await db
      .collectionGroup('students')
      .where('submittedAt', '>=', sevenDaysAgo)
      .get();

    if (!subsSnap.empty) {
      let totalAcc = 0;
      let count = 0;
      subsSnap.docs.forEach((d: QueryDocumentSnapshot) => {
        const x = d.data() as any;
        if (x.totalCount > 0) {
          totalAcc += (x.correctCount / x.totalCount) * 100;
          count += 1;
        }
        Object.entries(x.pirlsLevelStats || {}).forEach(([level, s]: [string, any]) => {
          const acc = aggregatePirls[level] ?? { correct: 0, total: 0 };
          acc.correct += s.correct;
          acc.total += s.total;
          aggregatePirls[level] = acc;
        });
      });
      classAvgAccuracy = count > 0 ? totalAcc / count : null;
    }
  } catch (e: any) {
    console.warn('[weeklyDigest] submissions query failed:', e?.message);
  }

  // 3. 找最弱 PIRLS 層次
  const levelAccs = Object.entries(aggregatePirls)
    .filter(([_, s]) => s.total > 0)
    .map(([level, s]) => ({ level, accuracy: (s.correct / s.total) * 100 }));
  const weakest = levelAccs.sort((a, b) => a.accuracy - b.accuracy)[0];

  const result: WeeklyDigestResult = {
    totalGenerations,
    imageGenerations,
    textGenerations,
    failedGenerations,
    failureRate,
    totalShares,
    totalSubmissions,
    classAvgAccuracy,
    weakestPirlsLevel: weakest?.level ?? null,
    busiestDay,
  };

  // 4. 組 LINE 卡片
  const card = buildDigestCard(result);
  notifyAdminCard(card);

  return result;
}

function buildDigestCard(r: WeeklyDigestResult): CardSpec {
  // 起訖日期
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  const period = `${fmt(start)} – ${fmt(now)}`;

  // 整體狀態判斷（決定卡片色彩）
  let status: CardSpec['status'] = 'success';
  if (r.totalGenerations === 0) {
    status = 'warning'; // 整週沒人用，可能要關心一下
  } else if (r.failureRate > 0.1) {
    status = 'failed'; // 失敗率 > 10%，要看一下
  } else if (r.failureRate > 0.05) {
    status = 'warning'; // 失敗率 > 5%
  }

  const fields: CardSpec['fields'] = [
    { icon: '📅', label: '本週期間', value: period },
    { icon: '🎯', label: '出題次數', value: `${r.totalGenerations} 次（圖${r.imageGenerations}・字${r.textGenerations}）` },
  ];

  if (r.failedGenerations > 0) {
    fields.push({
      icon: '⚠️',
      label: '失敗次數',
      value: `${r.failedGenerations} 次（${(r.failureRate * 100).toFixed(1)}%）`,
    });
  }

  fields.push(
    { icon: '🔗', label: '分享連結', value: `${r.totalShares} 次` },
    { icon: '👨‍🎓', label: '學生交卷', value: `${r.totalSubmissions} 人次` },
  );

  if (r.classAvgAccuracy !== null) {
    fields.push({
      icon: '📊',
      label: '班級平均',
      value: `${r.classAvgAccuracy.toFixed(1)}%`,
    });
  }

  if (r.weakestPirlsLevel) {
    fields.push({
      icon: '🎯',
      label: '本週弱項',
      value: PIRLS_LEVEL_LABEL[r.weakestPirlsLevel] ?? r.weakestPirlsLevel,
    });
  }

  if (r.busiestDay) {
    fields.push({
      icon: '🔥',
      label: '最忙日',
      value: `${r.busiestDay.date}（${r.busiestDay.count} 次）`,
    });
  }

  // 動態 body 訊息（依狀態）
  let body: string | undefined;
  if (r.totalGenerations === 0) {
    body = '💡 本週沒人使用本系統。如果是寒暑假/連假很正常。';
  } else if (r.failureRate > 0.1) {
    body = '⚠️ 失敗率偏高，建議查看 Functions log 找原因。可能是 Gemini 模型棄用、quota 不足、或網路問題。';
  } else if (r.classAvgAccuracy !== null && r.classAvgAccuracy < 60) {
    body = '📚 本週班級平均偏低，可能題目太難或學生需要更多引導，可考慮針對「' +
      (PIRLS_LEVEL_LABEL[r.weakestPirlsLevel ?? ''] ?? '弱項') + '」加強練習。';
  } else if (r.totalSubmissions > 0 && r.classAvgAccuracy !== null && r.classAvgAccuracy >= 80) {
    body = '🎉 本週班級表現優秀，平均答對率超過 80%！';
  }

  return {
    status,
    title: '📊 PIRLS 本週摘要',
    appName: APP_NAME,
    fields,
    body,
    actions: [
      { label: '📊 線上儀表板', uri: `${SITE_BASE_URL}/admin/`, style: 'primary' },
    ],
  };
}
