// src/app/dashboard/page.tsx
// B.16: 老師端儀表板 — /dashboard/?id=quizId
// 顯示班級答題分布、各題答對率、PIRLS 四層次平均、學生成績表格 + CSV 匯出
"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2, AlertCircle, RefreshCw, Download, ArrowLeft, Users, Target, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown, Search, Printer, Copy, ExternalLink, Wifi, WifiOff,
  ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { PirlsLogo } from '@/components/PirlsLogo';
import { getSubmissions, type DashboardData, type SubmissionRecord } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

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

const PIRLS_LEVEL_LABEL: Record<string, string> = {
  'locate & retrieve': '訊息提取',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋整合',
  'evaluate & critique': '評估批判',
};

const PIRLS_LEVEL_COLOR: Record<string, string> = {
  'locate & retrieve': '#3B82F6',
  'make straightforward inferences': '#10B981',
  'interpret & integrate': '#F59E0B',
  'evaluate & critique': '#A387D9',
};

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
      className={`py-2 px-2 cursor-pointer select-none hover:bg-muted/40 transition ${align === 'center' ? 'text-center' : ''} ${className ?? ''}`}
      onClick={() => onClick(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${active ? 'text-primary font-bold' : ''}`}>
        {label}
        <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
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
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-muted-foreground font-medium">PIRLS 層次：</span>
          {Object.entries(PIRLS_LEVEL_LABEL).map(([key, label]) => {
            const stat = student.pirlsLevelStats?.[key];
            if (!stat || stat.total === 0) return null;
            const pct = Math.round((stat.correct / stat.total) * 100);
            const color = PIRLS_LEVEL_COLOR[key] ?? '#888';
            return (
              <div key={key} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
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
          <div className="text-xs text-muted-foreground mb-1.5">
            逐題對錯（hover 看題目與答案）：
            <span className="inline-block w-2 h-2 bg-green-500 rounded-sm ml-2 mr-1" />答對
            <span className="inline-block w-2 h-2 bg-red-400 rounded-sm ml-2 mr-1" />答錯
            <span className="inline-block w-2 h-2 bg-gray-300 rounded-sm ml-2 mr-1" />略過
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-1.5">
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
                  className={`${cellClass} border rounded text-xs text-center py-1.5 px-1 font-bold cursor-help select-none`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">題目資料已刪除，無法呈現逐題對錯。</div>
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

  // 「上次更新 X 秒前」每 10 秒重新計算
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(async (mode: 'full' | 'background') => {
    if (!quizId) return;
    if (mode === 'full') {
      setIsLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }
    try {
      const d = await getSubmissions(quizId);
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
  }, [quizId]);

  useEffect(() => {
    if (!quizId) {
      setError('缺少 ?id=xxx 參數');
      setIsLoading(false);
      return;
    }
    fetchData('full');
  }, [quizId, reloadSignal, fetchData]);

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
        <p className="text-muted-foreground mt-4">讀取儀表板資料中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold text-destructive">無法載入儀表板</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>錯誤</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
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

  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen">
      {/* 列印樣式：藏掉互動 UI、避免 card 跨頁切半 */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
          table { font-size: 11px !important; }
        }
      `}</style>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <PirlsLogo className="mb-2 h-12 w-auto sm:h-16" />
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">老師端儀表板</h1>
          {data?.quizTitle && (
            <p className="text-base sm:text-lg text-muted-foreground mt-1">
              📝 {data.quizTitle}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Quiz ID: {quizId}</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {isRefreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : autoRefresh ? (
                <Wifi className="h-3 w-3 text-green-600" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              上次更新：{formatRelative(lastUpdated, now)}
              {autoRefresh && <span className="text-green-700">· 自動更新中（每 30 秒）</span>}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? '關閉自動更新' : '開啟自動更新'}
          >
            {autoRefresh ? (
              <><Wifi className="h-4 w-4 mr-1 text-green-600" /> 自動更新中</>
            ) : (
              <><WifiOff className="h-4 w-4 mr-1" /> 自動更新關</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReloadSignal(s => s + 1)} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} /> 重新整理
          </Button>
          {!empty && (
            <>
              <Button variant="outline" size="sm" onClick={downloadCSV}>
                <Download className="h-4 w-4 mr-1" /> 匯出 CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> 列印 / 存 PDF
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> 回首頁</Link>
          </Button>
        </div>
      </header>

      {empty ? (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> 還沒有人交卷
            </CardTitle>
            <CardDescription>
              學生作答後資料會自動出現（每 30 秒刷新一次）。可以再投影一次學生作答 QR Code：
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentUrl ? (
              <>
                <div className="flex justify-center bg-white p-4 rounded-lg border">
                  <QRCodeSVG
                    value={studentUrl}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="L"
                    includeMargin={false}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">學生作答連結</p>
                  <div className="flex gap-2">
                    <Input value={studentUrl} readOnly className="text-xs font-mono" />
                    <Button size="sm" variant="outline" onClick={copyStudentUrl} title="複製連結">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" asChild title="另開新視窗">
                      <a href={studentUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">學生作答連結載入中…</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 提示橫幅：重複交卷去重 / 題目已刪除 */}
          {(duplicateCount > 0 || questionsMissing) && (
            <div className="mb-4 space-y-2">
              {duplicateCount > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>已自動合併重複交卷</AlertTitle>
                  <AlertDescription>
                    偵測到 {duplicateCount} 筆重複交卷（同班級+座號+姓名），已取「最後一次交卷」作為計分依據。
                  </AlertDescription>
                </Alert>
              )}
              {questionsMissing && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>題目資料已刪除</AlertTitle>
                  <AlertDescription>
                    本測驗的題目資料已不存在（可能已過期或被清除），仍可看學生分數與 PIRLS 層次表現，但無法呈現「各題答對率」與「逐題選項分布」。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* KPI 卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print-avoid-break">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3" /> 交卷人數
                </CardDescription>
                <CardTitle className="text-3xl text-primary">{dedupedSubmissions.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Target className="h-3 w-3" /> 班級平均
                </CardDescription>
                <CardTitle className="text-3xl text-primary">{stats!.avg.toFixed(1)}%</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">最高分</CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats!.high.toFixed(0)}%</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">最低分</CardDescription>
                <CardTitle className="text-3xl text-orange-600">{stats!.low.toFixed(0)}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* 分數分布直方圖 */}
          <Card className="mb-6 print-avoid-break">
            <CardHeader>
              <CardTitle>班級分數分布</CardTitle>
              <CardDescription>看出班上是「集中在某個區間」（單峰）還是「兩極化」（M 型）。</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats!.scoreBins}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis allowDecimals={false} label={{ value: '人數', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value: any, _n: any, p: any) => [`${value} 人`, `分數 ${p.payload.range}`]}
                    labelFormatter={() => ''}
                  />
                  <Bar dataKey="count" name="人數">
                    {stats!.scoreBins.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 各題答對率（題目資料缺失時隱藏） */}
          {stats!.hasQuestions && (
          <Card className="mb-6 print-avoid-break">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> 各題答對率
              </CardTitle>
              <CardDescription>
                顏色對應 PIRLS 四層次（藍=訊息提取／綠=直接推論／橘=詮釋整合／紫=評估批判）。
                <span className="block mt-0.5">答對率 = 答對人數 ÷ <strong>實際作答人數</strong>；hover 可看完成率。</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats!.perQuestion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" label={{ value: '題號', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(value: any, _name: any, p: any) => {
                      const q = p.payload;
                      return [`${value}% (${q.correct}/${q.answered})  ·  完成率 ${q.completionRate}% (${q.answered}/${q.total})`, '答對率'];
                    }}
                    labelFormatter={(idx: any, payload: any) => {
                      const q = payload?.[0]?.payload;
                      return q ? `第 ${idx} 題 [${PIRLS_LEVEL_LABEL[q.pirlsLevel]}]\n${q.fullQuestion}` : `第 ${idx} 題`;
                    }}
                  />
                  <Bar dataKey="accuracy" name="答對率">
                    {stats!.perQuestion.map((q, i) => (
                      <Cell key={i} fill={q.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          )}

          {/* PIRLS 四層次雷達圖 */}
          <Card className="mb-6 print-avoid-break">
            <CardHeader>
              <CardTitle>PIRLS 四層次班級平均答對率</CardTitle>
              <CardDescription>看出班上整體在哪個閱讀素養層次強、哪個層次需要加強</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={stats!.radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="level" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="班級平均" dataKey="accuracy" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 逐題選項分布（迷思分析）— 題目資料缺失時隱藏 */}
          {stats!.hasQuestions && (
          <Card className="mb-6 print-avoid-break">
            <CardHeader>
              <CardTitle>逐題選項分布（迷思分析）</CardTitle>
              <CardDescription>
                看出學生卡在哪個誘答選項。
                <span className="inline-block ml-1 align-middle">
                  <span className="inline-block w-3 h-3 bg-green-500 rounded-sm mr-1" />正解
                  <span className="inline-block w-3 h-3 bg-gray-400 rounded-sm mx-1" />干擾選項
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {stats!.perQuestion.map((q) => (
                <div key={q.idx} className="border-b pb-4 last:border-b-0 last:pb-0">
                  <div className="mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">第 {q.idx} 題</span>
                      <Badge variant="outline" style={{ borderColor: q.color, color: q.color }}>
                        {PIRLS_LEVEL_LABEL[q.pirlsLevel] ?? q.pirlsLevel}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        答對率 <span className="font-bold" style={{ color: q.color }}>{q.accuracy}%</span> · {q.correct}/{q.answered}
                        {q.skippedCount > 0 && <span className="ml-1 text-orange-600">· 略過 {q.skippedCount}</span>}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/80">{q.fullQuestion}</p>
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((optText, optIdx) => {
                      const cnt = q.optionCounts[optIdx];
                      const pct = q.total > 0 ? Math.round((cnt / q.total) * 100) : 0;
                      const isCorrect = optIdx === q.correctAnswerIndex;
                      return (
                        <div key={optIdx} className="flex items-center gap-2 text-xs">
                          <div className="w-7 shrink-0 font-medium flex items-center gap-0.5">
                            {isCorrect && <span className="text-green-600" aria-label="正解">✓</span>}
                            <span>{String.fromCharCode(65 + optIdx)}.</span>
                          </div>
                          <div className="flex-1 min-w-0 truncate" title={optText}>{optText}</div>
                          <div className="w-24 sm:w-32 bg-gray-100 dark:bg-gray-800 rounded h-3 relative overflow-hidden shrink-0">
                            <div
                              className={`h-full ${isCorrect ? 'bg-green-500' : 'bg-gray-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="w-16 text-right font-mono shrink-0 tabular-nums">
                            {cnt} ({pct}%)
                          </div>
                        </div>
                      );
                    })}
                    {q.skippedCount > 0 && (
                      <div className="text-xs text-muted-foreground pl-9 italic">
                        略過未答：{q.skippedCount} 人
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          )}

          {/* 學生成績表格 */}
          <Card className="print-avoid-break">
            <CardHeader>
              <CardTitle>學生成績表</CardTitle>
              <CardDescription>點欄位標題可排序；可搜尋、依需關注/優秀篩選；右上「匯出 CSV」帶回 Excel 整理</CardDescription>
            </CardHeader>
            <CardContent>
              {/* 篩選工具列 */}
              <div className="flex flex-wrap items-center gap-2 mb-3 print:hidden">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="搜尋姓名/座號/班級…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-7 h-8 text-sm w-48"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={filterMode === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilterMode('all')}
                    className="h-8"
                  >
                    全部
                  </Button>
                  <Button
                    size="sm"
                    variant={filterMode === 'attention' ? 'default' : 'outline'}
                    onClick={() => setFilterMode('attention')}
                    className="h-8"
                  >
                    ⚠ 需關注 (&lt;60%)
                  </Button>
                  <Button
                    size="sm"
                    variant={filterMode === 'top' ? 'default' : 'outline'}
                    onClick={() => setFilterMode('top')}
                    className="h-8"
                  >
                    ⭐ 優秀 (≥80%)
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  顯示 <span className="font-bold text-foreground">{displayedSubmissions.length}</span> / {data!.submissions.length} 位
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <SortHeader label="班級"     sortKey="class"        currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="座號"     sortKey="seatNumber"   currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="姓名"     sortKey="name"         currentKey={sortKey} dir={sortDir} onClick={handleSort} />
                      <SortHeader label="答對"     sortKey="correct"      currentKey={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                      <SortHeader label="答對率"   sortKey="accuracy"     currentKey={sortKey} dir={sortDir} onClick={handleSort} align="center" />
                      <SortHeader label="交卷時間" sortKey="submittedAt"  currentKey={sortKey} dir={sortDir} onClick={handleSort} className="text-xs" />
                      <th className="py-2 px-2 w-8 print:hidden" aria-label="展開"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">
                          {searchTerm || filterMode !== 'all' ? '沒有符合條件的學生' : '尚無資料'}
                        </td>
                      </tr>
                    ) : displayedSubmissions.map((s) => {
                      const acc = s.totalCount > 0 ? Math.round((s.correctCount / s.totalCount) * 100) : 0;
                      const accColor = acc >= 80 ? 'text-green-600' : acc >= 60 ? 'text-orange-600' : 'text-red-600';
                      const accIcon = acc >= 80 ? '⭐' : acc >= 60 ? '' : '⚠';
                      const ts = s.submittedAt
                        ? new Date(s.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
                        : '—';
                      const isExpanded = expandedIds.has(s.id);
                      return (
                        <React.Fragment key={s.id}>
                          <tr
                            className={`border-b hover:bg-muted/30 cursor-pointer ${isExpanded ? 'bg-muted/30' : ''}`}
                            onClick={() => toggleExpand(s.id)}
                          >
                            <td className="py-2 px-2">{s.studentInfo.class}</td>
                            <td className="py-2 px-2">{s.studentInfo.seatNumber}</td>
                            <td className="py-2 px-2 font-medium">{s.studentInfo.name}</td>
                            <td className="py-2 px-2 text-center tabular-nums">{s.correctCount}/{s.totalCount}</td>
                            <td className={`py-2 px-2 text-center font-bold tabular-nums ${accColor}`}>
                              {accIcon && <span className="mr-0.5" aria-hidden>{accIcon}</span>}
                              {acc}%
                            </td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">{ts}</td>
                            <td className="py-2 px-2 text-muted-foreground print:hidden">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-muted/20 border-b print:hidden">
                              <td colSpan={7} className="px-4 py-3">
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
