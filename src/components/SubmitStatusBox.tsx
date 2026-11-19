// src/components/SubmitStatusBox.tsx
// v0.3.9：交卷後清楚告訴學生「成績有沒有送到老師那裡」。
// 送不出去時不再假裝成功：顯示「再送一次」按鈕，並提醒舉手告訴老師。

import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SubmitStatus = 'none' | 'sending' | 'sent' | 'failed' | 'expired';

export function SubmitStatusBox({
  status,
  onRetry,
  className,
}: {
  status: SubmitStatus;
  onRetry: () => void;
  className?: string;
}) {
  if (status === 'none') return null;
  if (status === 'sending') {
    return (
      <div role="status" className={cn('rounded-2xl border-neo bg-lemon text-ink px-4 py-3 font-bold flex items-center justify-center gap-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
        正在把你的作答送給老師…請先不要關掉這個頁面
      </div>
    );
  }
  if (status === 'sent') {
    return (
      <div role="status" className={cn('rounded-2xl border-neo bg-cream text-ink px-4 py-3 font-bold text-center', className)}>
        ✅ 你的作答已經送給老師，現在可以關閉這個頁面了。
      </div>
    );
  }
  if (status === 'expired') {
    return (
      <div role="alert" className={cn('rounded-2xl border-neo bg-coral/15 text-ink px-4 py-3 text-center space-y-1', className)}>
        <p className="font-bold">⚠️ 這份測驗已經結束收件，作答沒有送到老師那裡。</p>
        <p className="text-sm">請舉手告訴老師，也可以先下載成績單留下紀錄。</p>
      </div>
    );
  }
  return (
    <div role="alert" className={cn('rounded-2xl border-neo bg-coral/15 text-ink px-4 py-3 text-center space-y-2', className)}>
      <p className="font-bold">⚠️ 你的作答還沒送到老師那裡</p>
      <p className="text-sm">請確認網路，再按「再送一次」。如果一直送不出去，請舉手告訴老師。</p>
      <Button onClick={onRetry} className="border-neo rounded-full bg-coral hover:bg-coral text-white shadow-neo-sm">
        <RefreshCw className="mr-2 h-4 w-4" />
        再送一次
      </Button>
    </div>
  );
}
