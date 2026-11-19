// src/components/QuizEndScreen.tsx
// 學生按「退出測驗」後的結束畫面：清楚告訴學生「測驗已經結束」，並給一份題目回饋總結。
"use client";

import { SubmitStatusBox, type SubmitStatus } from '@/components/SubmitStatusBox';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle, XCircle, MinusCircle, RotateCcw, FileText, Loader2, Sparkles, Lightbulb, ThumbsUp } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { StudentInfo } from '@/app/quiz/page';

export interface EndScreenResultItem {
  questionText: string;
  options: string[];
  userAnswerIndex: number | null;
  correctAnswerIndex: number;
  isCorrect: boolean;
  explanation: string;
  pirlsLevel: string;
}

export interface EndScreenLevelInfo {
  label: string;
  badgeVariant: VariantProps<typeof badgeVariants>['variant'];
}

interface QuizEndScreenProps {
  results: EndScreenResultItem[];
  levels: Record<string, EndScreenLevelInfo>;
  studentInfo?: StudentInfo;
  quizTitle?: string;
  endedEarly: boolean;
  /** 作答送給老師的狀態（共享連結進來且至少答了一題才會送） */
  submitStatus: SubmitStatus;
  onRetrySubmit: () => void;
  onRestart: () => void;
  onDownloadPdf: () => void;
  isPdfBusy: boolean;
}

const optionLabels = ['A', 'B', 'C', 'D'];

// 各閱讀層次「下次可以這樣做」的小提醒（給國小學生看的白話）
const LEVEL_TIPS: Record<string, string> = {
  'locate & retrieve': '回到文章裡找題目的關鍵字，答案常常就寫在那附近。',
  'make straightforward inferences': '把前後兩句話連起來想，找出文章沒有直接說、但可以推出來的事。',
  'interpret & integrate': '讀完整段再想想：這段在說什麼？人物有什麼想法和感受？把不同段落的訊息合起來。',
  'evaluate & critique': '想一想作者為什麼這樣寫、這樣安排有什麼效果，再說出自己的看法和理由。',
};

function headline(pct: number, answered: number) {
  if (answered === 0) return { emoji: '🏁', text: '這次還沒作答，下次再來挑戰！' };
  if (pct >= 90) return { emoji: '🏆', text: '太厲害了，幾乎全對！' };
  if (pct >= 70) return { emoji: '🌟', text: '表現很棒！' };
  if (pct >= 50) return { emoji: '👍', text: '不錯哦，再加把勁！' };
  return { emoji: '📚', text: '一起把文章再讀一次吧！' };
}

export function QuizEndScreen({
  results,
  levels,
  studentInfo,
  quizTitle,
  endedEarly,
  submitStatus,
  onRetrySubmit,
  onRestart,
  onDownloadPdf,
  isPdfBusy,
}: QuizEndScreenProps) {
  const total = results.length;
  const correct = results.filter((r) => r.isCorrect).length;
  const unanswered = results.filter((r) => r.userAnswerIndex === null).length;
  const answered = total - unanswered;
  const wrong = answered - correct;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const head = headline(pct, answered);

  // 各層次統計（只列這份測驗有出到的層次）
  const levelStats = Object.keys(levels)
    .map((key) => {
      const items = results.filter((r) => r.pirlsLevel === key);
      const c = items.filter((r) => r.isCorrect).length;
      return { key, label: levels[key].label, variant: levels[key].badgeVariant, correct: c, total: items.length };
    })
    .filter((s) => s.total > 0);

  const strengths = answered > 0 ? levelStats.filter((s) => s.correct === s.total) : [];
  const toImprove = levelStats
    .filter((s) => s.correct < s.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 2);

  // 答錯和沒作答的題目預設展開，方便直接看講解
  const openByDefault = results
    .map((r, i) => (r.isCorrect ? null : `end-${i}`))
    .filter((v): v is string => v !== null);

  return (
    <div className="w-full space-y-5 animate-in fade-in-50 slide-in-from-bottom-6 duration-500">
      {/* 結束橫幅 */}
      <section
        className="relative overflow-hidden rounded-[24px] border-neo bg-lemon text-ink shadow-neo-lg px-5 py-6 sm:px-8 sm:py-8 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="inline-flex items-center gap-1.5 rounded-full border-neo bg-cream px-3 py-1 text-xs sm:text-sm font-extrabold shadow-neo-sm">
          🏁 測驗已結束
        </p>
        <div className="mt-4 text-5xl sm:text-6xl animate-in zoom-in-50 duration-700" aria-hidden="true">
          {head.emoji}
        </div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold">{head.text}</h2>
        <p className="mt-2 text-sm sm:text-base text-ink-soft">
          {studentInfo?.name ? `${studentInfo.name}，謝謝你認真作答` : '謝謝你認真作答'}
          {quizTitle ? `「${quizTitle}」` : ''}。
          {endedEarly && unanswered > 0 && (
            <>
              <br />
              你提早結束了測驗，還有 <b>{unanswered}</b> 題沒作答（沒作答的題目算答錯）。
            </>
          )}
        </p>
      </section>

      {/* 分數 */}
      <section className="rounded-[24px] border-neo bg-card shadow-neo px-5 py-6 sm:px-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div
            className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-full border-neo"
            style={{ background: `conic-gradient(#5E9968 ${pct * 3.6}deg, #E5DBC8 0deg)` }}
            role="img"
            aria-label={`答對率 ${pct}%`}
          >
            <div className="absolute inset-3 rounded-full bg-cream border-neo flex flex-col items-center justify-center text-ink">
              <span className="text-3xl sm:text-4xl font-extrabold tabular-nums">{pct}%</span>
              <span className="text-xs font-bold text-ink-soft">答對率</span>
            </div>
          </div>
          <div className="flex-1 w-full space-y-3">
            <p className="text-lg sm:text-xl font-extrabold text-center sm:text-left">
              共 {total} 題，答對 <span className="text-sage-deep">{correct}</span> 題
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-ink">
              <div className="rounded-[14px] border-neo bg-sage/60 px-2 py-2">
                <div className="text-xs font-bold">✅ 答對</div>
                <div className="text-2xl font-extrabold tabular-nums">{correct}</div>
              </div>
              <div className="rounded-[14px] border-neo bg-peach/70 px-2 py-2">
                <div className="text-xs font-bold">❌ 答錯</div>
                <div className="text-2xl font-extrabold tabular-nums">{wrong}</div>
              </div>
              <div className="rounded-[14px] border-neo bg-cream-deep px-2 py-2">
                <div className="text-xs font-bold">⬜ 未作答</div>
                <div className="text-2xl font-extrabold tabular-nums">{unanswered}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 回饋總結 */}
      <section className="rounded-[24px] border-neo bg-card shadow-neo px-5 py-6 sm:px-8 space-y-5">
        <h3 className="text-xl font-extrabold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-coral" />
          給你的回饋
        </h3>

        <div className="space-y-3">
          {levelStats.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between items-center mb-1 gap-2">
                <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                <span className="text-sm font-bold tabular-nums">{s.correct} / {s.total} 題</span>
              </div>
              <div className="h-3 rounded-full border-neo bg-cream overflow-hidden">
                <div
                  className="h-full bg-sage-deep transition-[width] duration-700"
                  style={{ width: `${s.total ? (s.correct / s.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {strengths.length > 0 && (
          <div className="rounded-[16px] border-neo bg-sage/40 px-4 py-3 text-ink">
            <p className="font-extrabold flex items-center gap-1.5">
              <ThumbsUp className="h-4 w-4" /> 你的強項
            </p>
            <p className="mt-1 text-sm sm:text-base">
              {strengths.map((s) => `「${s.label}」`).join('、')}全部答對，繼續保持！
            </p>
          </div>
        )}

        {toImprove.length > 0 && (
          <div className="rounded-[16px] border-neo bg-peach/40 px-4 py-3 text-ink space-y-2">
            <p className="font-extrabold flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> 下次可以這樣做
            </p>
            <ul className="space-y-1.5 text-sm sm:text-base">
              {toImprove.map((s) => (
                <li key={s.key}>
                  <b>{s.label}</b>（{s.correct} / {s.total}）：{LEVEL_TIPS[s.key] ?? '回到文章再讀一次相關段落。'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 每一題的回饋 */}
      <section className="rounded-[24px] border-neo bg-card shadow-neo px-4 py-6 sm:px-8">
        <h3 className="text-xl font-extrabold mb-1">每一題的回饋</h3>
        <p className="text-sm text-muted-foreground mb-4">答錯和沒作答的題目已經幫你打開講解。</p>
        <Accordion type="multiple" defaultValue={openByDefault} className="w-full space-y-2">
          {results.map((r, i) => {
            const status = r.userAnswerIndex === null ? 'skip' : r.isCorrect ? 'ok' : 'bad';
            return (
              <AccordionItem
                key={`end-${i}`}
                value={`end-${i}`}
                className={cn(
                  'rounded-[14px] border-neo overflow-hidden',
                  status === 'ok' && 'bg-sage/20',
                  status === 'bad' && 'bg-peach/25',
                  status === 'skip' && 'bg-cream-deep/60',
                )}
              >
                <AccordionTrigger className="px-4 py-3 text-left hover:no-underline">
                  <span className="flex items-start gap-2 w-full pr-2">
                    {status === 'ok' && <CheckCircle className="h-5 w-5 mt-0.5 shrink-0 text-sage-deep" aria-label="答對" />}
                    {status === 'bad' && <XCircle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" aria-label="答錯" />}
                    {status === 'skip' && <MinusCircle className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" aria-label="未作答" />}
                    <span className="flex-1">
                      <span className="font-extrabold mr-1.5">第 {i + 1} 題</span>
                      <span className="text-sm sm:text-base">{r.questionText}</span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-2 text-sm sm:text-base">
                  <p>
                    <b>你的答案：</b>
                    {r.userAnswerIndex === null ? (
                      <span className="text-muted-foreground">沒有作答</span>
                    ) : (
                      <span className={cn(!r.isCorrect && 'text-destructive line-through')}>
                        {optionLabels[r.userAnswerIndex]}. {r.options[r.userAnswerIndex]}
                      </span>
                    )}
                  </p>
                  {!r.isCorrect && (
                    <p>
                      <b>正確答案：</b>
                      <span className="text-sage-deep font-bold">
                        {optionLabels[r.correctAnswerIndex]}. {r.options[r.correctAnswerIndex]}
                      </span>
                    </p>
                  )}
                  {r.explanation && (
                    <div className="rounded-[12px] border border-dashed border-ink/40 bg-cream px-3 py-2 text-ink whitespace-pre-wrap leading-relaxed">
                      <span className="font-bold">講解：</span>
                      {r.explanation}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>

      {/* 結尾動作 */}
      <section className="rounded-[24px] border-neo bg-cream text-ink shadow-neo px-5 py-5 sm:px-8 text-center space-y-3">
        {submitStatus === 'none' ? (
          <p className="font-bold">現在可以關閉這個頁面了。</p>
        ) : (
          <SubmitStatusBox status={submitStatus} onRetry={onRetrySubmit} />
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={onDownloadPdf} disabled={isPdfBusy} className="border-neo rounded-full">
            {isPdfBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            {isPdfBusy ? '成績單準備中…' : '下載我的成績單（PDF）'}
          </Button>
          <Button onClick={onRestart} disabled={isPdfBusy} className="border-neo rounded-full bg-coral hover:bg-coral text-white shadow-neo-sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            再做一次
          </Button>
        </div>
      </section>
    </div>
  );
}
