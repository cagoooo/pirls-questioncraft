"use client";

import type { GeneratePirlsQuestionsOutput } from '@/lib/api';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { ChevronDown } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import { PIRLS_LEVEL_META, type PirlsLevel } from '@/components/Neo';

type PirlsQuestion = GeneratePirlsQuestionsOutput['questions'][0];

interface QuestionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  questionItem: PirlsQuestion;
  questionNumber: number;
}

const optionLabels = ['A', 'B', 'C', 'D'];

export function QuestionCard({ questionItem, questionNumber, className, style, ...props }: QuestionCardProps) {
  const meta = PIRLS_LEVEL_META[questionItem.pirlsLevel as PirlsLevel];

  return (
    <AccordionItem
      value={`item-${questionNumber}`}
      className={cn('border-0 bg-card border-neo rounded-[22px] shadow-neo overflow-hidden', className)}
      style={style}
      {...props}
    >
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
          className={cn(
            'group flex flex-1 items-start gap-4 p-5 text-left',
            'hover:bg-cream/40 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          {/* 左側彩色編號 */}
          <div
            className={cn(
              'shrink-0 w-11 h-11 rounded-xl border-neo flex flex-col items-center justify-center font-mono font-extrabold',
              meta.bg
            )}
          >
            <div className="text-[9px] opacity-70 leading-none">Q</div>
            <div className="text-[17px] leading-none mt-0.5">{questionNumber}</div>
          </div>

          {/* 中段：層次徽章 + 題幹 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 border-neo rounded-full px-2.5 py-0.5 text-[11px] font-extrabold', meta.bg)}>
                <span>{meta.emoji}</span> {meta.label}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground border border-line rounded-full px-2 py-0.5">
                PIRLS · {meta.short}
              </span>
            </div>
            <div className="text-[15px] sm:text-base leading-[1.55] font-semibold text-ink">
              {questionItem.question}
            </div>
          </div>

          {/* 右側收合箭頭 — 開啟時旋轉 */}
          <div className="shrink-0 w-8 h-8 rounded-full bg-cream border-neo flex items-center justify-center text-sm font-extrabold transition-transform duration-200 group-data-[state=open]:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </div>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>

      <AccordionContent className="px-5 sm:pl-[82px] pb-5 sm:pr-5 pt-0">
        {/* 選項 */}
        <div className="flex flex-col gap-2 mb-4">
          {questionItem.options.map((option, i) => {
            const isCorrect = i === questionItem.correctAnswerIndex;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 px-3.5 py-3 rounded-[14px] text-sm leading-[1.55]',
                  isCorrect
                    ? 'bg-sage/30 border-[2px] border-sage-deep'
                    : 'bg-cream border-[1.5px] border-line'
                )}
              >
                <div
                  className={cn(
                    'shrink-0 w-[26px] h-[26px] rounded-full border-neo flex items-center justify-center font-extrabold text-xs',
                    isCorrect ? 'bg-sage-deep text-white' : 'bg-card text-ink'
                  )}
                >
                  {isCorrect ? '✓' : optionLabels[i]}
                </div>
                <div className="flex-1 text-ink">{option}</div>
              </div>
            );
          })}
        </div>

        {/* 黃色解析框 */}
        <div className="bg-lemon/55 border-neo rounded-[14px] px-4 py-3.5">
          <div className="text-xs font-extrabold mb-1 flex items-center gap-1.5">
            <span>💡</span> 解析說明
          </div>
          <div className="text-sm leading-[1.7] text-ink-soft whitespace-pre-wrap">
            {questionItem.explanation}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
