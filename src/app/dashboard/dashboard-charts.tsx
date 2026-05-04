// src/app/dashboard/dashboard-charts.tsx
// 把所有 recharts 圖表抽出到這支獨立的 chunk，page.tsx 用 dynamic import 載入。
// 同時為每張圖附上 <details> 純文字替代，照顧 a11y / 螢幕閱讀器 / 想直接看數字的使用者。
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { PIRLS_LEVEL_LABEL } from './constants';

export interface ScoreBin {
  range: string;
  min: number;
  max: number;
  color: string;
  count: number;
}

export interface PerQuestionStat {
  idx: number;
  question: string;
  fullQuestion: string;
  pirlsLevel: string;
  correct: number;
  answered: number;
  total: number;
  accuracy: number;
  completionRate: number;
  color: string;
  options: string[];
  correctAnswerIndex: number;
  optionCounts: number[];
  skippedCount: number;
}

export interface RadarPoint {
  level: string;
  accuracy: number;
  fullMark: number;
}

export interface DashboardChartsProps {
  scoreBins: ScoreBin[];
  perQuestion: PerQuestionStat[];
  radarData: RadarPoint[];
  hasQuestions: boolean;
}

function TextDataDetails({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer hover:text-foreground select-none">
        📋 {summary}
      </summary>
      <div className="mt-2 pl-4">{children}</div>
    </details>
  );
}

export default function DashboardCharts({ scoreBins, perQuestion, radarData, hasQuestions }: DashboardChartsProps) {
  // a11y 摘要：給螢幕閱讀器用
  const totalStudents = scoreBins.reduce((a, b) => a + b.count, 0);
  const peakBin = scoreBins.reduce((a, b) => (b.count > a.count ? b : a), scoreBins[0]);
  const scoreSummary = `班級分數分布：共 ${totalStudents} 位，最多人落在 ${peakBin.range} 區間（${peakBin.count} 人）。`;

  const radarSummary = `PIRLS 四層次班級平均答對率：` +
    radarData.map(r => `${r.level} ${r.accuracy}%`).join('、') + '。';

  const perQSummary = hasQuestions
    ? `共 ${perQuestion.length} 題，答對率最高第 ${[...perQuestion].sort((a, b) => b.accuracy - a.accuracy)[0]?.idx} 題（${[...perQuestion].sort((a, b) => b.accuracy - a.accuracy)[0]?.accuracy}%），最低第 ${[...perQuestion].sort((a, b) => a.accuracy - b.accuracy)[0]?.idx} 題（${[...perQuestion].sort((a, b) => a.accuracy - b.accuracy)[0]?.accuracy}%）。`
    : '';

  return (
    <>
      {/* 分數分布直方圖 */}
      <Card className="mb-6 print-avoid-break">
        <CardHeader>
          <CardTitle>班級分數分布</CardTitle>
          <CardDescription>看出班上是「集中在某個區間」（單峰）還是「兩極化」（M 型）。</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label={scoreSummary}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreBins}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} label={{ value: '人數', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value: any, _n: any, p: any) => [`${value} 人`, `分數 ${p.payload.range}`]}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="count" name="人數">
                  {scoreBins.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <TextDataDetails summary="顯示純文字數據">
            <ul className="space-y-0.5">
              {scoreBins.map(b => (
                <li key={b.range}>
                  <span className="inline-block w-3 h-3 rounded-sm mr-1.5 align-middle" style={{ background: b.color }} />
                  {b.range}：<span className="font-mono tabular-nums">{b.count}</span> 人
                </li>
              ))}
              <li className="mt-1 pt-1 border-t">合計：<span className="font-bold">{totalStudents}</span> 位</li>
            </ul>
          </TextDataDetails>
        </CardContent>
      </Card>

      {/* 各題答對率 */}
      {hasQuestions && (
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
            <div role="img" aria-label={perQSummary}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={perQuestion}>
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
                    {perQuestion.map((q, i) => (
                      <Cell key={i} fill={q.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <TextDataDetails summary="顯示純文字數據（含完成率）">
              <ul className="space-y-0.5">
                {perQuestion.map(q => (
                  <li key={q.idx}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: q.color }} />
                    第 {q.idx} 題（{PIRLS_LEVEL_LABEL[q.pirlsLevel] ?? q.pirlsLevel}）：答對率 <span className="font-mono tabular-nums font-bold" style={{ color: q.color }}>{q.accuracy}%</span> ({q.correct}/{q.answered})
                    {q.skippedCount > 0 && <span className="ml-1 text-orange-600">· 略過 {q.skippedCount} 人</span>}
                  </li>
                ))}
              </ul>
            </TextDataDetails>
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
          <div role="img" aria-label={radarSummary}>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="level" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="班級平均" dataKey="accuracy" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <TextDataDetails summary="顯示純文字數據">
            <ul className="space-y-0.5">
              {radarData.map(r => (
                <li key={r.level}>
                  {r.level}：<span className="font-mono tabular-nums font-bold">{r.accuracy}%</span>
                </li>
              ))}
            </ul>
          </TextDataDetails>
        </CardContent>
      </Card>
    </>
  );
}
