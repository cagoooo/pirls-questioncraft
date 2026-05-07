"use client";

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PillBtn } from '@/components/Neo';
import { BookOpen, X, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 操作使用步驟 Dialog — 老師第一次上手用。
 * 5 步驟分卡 + 3 條小提示，全部 Neo-brutalist 殼。
 */

interface Step {
  emoji: string;
  title: string;
  desc: string;
  /** 步驟主色：bg-peach / bg-sage / bg-sky / bg-lemon / bg-rose */
  color: string;
}

const STEPS: Step[] = [
  {
    emoji: '📷',
    title: '提供素材',
    desc: '上傳 1-4 張教材圖片（拍黑板、課本、講義都行），或直接把一段文章貼到「貼上文本」分頁。',
    color: 'bg-peach',
  },
  {
    emoji: '⚙️',
    title: '選擇規格',
    desc: '題組數量挑「標準 8 題（四層次各 2 題）」或「延伸 10 題（加強提取與推論）」；題目語言可選繁中或英文。',
    color: 'bg-sage',
  },
  {
    emoji: '🚀',
    title: '一鍵生成',
    desc: '點珊瑚紅大按鈕「開始生成 PIRLS 四層次題目」，AI 約 15-25 秒會把題目、選項、解析全寫好。',
    color: 'bg-sky',
  },
  {
    emoji: '📋',
    title: '檢視題目',
    desc: '結果頁可看到 PIRLS 四層次分布（提取／推論／詮釋／評估），逐題展開能看到正解（綠底 ✓）與解析說明（黃框）。',
    color: 'bg-lemon',
  },
  {
    emoji: '💾',
    title: '匯出 / 分享',
    desc: '一鍵匯出 PDF、Loilonote、PaGamO（兩種格式）；或產生「線上測驗連結」給學生作答，老師端能即時看到全班成績。',
    color: 'bg-rose',
  },
];

const TIPS = [
  '📸 圖片清晰最重要 — 避免太斜、太暗或反光，文字看得清楚 AI 才認得出。',
  '📝 文章建議 200–1000 字，太短層次題目會做不滿，太長 AI 會抓重點抓得鬆散。',
  '🛡️ 中間那個「我不是機器人」的小框是 Cloudflare Turnstile，防止有人惡意刷光配額。',
  '🔗 線上測驗連結預設 1 小時後失效（避免長期暴露），學生作答資料保留 7 天供老師查看。',
];

interface HelpDialogProps {
  /** 自訂觸發按鈕；不傳則用預設 lemon「📖 使用說明」 */
  trigger?: React.ReactNode;
}

export function HelpDialog({ trigger }: HelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <PillBtn color="bg-lemon" sm aria-label="開啟使用說明">
            <BookOpen className="h-4 w-4" />
            <span className="font-extrabold">使用說明</span>
          </PillBtn>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          'max-w-2xl max-h-[88vh] overflow-y-auto',
          'border-neo shadow-neo-lg rounded-[24px] bg-card',
          'p-6 sm:p-7'
        )}
      >
        <DialogHeader className="space-y-2 text-left">
          <div className="inline-flex w-fit items-center gap-2 bg-cream border-neo rounded-full px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.15em]">
            <BookOpen className="h-3.5 w-3.5" />
            Quick Start
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            5 步驟，把任何文章變成 PIRLS 題組
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft leading-[1.7]">
            這是給第一次使用的老師看的快速上手指南。每步都有對應的網頁區塊，跟著做就行。
          </DialogDescription>
        </DialogHeader>

        {/* 5 步驟 */}
        <div className="mt-5 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex gap-3.5 items-start bg-cream border-neo rounded-[16px] p-4 shadow-neo-sm"
            >
              {/* 左側 emoji 圓角方塊 + 編號 */}
              <div
                className={cn(
                  'shrink-0 w-12 h-12 rounded-xl border-neo flex flex-col items-center justify-center',
                  s.color
                )}
              >
                <div className="text-[8px] font-mono font-bold opacity-70 leading-none">STEP</div>
                <div className="text-base font-extrabold leading-none mt-0.5">{i + 1}</div>
              </div>
              {/* 內容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-extrabold text-base">
                  <span aria-hidden>{s.emoji}</span>
                  {s.title}
                </div>
                <p className="text-[13.5px] leading-[1.7] text-ink-soft mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 小提示 */}
        <div className="mt-5 bg-lemon/40 border-neo rounded-[16px] p-4 shadow-neo-sm">
          <div className="flex items-center gap-1.5 font-extrabold text-sm mb-2">
            <Lightbulb className="h-4 w-4" />
            老師小提示
          </div>
          <ul className="space-y-1.5">
            {TIPS.map((t, i) => (
              <li key={i} className="text-[13px] leading-[1.7] text-ink-soft">
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-[12px] text-muted-foreground text-center">
          有問題或建議？右上角的「💬 使用回饋 ⭐⭐⭐」歡迎告訴阿凱老師。
        </p>
      </DialogContent>
    </Dialog>
  );
}
