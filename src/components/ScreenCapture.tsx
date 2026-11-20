// src/components/ScreenCapture.tsx
// v0.4.2：直接擷取 Chrome 分頁或視窗的畫面當出題素材，擷取後可以框選要的範圍，或用整張。
// 用瀏覽器內建的「分享畫面」功能（getDisplayMedia）只抓一張畫面就立刻停止分享，不錄影、不上傳到別處。
// 手機、平板的瀏覽器不支援，這時按鈕不顯示。
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MonitorUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 這個瀏覽器能不能擷取分頁／視窗（電腦版 Chrome、Edge、Firefox 可以；手機平板不行） */
export function canCaptureScreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') return false;
  const ua = navigator.userAgent || '';
  const mobile = (navigator as any).userAgentData?.mobile === true || /Android|iPhone|iPad|iPod/i.test(ua);
  return !mobile;
}

/** 請使用者選分頁／視窗，抓下一張畫面後立刻停止分享 */
export async function grabScreenFrame(): Promise<HTMLCanvasElement> {
  const CaptureControllerCtor = (window as any).CaptureController;
  const controller = CaptureControllerCtor ? new CaptureControllerCtor() : undefined;
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 5 },
    audio: false,
    // 選單先列出 Chrome 分頁；不列出出題網站自己這一頁
    preferCurrentTab: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    ...(controller ? { controller } : {}),
  } as any);
  // 選好分頁後 Chrome 預設會跳到那個分頁；請它留在出題網站，老師才看得到框選畫面
  try { controller?.setFocusBehavior?.('no-focus-change'); } catch { /* 舊版 Chrome 沒有這個功能 */ }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      if ('requestVideoFrameCallback' in video) (video as any).requestVideoFrameCallback(() => done());
      else setTimeout(done, 300);
      setTimeout(done, 1500); // 保險：畫面一直沒更新也不要卡住
    });
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('沒有抓到畫面，請再試一次。');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
    return canvas;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}

interface Rect { x: number; y: number; w: number; h: number }

/** 把框選範圍（以顯示大小計）換算成原圖像素並裁切，輸出 PNG 檔 */
export function cropToFile(canvas: HTMLCanvasElement, sel: Rect | null, shownW: number, shownH: number): Promise<File> {
  const sx = sel ? canvas.width / shownW : 1;
  const sy = sel ? canvas.height / shownH : 1;
  const x = sel ? Math.max(0, Math.round(sel.x * sx)) : 0;
  const y = sel ? Math.max(0, Math.round(sel.y * sy)) : 0;
  const w = sel ? Math.min(canvas.width - x, Math.round(sel.w * sx)) : canvas.width;
  const h = sel ? Math.min(canvas.height - y, Math.round(sel.h * sy)) : canvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  const now = new Date();
  const stamp = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (!blob) { reject(new Error('圖片轉換失敗，請再試一次。')); return; }
      resolve(new File([blob], `螢幕擷取-${stamp}.png`, { type: 'image/png' }));
    }, 'image/png');
  });
}

const MIN_SEL = 16; // 框太小（只是點一下）就當作沒框

export function ScreenCaptureButton({
  disabled,
  onCaptured,
  onError,
}: {
  disabled?: boolean;
  onCaptured: (file: File) => void;
  onError: (message: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(canCaptureScreen()), []);

  const [busy, setBusy] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [sel, setSel] = useState<Rect | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const close = useCallback(() => {
    setCanvas(null);
    setSel(null);
    setImgUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
  }, []);

  const startCapture = useCallback(async () => {
    setBusy(true);
    try {
      const c = await grabScreenFrame();
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
      if (!blob) throw new Error('圖片轉換失敗，請再試一次。');
      setImgUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(blob); });
      setSel(null);
      setCanvas(c);
    } catch (e: any) {
      // 老師在選單按「取消」：不算錯誤，安靜結束
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
        onError(e?.message || '無法擷取畫面，請再試一次，或改用螢幕截圖後貼上（Ctrl＋V）。');
      }
    } finally {
      setBusy(false);
    }
  }, [onError]);

  const pointFromEvent = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!imgRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    dragRef.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const start = dragRef.current;
    if (!start || !imgRef.current) return;
    const p = pointFromEvent(e);
    setSel({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
    setSel((s) => (s && s.w >= MIN_SEL && s.h >= MIN_SEL ? s : null));
  };

  const finish = async (useSelection: boolean) => {
    if (!canvas || !imgRef.current) return;
    setSaving(true);
    try {
      const r = imgRef.current.getBoundingClientRect();
      const file = await cropToFile(canvas, useSelection ? sel : null, r.width, r.height);
      onCaptured(file);
      close();
    } catch (e: any) {
      onError(e?.message || '圖片轉換失敗，請再試一次。');
    } finally {
      setSaving(false);
    }
  };

  if (!supported) return null;

  const hasSel = !!sel && sel.w >= MIN_SEL && sel.h >= MIN_SEL;
  const btn = 'inline-flex items-center justify-center gap-2 border-neo rounded-full font-extrabold shadow-neo-sm neo-press hover:-translate-y-px hover:shadow-neo px-5 py-2.5 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0';

  return (
    <>
      <button
        type="button"
        onClick={startCapture}
        disabled={disabled || busy}
        className={cn(btn, 'w-full bg-sky text-ink')}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MonitorUp className="h-5 w-5" />}
        {busy ? '請在跳出的視窗選擇要擷取的分頁或視窗…' : '擷取 Chrome 分頁／視窗畫面'}
      </button>

      <Dialog open={!!canvas} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="w-[96vw] max-w-6xl p-4 sm:p-6 gap-3">
          <DialogTitle className="text-xl font-extrabold">框選要出題的範圍</DialogTitle>
          <DialogDescription className="text-base text-ink/80">
            在畫面上<b>按住滑鼠拖曳</b>，框出文章的部分；不框選也可以直接用整張。
          </DialogDescription>
          {imgUrl && (
            <div className="flex justify-center overflow-auto max-h-[62vh] rounded-[14px] border-[1.5px] border-ink bg-muted/40">
              <div
                className="relative inline-block cursor-crosshair select-none touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                data-testid="capture-area"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imgUrl}
                  alt="剛剛擷取的畫面"
                  draggable={false}
                  className="block max-w-full max-h-[60vh] w-auto h-auto"
                />
                {sel && sel.w > 0 && sel.h > 0 && (
                  <div
                    className="absolute border-2 border-coral pointer-events-none"
                    style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, boxShadow: '0 0 0 9999px rgba(30,20,10,0.45)' }}
                  />
                )}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
            <button type="button" onClick={close} className={cn(btn, 'bg-card text-ink')} disabled={saving}>取消</button>
            <button type="button" onClick={() => { close(); void startCapture(); }} className={cn(btn, 'bg-card text-ink')} disabled={saving}>
              🔄 重新擷取
            </button>
            <button type="button" onClick={() => finish(false)} className={cn(btn, 'bg-lemon text-ink')} disabled={saving}>
              🖼️ 使用整張畫面
            </button>
            <button type="button" onClick={() => finish(true)} className={cn(btn, 'bg-coral text-white')} disabled={saving || !hasSel}>
              ✂️ 使用框選範圍
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
