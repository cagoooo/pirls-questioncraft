// src/app/dashboard/page.tsx
// B.16: 老師端儀表板 — /dashboard/?id=quizId
// 顯示班級答題分布、各題答對率、PIRLS 四層次平均、學生成績表格 + CSV 匯出
"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, RefreshCw, Download, ArrowLeft, Users, Target, BarChart3 } from 'lucide-react';
import { PirlsLogo } from '@/components/PirlsLogo';
import { getSubmissions, type DashboardData, type SubmissionRecord } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

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

function DashboardInner() {
  const searchParams = useSearchParams();
  const quizId = searchParams?.get('id') ?? '';

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);

  useEffect(() => {
    if (!quizId) {
      setError('缺少 ?id=xxx 參數');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const d = await getSubmissions(quizId);
        if (!cancelled) setData(d);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? '無法讀取儀表板資料');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quizId, reloadSignal]);

  const stats = useMemo(() => {
    if (!data || !data.submissions.length || !data.questions.length) return null;
    const subs = data.submissions;
    const qs = data.questions;

    // 1. 班級總平均、最高、最低
    const accuracies = subs.map(s => s.totalCount > 0 ? (s.correctCount / s.totalCount) * 100 : 0);
    const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const high = Math.max(...accuracies);
    const low = Math.min(...accuracies);

    // 2. 各題答對率
    const perQuestion = qs.map((q, idx) => {
      const correctCount = subs.filter(s => s.answers[idx] === q.correctAnswerIndex).length;
      const total = subs.length;
      return {
        idx: idx + 1,
        question: q.question.length > 30 ? q.question.slice(0, 28) + '…' : q.question,
        fullQuestion: q.question,
        pirlsLevel: q.pirlsLevel,
        correct: correctCount,
        total,
        accuracy: total > 0 ? Math.round((correctCount / total) * 100) : 0,
        color: PIRLS_LEVEL_COLOR[q.pirlsLevel] ?? '#888',
      };
    });

    // 3. PIRLS 4 層次平均答對率
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

    return { avg, high, low, perQuestion, radarData, levelStats };
  }, [data]);

  const downloadCSV = () => {
    if (!data) return;
    const rows: string[] = [];
    rows.push(['班級', '座號', '姓名', '答對', '總題數', '答對率%', '訊息提取', '直接推論', '詮釋整合', '評估批判', '交卷時間'].join(','));
    data.submissions.forEach(s => {
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
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
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

  const empty = !data || data.submissions.length === 0;

  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen">
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
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloadSignal(s => s + 1)}>
            <RefreshCw className="h-4 w-4 mr-1" /> 重新整理
          </Button>
          {!empty && (
            <Button variant="outline" size="sm" onClick={downloadCSV}>
              <Download className="h-4 w-4 mr-1" /> 匯出 CSV
            </Button>
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
            <CardDescription>學生作答後資料會即時出現，按右上角「重新整理」可更新。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* KPI 卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3" /> 交卷人數
                </CardDescription>
                <CardTitle className="text-3xl text-primary">{data!.submissions.length}</CardTitle>
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

          {/* 各題答對率 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> 各題答對率
              </CardTitle>
              <CardDescription>顏色對應 PIRLS 四層次（藍=訊息提取／綠=直接推論／橘=詮釋整合／紫=評估批判）</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats!.perQuestion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" label={{ value: '題號', position: 'insideBottom', offset: -5 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip
                    formatter={(value: any, _name: any, p: any) => [`${value}% (${p.payload.correct}/${p.payload.total})`, '答對率']}
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

          {/* PIRLS 四層次雷達圖 */}
          <Card className="mb-6">
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

          {/* 學生成績表格 */}
          <Card>
            <CardHeader>
              <CardTitle>學生成績表</CardTitle>
              <CardDescription>依交卷時間倒序，可按右上「匯出 CSV」帶回 Excel 整理</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2">班級</th>
                    <th className="py-2 px-2">座號</th>
                    <th className="py-2 px-2">姓名</th>
                    <th className="py-2 px-2 text-center">答對</th>
                    <th className="py-2 px-2 text-center">答對率</th>
                    <th className="py-2 px-2 text-xs">交卷時間</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.submissions.map((s) => {
                    const acc = s.totalCount > 0 ? Math.round((s.correctCount / s.totalCount) * 100) : 0;
                    const accColor = acc >= 80 ? 'text-green-600' : acc >= 60 ? 'text-orange-600' : 'text-red-600';
                    const ts = s.submittedAt
                      ? new Date(s.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
                      : '—';
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2">{s.studentInfo.class}</td>
                        <td className="py-2 px-2">{s.studentInfo.seatNumber}</td>
                        <td className="py-2 px-2 font-medium">{s.studentInfo.name}</td>
                        <td className="py-2 px-2 text-center">{s.correctCount}/{s.totalCount}</td>
                        <td className={`py-2 px-2 text-center font-bold ${accColor}`}>{acc}%</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{ts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
