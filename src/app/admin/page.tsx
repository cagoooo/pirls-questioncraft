// src/app/admin/page.tsx
// B.26: 老師端使用量 admin dashboard
// 1. 第一次進來顯示 password 輸入框
// 2. 通過驗證後 sessionStorage 存 adminKey，30 天內不用再輸入
// 3. 顯示 KPI + 30 天折線圖 + PIRLS 雷達 + 失敗率餅圖
"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, AlertCircle, Lock, RefreshCw, ArrowLeft,
  TrendingUp, Users, FileText, AlertTriangle, BarChart3, Target,
} from 'lucide-react';
import { PirlsLogo } from '@/components/PirlsLogo';
import { getAdminStats, type AdminStats } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const STORAGE_KEY = 'pirls-admin-key';

const PIRLS_LEVEL_LABEL: Record<string, string> = {
  'locate & retrieve': '訊息提取',
  'make straightforward inferences': '直接推論',
  'interpret & integrate': '詮釋整合',
  'evaluate & critique': '評估批判',
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string>('');
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);

  // 載入 sessionStorage 內已有的 key
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setAdminKey(saved);
      setAuthed(true);
    }
  }, []);

  // 已驗證 → fetch
  useEffect(() => {
    if (!authed || !adminKey) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getAdminStats(adminKey);
        if (!cancelled) setStats(data);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? '載入失敗');
        // 401/403 → 清掉 key 跳回登入
        if ((e?.message ?? '').includes('未授權') || (e?.message ?? '').includes('403')) {
          sessionStorage.removeItem(STORAGE_KEY);
          setAuthed(false);
          setAdminKey('');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authed, adminKey, reloadSignal]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) return;
    sessionStorage.setItem(STORAGE_KEY, adminKey.trim());
    setAuthed(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setAdminKey('');
    setStats(null);
  };

  // ---- 計算衍生指標 ----
  const derived = useMemo(() => {
    if (!stats) return null;
    const totalGen = stats.totals.imageGen + stats.totals.textGen;
    const totalFail = stats.totals.imageGenFailed + stats.totals.textGenFailed;
    const failRate = totalGen > 0 ? (totalFail / (totalGen + totalFail)) * 100 : 0;
    const successRate = 100 - failRate;
    const imageRatio = totalGen > 0 ? (stats.totals.imageGen / totalGen) * 100 : 0;

    // 折線圖資料
    const chartData = stats.dailyStats.map((d) => ({
      date: d.date.slice(5), // MM-DD
      圖片: d['generate-images'] ?? 0,
      文字: d['generate-text'] ?? 0,
      失敗: (d['generate-images-failed'] ?? 0) + (d['generate-text-failed'] ?? 0),
      交卷: d['submit-quiz'] ?? 0,
    }));

    // 餅圖資料
    const pieData = [
      { name: '成功', value: totalGen, color: '#10B981' },
      { name: '失敗', value: totalFail, color: '#EF4444' },
    ];

    // PIRLS 雷達
    const radarData = stats.pirlsBreakdown.map((b) => ({
      level: PIRLS_LEVEL_LABEL[b.level] ?? b.level,
      accuracy: Math.round(b.accuracy),
      fullMark: 100,
    }));

    return { totalGen, totalFail, failRate, successRate, imageRatio, chartData, pieData, radarData };
  }, [stats]);

  // ---- 登入畫面 ----
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <PirlsLogo className="h-20 mb-6" />
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> 老師端 Admin 入口
            </CardTitle>
            <CardDescription>需要管理員 key 才能查看使用量統計</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* a11y: 隱形 username 欄滿足瀏覽器密碼管理器規範 */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value="admin"
                readOnly
                aria-hidden="true"
                tabIndex={-1}
                style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
              />
              <div className="space-y-2">
                <Label htmlFor="key">Admin Key</Label>
                <Input
                  id="key"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="輸入管理員密碼"
                  autoComplete="current-password"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Key 由阿凱老師保管。輸入後存於 sessionStorage，關閉分頁即清。
                </p>
              </div>
              <Button type="submit" className="w-full">登入</Button>
              <Button type="button" variant="ghost" asChild className="w-full">
                <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> 返回首頁</Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- 已驗證 → dashboard ----
  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <PirlsLogo className="mb-2 h-12 w-auto sm:h-16" />
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">使用量總覽</h1>
          <p className="text-sm text-muted-foreground">過去 30 天 / 全部已交作答</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloadSignal(s => s + 1)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> 重新整理
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>登出</Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> 回首頁</Link>
          </Button>
        </div>
      </header>

      {isLoading && !stats && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground mt-4">讀取中...</p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>錯誤</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stats && derived && (
        <>
          {/* KPI 卡片 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs"><TrendingUp className="h-3 w-3" /> 30 天出題</CardDescription>
                <CardTitle className="text-3xl text-primary">{derived.totalGen}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">圖片 {stats.totals.imageGen}・文字 {stats.totals.textGen}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs"><AlertTriangle className="h-3 w-3" /> 成功率</CardDescription>
                <CardTitle className={`text-3xl ${derived.successRate >= 95 ? 'text-green-600' : derived.successRate >= 85 ? 'text-orange-600' : 'text-red-600'}`}>
                  {derived.successRate.toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{derived.totalFail} 次失敗</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs"><Users className="h-3 w-3" /> 累計學生作答</CardDescription>
                <CardTitle className="text-3xl text-primary">{stats.totalSubmissions}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">所有時間</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1 text-xs"><Target className="h-3 w-3" /> 平均答對率</CardDescription>
                <CardTitle className="text-3xl text-primary">
                  {stats.avgAccuracy !== null ? `${stats.avgAccuracy.toFixed(1)}%` : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{stats.totals.shares} 次分享</p>
              </CardContent>
            </Card>
          </div>

          {/* 30 天每日活動 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> 30 天每日活動</CardTitle>
              <CardDescription>圖片/文字出題、失敗、學生交卷</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={derived.chartData}>
                  <defs>
                    <linearGradient id="colImg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colTxt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.7}/>
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="圖片" stackId="1" stroke="#3B82F6" fill="url(#colImg)" />
                  <Area type="monotone" dataKey="文字" stackId="1" stroke="#10B981" fill="url(#colTxt)" />
                  <Area type="monotone" dataKey="失敗" stackId="2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="交卷" stackId="3" stroke="#A387D9" fill="#A387D9" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* 成功 / 失敗餅圖 */}
            {derived.totalGen + derived.totalFail > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>成功 vs 失敗</CardTitle>
                  <CardDescription>30 天出題成敗比</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={derived.pieData}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={90}
                        dataKey="value"
                        label={({ name, value, percent }) => `${name} ${value} (${(percent! * 100).toFixed(0)}%)`}
                      >
                        {derived.pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* PIRLS 雷達 */}
            {derived.radarData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>PIRLS 4 層次答對率</CardTitle>
                  <CardDescription>所有學生作答聚合</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart data={derived.radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="level" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="答對率" dataKey="accuracy" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
                      <Tooltip formatter={(v: any) => `${v}%`} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 詳細數字表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> 30 天詳細統計</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2">日期</th>
                    <th className="py-2 px-2 text-right">圖片</th>
                    <th className="py-2 px-2 text-right">文字</th>
                    <th className="py-2 px-2 text-right">失敗</th>
                    <th className="py-2 px-2 text-right">分享</th>
                    <th className="py-2 px-2 text-right">交卷</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.dailyStats].reverse().map((d) => {
                    const fails = (d['generate-images-failed'] ?? 0) + (d['generate-text-failed'] ?? 0);
                    const total = (d['generate-images'] ?? 0) + (d['generate-text'] ?? 0) + fails;
                    if (total === 0 && (d['share-quiz'] ?? 0) === 0 && (d['submit-quiz'] ?? 0) === 0) return null;
                    return (
                      <tr key={d.date} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono text-xs">{d.date}</td>
                        <td className="py-2 px-2 text-right text-blue-600">{d['generate-images'] ?? 0}</td>
                        <td className="py-2 px-2 text-right text-green-600">{d['generate-text'] ?? 0}</td>
                        <td className="py-2 px-2 text-right text-red-600">{fails || ''}</td>
                        <td className="py-2 px-2 text-right">{d['share-quiz'] ?? 0}</td>
                        <td className="py-2 px-2 text-right text-purple-600">{d['submit-quiz'] ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stats.dailyStats.every(d => Object.keys(d).filter(k => k !== 'date').length === 0) && (
                <p className="text-center text-muted-foreground py-8">過去 30 天還沒有資料</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
