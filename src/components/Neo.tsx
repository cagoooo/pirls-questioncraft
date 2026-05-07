"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 日式教育派 / Neo-brutalist 共用元件。
 * 邊框 1.5px ink 黑、offset 陰影 0 4px 0 ink，hover 拉長、按下壓進去。
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

interface NeoCardProps extends DivProps {
  /** hover 時抬升並拉長陰影 */
  hoverable?: boolean;
  /** 預設 4px offset；可換 sm/lg/xl */
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
}

const shadowMap = {
  sm: 'shadow-neo-sm',
  md: 'shadow-neo',
  lg: 'shadow-neo-lg',
  xl: 'shadow-neo-xl',
};

export const NeoCard = React.forwardRef<HTMLDivElement, NeoCardProps>(
  ({ className, hoverable = false, shadow = 'lg', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-card border-neo rounded-[24px] text-card-foreground',
          shadowMap[shadow],
          hoverable && 'neo-hover-lift cursor-pointer',
          className
        )}
        {...props}
      />
    );
  }
);
NeoCard.displayName = 'NeoCard';

/**
 * 圓角 Pill 按鈕：1.5px 黑邊 + offset 陰影，按下會壓回去。
 * color 直接傳 tailwind class（如 "bg-peach"、"bg-sage"），未指定時用 bg-card。
 */
interface PillBtnProps extends BtnProps {
  color?: string;       // 例如 'bg-peach' / 'bg-sage'，預設 'bg-card'
  dark?: boolean;       // 反轉成 ink 黑底奶油字
  sm?: boolean;
}

export const PillBtn = React.forwardRef<HTMLButtonElement, PillBtnProps>(
  ({ className, color = 'bg-card', dark, sm, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={props.type ?? 'button'}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap',
          'border-neo rounded-full font-bold',
          'shadow-neo-sm neo-press',
          'hover:-translate-y-px hover:shadow-neo',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-neo-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          sm ? 'px-3.5 py-2 text-[13px]' : 'px-[18px] py-[11px] text-sm',
          dark ? 'bg-ink text-cream' : color,
          dark ? '' : 'text-ink',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
PillBtn.displayName = 'PillBtn';

/* === 手繪裝飾 SVG === */

interface DecoProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Star({ size = 24, color = '#3D2E1E', className, style }: DecoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      <path
        d="M12 2 L14 9 L21 10 L16 15 L17 22 L12 18 L7 22 L8 15 L3 10 L10 9 Z"
        fill={color}
        stroke="#3D2E1E"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Squiggle({ color = '#E89B7B', className, style }: DecoProps) {
  return (
    <svg width="80" height="14" viewBox="0 0 80 14" className={className} style={style}>
      <path
        d="M2 7 Q 12 1, 22 7 T 42 7 T 62 7 T 78 7"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Spark({ size = 18, color = '#3D2E1E', className, style }: DecoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      <path
        d="M12 1 L13 11 L23 12 L13 13 L12 23 L11 13 L1 12 L11 11 Z"
        fill={color}
      />
    </svg>
  );
}

/** PIRLS 四層次 → 顏色 / emoji / 標籤 對照 */
export const PIRLS_LEVEL_META = {
  'locate & retrieve':                { label: '訊息提取', short: 'L1', emoji: '🔍', bg: 'bg-sky',   borderClass: 'border-sky-deep'   },
  'make straightforward inferences':  { label: '直接推論', short: 'L2', emoji: '💡', bg: 'bg-sage',  borderClass: 'border-sage-deep'  },
  'interpret & integrate':            { label: '詮釋整合', short: 'L3', emoji: '🧩', bg: 'bg-lemon', borderClass: 'border-amber-500' },
  'evaluate & critique':              { label: '評估批判', short: 'L4', emoji: '⚖️', bg: 'bg-rose',  borderClass: 'border-rose-400'   },
} as const;

export type PirlsLevel = keyof typeof PIRLS_LEVEL_META;
