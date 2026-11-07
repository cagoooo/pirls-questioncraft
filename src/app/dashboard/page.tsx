// src/app/dashboard/page.tsx
// B.16: 老師端儀表板 — /dashboard/?id=quizId
// 顯示班級答題分布、各題答對率、PIRLS 四層次平均、學生成績表格 + CSV 匯出
"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2, AlertCircle, RefreshCw, Download, ArrowLeft, Users, Target,
  ArrowUpDown, ArrowUp, ArrowDown, Search, Printer, Copy, ExternalLink, Wifi, WifiOff,
  ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { PirlsLogo } from '@/components/PirlsLogo';
import {
  getSubmissions,
  readTeacherKeyFromHash,
  recallTeacherKey,
  rememberTeacherKey,
  type DashboardData,
  type SubmissionRecord,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { PIRLS_LEVEL_LABEL, PIRLS_LEVEL_COLOR } from './constants';

// 把 recharts 圖表 lazy-load，主 bundle 不再含 ~90KB 的 recharts
const DashboardCharts = dynamic(() => import('./dashboard-charts'), {
  ssr: false,
  loading: () => (
    <div className="mb-6 flex items-center justify-center py-12 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> 載入圖表中…
    </div>
  ),
});

const AUTO_REFRESH_INTERVAL_MS = 30_000;

function formatRelative(ms: number | null, nowMs: number): string {
  if (ms == null) return '';
  const sec = Math.floor((nowMs - ms) / 1000);
  if (sec < 5) return '剛才';
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  return `${hr} 小時前`;
}

type SortKey = 'submittedAt' | 'class' | 'seatNumber' | 'name' | 'correct' | 'accuracy';

function SortHeader({
  label, sortKey, currentKey, dir, onClick, align, className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: 'asc' | 'desc';
  onClick: (k: SortKey) => void;
  align?: 'left' | 'center';
  className?: string;
}) {
  const active = sortKey === currentKey;
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={`py-3 px-3 text-[0.9375rem] font-bold whitespace-nowrap cursor-pointer select-none hover:bg-cream transition ${align === 'center' ? 'text-center' : ''} ${className ?? ''}`}
      onClick={() => onClick(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${active ? 'text-coral' : ''}`}>
        {label}
        <Icon className={`h-4 w-4 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </span>
    </th>
  );
}

/** 展開列：顯示該位學生的逐題對錯 grid + 個人 PIRLS 層次表現 */
function ExpandedStudentDetail({
  student, questions,
}: {
  student: SubmissionRecord;
  questions: import('@/lib/api').PirlsQuestion[];
}) {
  const optionLabel = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="space-y-3">
      {/* 個人 PIRLS 層次表現 */}
      {student.pirlsLevelStats && Object.keys(student.pirlsLevelStats).length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.9375rem]">
          <span className="text-muted-foreground font-medium">PIRLS 層次：</span>
          {Object.entries(PIRLS_LEVEL_LABEL).map(([key, label]) => {
            const stat = student.pirlsLevelStats?.[key];
            if (!stat || stat.total === 0) return null;
            const pct = Math.round((stat.correct / stat.total) * 100);
            const color = PIRLS_LEVEL_COLOR[key] ?? '#888';
            return (
              <div key={key} className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span>{label}</span>
                <span className="font-bold tabular-nums" style={{ color }}>
                  {stat.correct}/{stat.total} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 逐題對錯 grid */}
      {questions.length > 0 ? (
        <div>
          <div className="text-sm text-muted-foreground mb-2">
            逐題對錯（滑鼠移到格子上看題目與答案）：
            <span className="inline-block w-3 h-3 bg-green-500 rounded-sm ml-2 mr-1 align-middle" />答對
            <span className="inline-block w-3 h-3 bg-red-400 rounded-sm ml-2 mr-1 align-middle" />答錯
            <span className="inline-block w-3 h-3 bg-gray-300 rounded-sm ml-2 mr-1 align-middle" />略過
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2">
            {questions.map((q, idx) => {
              const ans = student.answers[idx];
              const isSkipped = ans == null;
              const isCorrect = !isSkipped && ans === q.correctAnswerIndex;
              const cellClass = isSkipped
                ? 'bg-gray-200 text-gray-500 border-gray-300'
                : isCorrect
                  ? 'bg-green-100 text-green-700 border-green-400'
                  : 'bg-red-100 text-red-700 border-red-400';
              const tooltipText = isSkipped
                ? `第 ${idx + 1} 題 [略過未答]\n題目：${q.question}\n正解：${optionLabel(q.correctAnswerIndex)}. ${q.options[q.correctAnswerIndex]}`
                : `第 ${idx + 1} 題 [${isCorrect ? '✓ 答對' : '✗ 答錯'}]\n題目：${q.question}\n答：${optionLabel(ans)}. ${q.options[ans]}${isCorrect ? '' : `\n正解：${optionLabel(q.correctAnswerIndex)}. ${q.options[q.correctAnswerIndex]}`}`;
              return (
                <div
                  key={idx}
                  title={tooltipText}
                  className={`${cellClass} border-[1.5px] rounded-lg text-[0.9375rem] text-center py-2 px-1 font-extrabold cursor-help select-none`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground italic">題目資料已刪除，無法呈現逐題對錯。</div>
      )}
    </div>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const quizId = searchParams?.get('id') ?? '';

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [studentUrl, setStudentUrl] = useState('');
  // v0.3.0：老師專用金鑰（網址 #k= 或本機記住的），undefined = 還沒讀
  const [teacherKey, setTeacherKey] = useState<string | null | undefined>(undefined);

  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<'all' | 'attention' | 'top'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 學生作答 URL（client-only，避免 SSR window 錯誤）
  useEffect(() => {
    if (!quizId) { setStudentUrl(''); return; }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    setStudentUrl(`${window.location.origin}${basePath}/quiz/?id=${quizId}`);
  }, [quizId]);

  // 讀老師金鑰：優先網址 #k=，其次出題時這台裝置記住的
  useEffect(() => {
    if (!quizId) { setTeacherKey(null); return; }
    const fromHash = readTeacherKeyFromHash(window.location.hash);
    if (fromHash) {
      rememberTeacherKey(quizId, fromHash);
      setTeacherKey(fromHash);
      return;
    }
    setTeacherKey(recallTeacherKey(quizId));
  }, [quizId]);

  // 「上次更新 X 秒前」每 10 秒重新計算
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(async (mode: 'full' | 'background') => {
    if (!quizId || !teacherKey) return;
    if (mode === 'full') {
      setIsLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }
    try {
      const d = await getSubmissions(quizId, teacherKey);
      setData(d);
      setLastUpdated(Date.now());
      if (mode === 'background') setError(null);
    } catch (err: any) {
      if (mode === 'full') setError(err?.message ?? '無法讀取儀表板資料');
      // 背景刷新失敗：靜默失敗，保留舊資料
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [quizId, teacherKey]);

  useEffect(() => {
    if (!quizId) {
      setError('缺少 ?id=xxx 參數');
      setIsLoading(false);
      return;
    }
    if (teacherKey === undefined) return;
    if (!teacherKey) {
      setError('全班成績只有出題老師能看。請使用出題時「分享測驗」視窗裡的「開啟儀表板」或「複製老師專用連結」；學生作答連結無法查看全班成績。');
      setIsLoading(false);
      return;
    }
    fetchData('full');
  }, [quizId, teacherKey, reloadSignal, fetchData]);

  // 自動刷新（30 秒一次，分頁隱藏時暫停）
  useEffect(() => {
    if (!autoRefresh || !quizId || isLoading || error) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchData('background');
    };
    const id = setInterval(tick, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, quizId, isLoading, error, fetchData]);

  // #17 同學重複交卷去重：以 班級+座號+姓名 為 key，取 submittedAt 最新一筆
  const { dedupedSubmissions, duplicateCount } = useMemo(() => {
    if (!data) return { dedupedSubmissions: [] as SubmissionRecord[], duplicateCount: 0 };
    const map = new Map<string, SubmissionRecord>();
    for (const s of data.submissions) {
      const key = `${s.studentInfo.class}|${s.studentInfo.seatNumber}|${s.studentInfo.name}`;
      const existing = map.get(key);
      if (!existing || (s.submittedAt ?? 0) > (existing.submittedAt ?? 0)) {
        map.set(key, s);
      }
    }
    const list = Array.from(map.values());
    return { dedupedSubmissions: list, duplicateCount: data.submissions.length - list.length };
  }, [data]);

  const stats = useMemo(() => {
    if (!data || !dedupedSubmissions.length) return null;
    const subs = dedupedSubmissions;
    const qs = data.questions;
    const hasQuestions = qs.length > 0;

    // 1. 班級總平均、最高、最低
    const accuracies = subs.map(s => s.totalCount > 0 ? (s.correctCount / s.totalCount) * 100 : 0);
    const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const high = Math.max(...accuracies);
    const low = Math.min(...accuracies);

    // 2. 分數分布直方圖（5 個區間）
    const binDefs = [
      { range: '0–20%',   min: 0,  max: 20,  color: '#dc2626' },
      { range: '20–40%',  min: 20, max: 40,  color: '#f97316' },
      { range: '40–60%',  min: 40, max: 60,  color: '#f59e0b' },
      { range: '60–80%',  min: 60, max: 80,  color: '#10b981' },
      { range: '80–100%', min: 80, max: 100, color: '#16a34a' },
    ];
    const scoreBins = binDefs.map(b => ({ ...b, count: 0 }));
    accuracies.forEach(acc => {
      for (let i = 0; i < scoreBins.length; i++) {
        const b = scoreBins[i];
        const inRange = acc >= b.min && (i === scoreBins.length - 1 ? acc <= b.max : acc < b.max);
        if (inRange) { b.count++; break; }
      }
    });

    // 3. 各題答對率 + 完成率 + 選項分布
    // P1 #8 修正：答對率分母改成「實際作答人數」(answered)，完成率單獨呈現
    const perQuestion = hasQuestions ? qs.map((q, idx) => {
      const total = subs.length;
      const answered = subs.filter(s => s.answers[idx] != null).length;
      const correctCount = subs.filter(s => s.answers[idx] === q.correctAnswerIndex).length;
      const optionCounts = q.options.map((_, optIdx) =>
        subs.filter(s => s.answers[idx] === optIdx).length
      );
      const skippedCount = total - answered;
      return {
        idx: idx + 1,
        question: q.question.length > 30 ? q.question.slice(0, 28) + '…' : q.question,
        fullQuestion: q.question,
        pirlsLevel: q.pirlsLevel,
        correct: correctCount,
        answered,
        total,
        accuracy: answered > 0 ? Math.round((correctCount / answered) * 100) : 0,
        completionRate: total > 0 ? Math.round((answered / total) * 100) : 0,
        color: PIRLS_LEVEL_COLOR[q.pirlsLevel] ?? '#888',
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        optionCounts,
        skippedCount,
      };
    }) : [];

    // 4. PIRLS 4 層次平均答對率（用每位學生已預先聚合的 pirlsLevelStats，不需 questions）
    const levelStats: Record<string, { correct: number; total: number }> = {};
    subs.forEach(s => {
      Object.entries(s.pirlsLevelStats || {}).forEach(([level, stat]) => {
        const acc = levelStats[level] ?? { correct: 0, total: 0 };
        acc.correct += (stat as any).correct;
        acc.total += (stat as any).total;
        levelStats[level] = acc;
      });
    });
    const radarData = Object.entries(PIRLS_LEVEL_LABEL).map(([key, label]) => {
      const s = levelStats[key] ?? { correct: 0, total: 0 };
      const accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      return { level: label, accuracy, fullMark: 100 };
    });

    return { avg, high, low, scoreBins, perQuestion, radarData, levelStats, hasQuestions };
  }, [data, dedupedSubmissions]);

  const displayedSubmissions = useMemo(() => {
    if (!data) return [];
    let list = [...dedupedSubmissions];

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(s =>
        String(s.studentInfo.name).toLowerCase().includes(q) ||
        String(s.studentInfo.seatNumber).toLowerCase().includes(q) ||
        String(s.studentInfo.class).toLowerCase().includes(q)
      );
    }
    if (filterMode === 'attention') {
      list = list.filter(s => {
        const acc = s.totalCount > 0 ? (s.correctCount / s.totalCount) * 100 : 0;
        return acc < 60;
      });
    } else if (filterMode === 'top') {
      list = list.filter(s => {
        const acc = s.totalCount > 0 ? (s.correctCount / s.totalCount) * 100 : 0;
        return acc >= 80;
      });
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'submittedAt':
          cmp = (a.submittedAt ?? 0) - (b.submittedAt ?? 0);
          break;
        case 'class':
          cmp = String(a.studentInfo.class).localeCompare(String(b.studentInfo.class), 'zh-Hant');
          break;
        case 'seatNumber': {
          const na = parseInt(String(a.studentInfo.seatNumber), 10);
          const nb = parseInt(String(b.studentInfo.seatNumber), 10);
          if (Number.isFinite(na) && Number.isFinite(nb)) cmp = na - nb;
          else cmp = String(a.studentInfo.seatNumber).localeCompare(String(b.studentInfo.seatNumber));
          break;
        }
        case 'name':
          cmp = String(a.studentInfo.name).localeCompare(String(b.studentInfo.name), 'zh-Hant');
          break;
        case 'correct':
          cmp = a.correctCount - b.correctCount;
          break;
        case 'accuracy': {
          const accA = a.totalCount > 0 ? a.correctCount / a.totalCount : 0;
          const accB = b.totalCount > 0 ? b.correctCount / b.totalCount : 0;
          cmp = accA - accB;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, dedupedSubmissions, sortKey, sortDir, filterMode, searchTerm]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'class' || key === 'seatNumber' ? 'asc' : 'desc');
    }
  };

  const copyStudentUrl = async () => {
    if (!studentUrl) return;
    try {
      await navigator.clipboard.writeText(studentUrl);
      toast({ title: '已複製學生作答連結', description: studentUrl });
    } catch {
      toast({ title: '複製失敗', description: '請手動長按連結複製', variant: 'destructive' });
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  // CSV cell：含 CSV injection 防護（=,+,-,@,Tab,CR 開頭加單引號 prefix）
  const csvCell = (v: any): string => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const downloadCSV = () => {
    if (!data) return;
    const rows: string[] = [];
    rows.push(['班級', '座號', '姓名', '答對', '總題數', '答對率%', '訊息提取', '直接推論', '詮釋整合', '評估批判', '交卷時間']
      .map(csvCell).join(','));
    dedupedSubmissions.forEach(s => {
      const ts = s.submittedAt ? new Date(s.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '';
      const acc = s.totalCount > 0 ? Math.round((s.correctCount / s.totalCount) * 100) : 0;
      const ps = s.pirlsLevelStats || {};
      const fmt = (k: string) => {
        const v = (ps as any)[k];
        return v ? `${v.correct}/${v.total}` : '';
      };
      rows.push([
        s.studentInfo.class, s.studentInfo.seatNumber, s.studentInfo.name,
        s.correctCount, s.totalCount, acc,
        fmt('locate & retrieve'), fmt('make straightforward inferences'),
        fmt('interpret & integrate'), fmt('evaluate & critique'),
        ts,
      ].map(csvCell).join(','));
    });
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PIRLS-成績-${quizId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="text-lg text-muted-foreground mt-4">讀取儀表板資料中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-lg border-neo rounded-[24px] shadow-neo">
          <CardHeader>
            <CardTitle className="text-center text-[1.5rem] font-extrabold text-destructive">無法載入儀表板</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>錯誤</AlertTitle>
              <AlertDescription className="text-base">{error}</AlertDescription>
            </Alert>
            <Button asChild className="w-full h-11 text-base rounded-full">
              <Link href="/">返回首頁</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const empty = !data || dedupedSubmissions.length === 0;
  // #18: 題目資料已被刪除但仍有學生作答紀錄 → 走「降級」模式（不渲染需要 questions 的卡片）
  const questionsMissing = !!data && dedupedSubmissions.length > 0 && data.questions.length === 0;

  const accOf = (s: SubmissionRecord) => (s.totalCount > 0 ? (s.correctCount / s.totalCount) * 100 : 0);
  const attentionCount = dedupedSubmissions.filter(s => accOf(s) < 60).length;
  const topCount = dedupedSubmissions.filter(s => accOf(s) >= 80).length;
  const showFilter = (mode: 'all' | 'attention' | 'top') => {
    setFilterMode(mode);
    document.getElementById('student-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 2026-11-07 改版：沿用網站奶油色＋黑邊立體風格，桌機加寬、字級放大
  const dashBtn = 'h-11 px-4 rounded-full border-neo bg-card text-ink shadow-neo-sm text-[0.9375rem] font-bold hover:bg-cream-deep hover:text-ink';
  const dashCard = 'border-neo rounded-[24px] shadow-neo bg-card';
  const pillBtn = (active: boolean) =>
    `h-10 px-4 rounded-full border-neo text-[0.9375rem] font-bold transition-colors ${active ? 'bg-ink text-cream' : 'bg-card text-ink hover:bg-cream-deep'}`;

  return (
    <div className="mx-auto w-full max-w-[min(1680px,96vw)] px-4 sm:px-8 py-6 sm:py-8 min-h-screen text-ink">
      {/* 列印樣式：藏掉互動 UI、避免 card 跨頁切半 */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          table { font-size: 11px !important; }
        }
      `}</style>

      <header className="mb-6 bg-card border-neo rounded-[24px] shadow-neo px-5 sm:px-7 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-cream border-neo p-1.5 shrink-0 overflow-hidden">
            <PirlsLogo className="w-full h-full" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[1.625rem] sm:text-[2rem] font-extrabold leading-tight">老師端儀表板</h1>
            {data?.quizTitle && (
              <p className="text-[1.125rem] sm:text-[1.25rem] font-bold mt-0.5 break-words">📝 {data.quizTitle}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>測驗代碼：<span className="font-mono">{quizId}</span></span>
              {lastUpdated && (
                <span className="inline-flex items-center gap-1">
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : autoRefresh ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  上次更新：{formatRelative(lastUpdated, now)}
                  {autoRefresh && <span className="text-green-700">・每 30 秒自動更新</span>}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            className={dashBtn}
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? '關閉自動更新' : '開啟自動更新'}
          >
            {autoRefresh ? (
              <><Wifi className="h-4 w-4 mr-1.5 text-green-600" /> 自動更新中</>
            ) : (
              <><WifiOff className="h-4 w-4 mr-1.5" /> 自動更新關</>
            )}
          </Button>
          <Button variant="outline" className={dashBtn} onClick={() => setReloadSignal(s => s + 1)} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} /> 重新整理
          </Button>
          {!empty && (
            <>
              <Button variant="outline" className={`${dashBtn} bg-sage/60`} onClick={downloadCSV}>
                <Download className="h-4 w-4 mr-1.5" /> 匯出 CSV
              </Button>
              <Button variant="outline" className={dashBtn} onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1.5" /> 列印 / 存 PDF
              </Button>
            </>
          )}
          <Button variant="outline" className={dashBtn} asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> 回首頁</Link>
          </Button>
        </div>
      </header>

      {empty ? (
        <Card className={`max-w-2xl mx-auto ${dashCard}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[1.5rem]">
              <Users className="h-6 w-6" /> 還沒有人交卷
            </CardTitle>
            <CardDescription className="text-base">
              學生作答後資料會自動出現（每 30 秒刷新一次）。可以再投影一次學生作答 QR Code：
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentUrl ? (
              <>
                <div className="flex justify-center bg-white p-5 rounded-2xl border-neo">
                  <QRCodeSVG
                    value={studentUrl}
                    size={260}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="L"
                    includeMargin={false}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-muted-foreground">學生作答連結</p>
                  <div className="flex gap-2">
                    <Input value={studentUrl} readOnly className="h-11 text-sm font-mono border-neo rounded-xl" />
                    <Button variant="outline" className={dashBtn} onClick={copyStudentUrl} title="複製連結">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className={dashBtn} asChild title="另開新視窗">
                      <a href={studentUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-base text-muted-foreground">學生作答連結載入中…</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 提示橫幅：重複交卷去重 / 題目已刪除 */}
          {(duplicateCount > 0 || questionsMissing) && (
            <div className="mb-5 space-y-2">
              {duplicateCount > 0 && (
                <Alert className="border-neo rounded-[18px] bg-lemon/40">
                  <Info className="h-4 w-4" />
                  <AlertTitle className="text-base">已自動合併重複交卷</AlertTitle>
                  <AlertDescription className="text-[0.9375rem]">
                    偵測到 {duplicateCount} 筆重複交卷（同班級+座號+姓名），已取「最後一次交卷」作為計分依據。
                  </AlertDescription>
                </Alert>
              )}
              {questionsMissing && (
                <Alert variant="destructive" className="border-neo rounded-[18px]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-base">題目資料已刪除</AlertTitle>
                  <AlertDescription className="text-[0.9375rem]">
                    本測驗的題目資料已不存在（可能已過期或被清除），仍可看學生分數與 PIRLS 層次表現，但無法呈現「各題答對率」與「逐題選項分布」。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* KPI：重點數字（需關注／優秀可點擊直接篩選成績表） */}
          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4 mb-6 print-avoid-break">
            {[
              { icon: <Users className="h-4 w-4" />, label: '交卷人數', value: `${dedupedSubmissions.length}`, unit: '人', color: '#3D2E1E' },
              { icon: <Target className="h-4 w-4" />, label: '班級平均', value: stats!.avg.toFixed(1), unit: '%', color: '#B2643F' },
              { icon: <span aria-hidden>🏆</span>, label: '最高分', value: stats!.high.toFixed(0), unit: '%', color: '#15803d' },
              { icon: <span aria-hidden>📉</span>, label: '最低分', value: stats!.low.toFixed(0), unit: '%', color: '#c2410c' },
              { icon: <span aria-hidden>⚠️</span>, label: '需關注（<60%）', value: `${attentionCount}`, unit: '人', color: '#b91c1c', onClick: () => showFilter('attention'), bg: 'bg-rose/25' },
              { icon: <span aria-hidden>⭐</span>, label: '優秀（≥80%）', value: `${topCount}`, unit: '人', color: '#15803d', onClick: () => showFilter('top'), bg: 'bg-sage/25' },
            ].map(k => {
              const body = (
                <>
                  <div className="flex items-center gap-1.5 text-[0.9375rem] font-bold text-muted-foreground">{k.icon}{k.label}</div>
                  <div className="mt-2 font-extrabold tabular-nums leading-none text-[2.25rem] xl:text-[2.5rem]" style={{ color: k.color }}>
                    {k.value}<span className="text-[1.125rem] ml-1 font-bold">{k.unit}</span>
                  </div>
                  {k.onClick && <div className="mt-2 text-sm font-bold text-muted-foreground print:hidden">點一下看名單 →</div>}
                </>
              );
              const cls = `text-left ${k.bg ?? 'bg-card'} border-neo rounded-[20px] shadow-neo-sm px-5 py-4`;
              return k.onClick ? (
                <button key={k.label} type="button" onClick={k.onClick} className={`${cls} neo-hover-lift`}>{body}</button>
              ) : (
                <div key={k.label} className={cls}>{body}</div>
              );
            })}
          </div>

          {/* 三張 recharts 圖表（lazy-loaded）：分數分布、四層次雷達、各題答對率 */}
          <DashboardCharts
            scoreBins={stats!.scoreBins}
            perQuestion={stats!.perQuestion}
            radarData={stats!.radarData}
            hasQuestions={stats!.hasQuestions}
          />

          {/* 下半部：學生成績表（老師最常看，放前面）＋ 逐題選項分布；大螢幕左右並排 */}
          <div className={`grid grid-cols-1 gap-6 items-start ${stats!.hasQuestions ? '2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : ''}`}>
          {/* 學生成績表格 */}
          <Card id="student-table" className={`print-avoid-break scroll-mt-6 min-w-0 ${dashCard}`}>
            <CardHeader>
              <CardTitle className="text-[1.5rem]">學生成績表</CardTitle>
              <CardDescription className="text-[0.9375rem]">點欄位標題可排序、點學生看逐題對錯；可搜尋或篩選需關注／優秀；右上「匯出 CSV」帶回 Excel 整理</CardDescription>
            </CardHeader>
            <CardContent>
              {/* 篩選工具列 */}
              <div className="flex flex-wrap items-center gap-2.5 mb-4 print:hidden">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="搜尋姓名、座號、班級…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-11 text-base border-neo rounded-full"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={pillBtn(filterMode === 'all')} onClick={() => setFilterMode('all')}>全部</button>
                  <button type="button" className={pillBtn(filterMode === 'attention')} onClick={() => setFilterMode('attention')}>⚠ 需關注（&lt;60%）</button>
                  <button type="button" className={pillBtn(filterMode === 'top')} onClick={() => setFilterMode('top')}>⭐ 優秀（≥80%）</button>
                </div>
                <span className="text-[0.9375rem] text-muted-foreground ml-auto">
                  顯示 <span className="font-bold text-foreground">{displayedSubmissions.length}</span> / {dedupedSubmissions.length} 位
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border-neo">
                <table className="w-full text-base">
                  <thead className="bg-cream-deep">
                    <tr className="border-b-[1.5px] border-ink text-left">
                      <SortHeader label="班級"     sortKey="class"        currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="座號"     sortKey="seatNumber"   currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="姓名"     sortKey="name"         currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="答對"     sortKey="correct"      currentKey={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                      <SortHeader label="答對率"   sortKey="accuracy"     currentKey={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                      <SortHeader label="交卷時間" sortKey="submittedAt"  currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <th className="py-3 px-3 w-10 print:hidden" aria-label="展開"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground text-base">
                          {searchTerm || filterMode !== 'all' ? '沒有符合條件的學生' : '尚無資料'}
                        </td>
                      </tr>
                    ) : displayedSubmissions.map((s) => {
                      const acc = s.totalCount > 0 ? Math.round((s.correctCount / s.totalCount) * 100) : 0;
                      const accColor = acc >= 80 ? 'text-green-700' : acc >= 60 ? 'text-orange-700' : 'text-red-700';
                      const accBg = acc >= 80 ? 'bg-green-100' : acc >= 60 ? 'bg-orange-100' : 'bg-red-100';
                      const accIcon = acc >= 80 ? '⭐' : acc >= 60 ? '' : '⚠';
                      const ts = s.submittedAt
                        ? new Date(s.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
                        : '—';
                      const isExpanded = expandedIds.has(s.id);
                      return (
                        <React.Fragment key={s.id}>
                          <tr
                            className={`border-b border-line hover:bg-cream cursor-pointer ${isExpanded ? 'bg-cream' : ''}`}
                            onClick={() => toggleExpand(s.id)}
                          >
                            <td className="py-3 px-3">{s.studentInfo.class}</td>
                            <td className="py-3 px-3 tabular-nums">{s.studentInfo.seatNumber}</td>
                            <td className="py-3 px-3 font-bold">{s.studentInfo.name}</td>
                            <td className="py-3 px-3 text-center tabular-nums">{s.correctCount}/{s.totalCount}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-extrabold tabular-nums ${accColor} ${accBg}`}>
                                {accIcon && <span aria-hidden>{accIcon}</span>}{acc}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm text-muted-foreground whitespace-nowrap">{ts}</td>
                            <td className="py-3 px-3 text-muted-foreground print:hidden">
                              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-cream border-b border-line print:hidden">
                              <td colSpan={7} className="px-4 py-4">
                                <ExpandedStudentDetail student={s} questions={data!.questions} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 逐題選項分布（迷思分析）— 題目資料缺失時隱藏 */}
          {stats!.hasQuestions && (
          <Card className={`print-avoid-break min-w-0 ${dashCard}`}>
            <CardHeader>
              <CardTitle className="text-[1.5rem]">逐題選項分布（迷思分析）</CardTitle>
              <CardDescription className="text-[0.9375rem]">
                看出學生卡在哪個誘答選項。
                <span className="inline-block ml-1 align-middle">
                  <span className="inline-block w-3.5 h-3.5 bg-green-500 rounded-sm mr-1 align-middle" />正解
                  <span className="inline-block w-3.5 h-3.5 bg-gray-400 rounded-sm mx-1 align-middle" />干擾選項
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {stats!.perQuestion.map((q) => (
                <div key={q.idx} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                  <div className="mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-base">第 {q.idx} 題</span>
                      <Badge variant="outline" className="text-sm" style={{ borderColor: q.color, color: q.color }}>
                        {PIRLS_LEVEL_LABEL[q.pirlsLevel] ?? q.pirlsLevel}
                      </Badge>
                      <span className="text-[0.9375rem] text-muted-foreground ml-auto">
                        答對率 <span className="font-extrabold" style={{ color: q.color }}>{q.accuracy}%</span> · {q.correct}/{q.answered}
                        {q.skippedCount > 0 && <span className="ml-1 text-orange-700">· 略過 {q.skippedCount}</span>}
                      </span>
                    </div>
                    <p className="mt-1.5 text-base leading-relaxed text-foreground/85">{q.fullQuestion}</p>
                  </div>
                  <div className="space-y-2">
                    {q.options.map((optText, optIdx) => {
                      const cnt = q.optionCounts[optIdx];
                      const pct = q.total > 0 ? Math.round((cnt / q.total) * 100) : 0;
                      const isCorrect = optIdx === q.correctAnswerIndex;
                      return (
                        <div key={optIdx} className={`flex items-center gap-2.5 text-[0.9375rem] ${isCorrect ? 'font-bold' : ''}`}>
                          <div className="w-8 shrink-0 flex items-center gap-0.5">
                            {isCorrect && <span className="text-green-600" aria-label="正解">✓</span>}
                            <span>{String.fromCharCode(65 + optIdx)}.</span>
                          </div>
                          <div className="flex-1 min-w-0 truncate" title={optText}>{optText}</div>
                          <div className="w-28 sm:w-44 bg-gray-100 rounded-full h-4 relative overflow-hidden shrink-0 border border-line">
                            <div
                              className={`h-full rounded-full ${isCorrect ? 'bg-green-500' : 'bg-gray-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-20 text-right font-mono shrink-0 tabular-nums text-sm">
                            {cnt} ({pct}%)
                          </div>
                        </div>
                      );
                    })}
                    {q.skippedCount > 0 && (
                      <div className="text-sm text-muted-foreground pl-10 italic">
                        略過未答：{q.skippedCount} 人
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
