// src/components/ShareDialog.tsx
// B.8 重構：從 page.tsx 抽出來的「分享測驗」Dialog（含 QR + 連結 + 老師端儀表板入口）
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Share2, Copy, AlertTriangle, BarChart3, ExternalLink } from 'lucide-react';

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 點開「分享測驗」trigger 按鈕時要做的事（生成連結） */
  onShareClick: () => void;
  /** 點「複製」按鈕 */
  onCopyClick: () => void;
  /** trigger 按鈕的 disabled 狀態（含其他正在進行的工作） */
  triggerDisabled: boolean;
  /** 是否正在生成連結（dialog 內顯示 spinner） */
  isSharingQuiz: boolean;
  /** 已生成的分享連結（包含 ?id=xxx） */
  currentShareLink: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  onShareClick,
  onCopyClick,
  triggerDisabled,
  isSharingQuiz,
  currentShareLink,
}: ShareDialogProps) {
  // 從分享連結拆出 quizId 組老師端儀表板 URL
  let dashboardUrl: string | null = null;
  try {
    if (currentShareLink) {
      const u = new URL(currentShareLink);
      const id = u.searchParams.get('id');
      if (id) {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        dashboardUrl = `${u.origin}${basePath}/dashboard/?id=${id}`;
      }
    }
  } catch {
    /* ignore parse error */
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          onClick={onShareClick}
          disabled={triggerDisabled}
          variant="outline"
          className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          {isSharingQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
          {isSharingQuiz ? '處理中...' : '分享測驗'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享您的測驗</DialogTitle>
          <DialogDescription>
            透過以下臨時連結或 QR Code 分享此測驗給學生。學生交卷後，您可在「老師端儀表板」看到即時班級成績。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isSharingQuiz && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="ml-2 text-muted-foreground">正在生成臨時分享連結...</p>
            </div>
          )}
          {!isSharingQuiz && currentShareLink && (
            <>
              <div className="space-y-1">
                <label htmlFor="share-link" className="text-sm font-medium">
                  臨時分享連結
                </label>
                <div className="flex items-center space-x-2">
                  <Input id="share-link" value={currentShareLink} readOnly className="flex-1" />
                  <Button type="button" size="sm" onClick={onCopyClick}>
                    <Copy className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">複製</span>
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">QR Code</label>
                <div className="flex items-center justify-center p-4 border rounded-md bg-muted">
                  <QRCodeSVG value={currentShareLink} size={192} bgColor="#ffffff" fgColor="#000000" level="L" includeMargin={false} />
                </div>
              </div>
              {dashboardUrl && (
                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" /> 老師端儀表板
                  </label>
                  <p className="text-xs text-muted-foreground">
                    學生作答後，可在此頁查看班級成績分布、各題答對率、PIRLS 四層次平均
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(dashboardUrl!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    開啟儀表板
                  </Button>
                </div>
              )}
            </>
          )}
          {!isSharingQuiz && !currentShareLink && (
            <p className="text-sm text-muted-foreground text-center py-2">
              點擊「分享測驗」按鈕以生成連結和 QR Code。
            </p>
          )}
          <Alert variant="default" className="bg-yellow-50 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-300">提示：1 小時後失效</AlertTitle>
            <AlertDescription className="text-sm text-yellow-600 dark:text-yellow-500">
              連結與 QR Code 約在生成後 <strong>60 分鐘失效</strong>（Firestore TTL 自動清除）。
              請於有效期內讓學生完成作答。學生作答資料會保留 7 天供老師端查看儀表板。
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSharingQuiz}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
