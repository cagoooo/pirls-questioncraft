
"use client";

import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { XCircle, CheckCircle2, Trash2, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
const SCALE_STEP = 0.2;

export function FileUpload({ onFilesSelected, isLoading }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedImageForDialog, setSelectedImageForDialog] = useState<string | null>(null);
  const [dialogImageScale, setDialogImageScale] = useState(1);
  
  const imageDisplayAreaRef = useRef<HTMLDivElement>(null); 

  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });


  const processNewFiles = useCallback((newFilesArray: File[]) => {
    if (isLoading) return;

    // Filter out TIFF files and notify user
    const supportedFiles = newFilesArray.filter(file => !file.type.includes('tiff'));
    const tiffFilesCount = newFilesArray.length - supportedFiles.length;

    if (tiffFilesCount > 0) {
        toast({
            title: '不支援的檔案格式',
            description: `偵測到 ${tiffFilesCount} 個 TIFF 檔案。此格式不被支援，請轉換為 JPG, PNG, WEBP 或 HEIC 格式後再試。`,
            variant: 'destructive',
            duration: 7000,
        });
    }
    
    if (supportedFiles.length === 0) {
        if (newFilesArray.length > 0) { // This means all files were filtered out
             // The TIFF toast is already shown
        }
        return;
    }

    const currentFileCount = selectedFiles.length;
    const filesToAdd = supportedFiles.slice(0, 4 - currentFileCount);

    if (supportedFiles.length > filesToAdd.length) {
        toast({
            title: '上傳限制',
            description: `最多只能選擇 4 張圖片。您嘗試加入 ${supportedFiles.length} 張，但只能再加入 ${filesToAdd.length} 張。`,
            variant: 'destructive',
        });
    }
    
    const imageFiles = filesToAdd.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== filesToAdd.length && filesToAdd.length > 0) {
      toast({
        title: '檔案類型錯誤',
        description: '偵測到非圖片檔案，已自動過濾。請僅選擇圖片檔案。',
        variant: 'destructive',
      });
    }

    if (imageFiles.length > 0) {
      setSelectedFiles(prevFiles => {
        const updatedFiles = [...prevFiles, ...imageFiles].slice(0, 4);
        return updatedFiles;
      });
      toast({
          title: '圖片已加入',
          description: `成功加入 ${imageFiles.length} 張圖片。`,
          variant: 'default',
          className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
      });
    } else if (filesToAdd.length > 0) {
        if (!newFilesArray.some(file => file.type.startsWith('image/'))) {
             toast({
                title: '無效檔案',
                description: '您嘗試加入的檔案都不是有效的圖片格式。',
                variant: 'destructive',
            });
        }
    }
  }, [selectedFiles.length, toast, isLoading]);


  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      processNewFiles(filesArray);
      if (event.target) {
        event.target.value = ''; 
      }
    }
  }, [processNewFiles]);

  const handlePaste = useCallback(async (event: ClipboardEvent<Document>) => {
    if (isLoading) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    const newPastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          if (blob.type.includes('tiff')) {
             toast({
                title: '不支援的格式',
                description: '無法貼上 TIFF 圖片。請使用 JPG, PNG 等格式。',
                variant: 'destructive',
             });
             continue; // Skip TIFF files
          }
          const extension = blob.type.split('/')[1] || 'png';
          const fileName = `pasted-image-${Date.now()}.${extension}`;
          const file = new File([blob], fileName, { type: blob.type });
          newPastedFiles.push(file);
        }
      }
    }

    if (newPastedFiles.length > 0) {
        if (selectedFiles.length >= 4) {
            toast({
              title: '上傳已滿',
              description: '已達 4 張圖片上限，無法再貼上。',
              variant: 'destructive',
            });
            return;
        }
      processNewFiles(newPastedFiles);
    }
  }, [isLoading, selectedFiles.length, processNewFiles, toast]);

  useEffect(() => {
    const pasteHandler = (event: Event) => handlePaste(event as ClipboardEvent<Document>);
    document.addEventListener('paste', pasteHandler);
    return () => {
      document.removeEventListener('paste', pasteHandler);
    };
  }, [handlePaste]);

  useEffect(() => {
    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    const oldPreviews = imagePreviews; // Keep a reference to the old previews for cleanup
    
    setImagePreviews(newPreviews);
    onFilesSelected(selectedFiles); 

    // Cleanup previous object URLs that are no longer in use
    return () => {
      oldPreviews.forEach(url => {
        if (!newPreviews.includes(url)) {
          URL.revokeObjectURL(url);
        }
      });
      // If component unmounts or selectedFiles becomes empty, revoke all current newPreviews
      if (newPreviews.length > 0 && selectedFiles.length === 0) { // This condition might need adjustment
        newPreviews.forEach(URL.revokeObjectURL);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, onFilesSelected]);

  const removeImage = (indexToRemove: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== indexToRemove));
  };

  const clearAllImages = () => {
    setSelectedFiles([]);
  };
  
  const canUploadMore = selectedFiles.length < 4;

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isLoading && canUploadMore) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
        return;
    }
    setIsDraggingOver(false);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault(); 
    event.stopPropagation();
    if (!isLoading && canUploadMore && !isDraggingOver) {
        setIsDraggingOver(true); 
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);

    if (isLoading || !canUploadMore) return;

    const files = event.dataTransfer?.files;
    if (files) {
      const filesArray = Array.from(files);
      processNewFiles(filesArray);
    }
  };

  const handleImagePreviewClick = (previewUrl: string) => {
    setSelectedImageForDialog(previewUrl);
    setDialogImageScale(1); 
    setImageOffset({ x: 0, y: 0 });
    setIsPanning(false);
    setIsImageDialogOpen(true);
  };
  
  const handleDialogImageWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    // For debugging: console.log('handleDialogImageWheel triggered. DeltaY:', event.deltaY);
    setDialogImageScale(prevScale => {
      let newScale;
      if (event.deltaY < 0) { 
        newScale = prevScale + SCALE_STEP;
      } else { 
        newScale = prevScale - SCALE_STEP;
      }
      const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
      // For debugging: console.log('Prev scale:', prevScale, 'New scale:', newScale, 'Clamped scale:', clampedScale);
      if (clampedScale === 1) {
        setImageOffset({ x: 0, y: 0 });
      }
      return clampedScale;
    });
  }, [setDialogImageScale, setImageOffset]); 

  const zoomIn = () => setDialogImageScale(s => {
    const newScale = Math.min(s + SCALE_STEP, MAX_SCALE);
    if (newScale === 1) setImageOffset({ x: 0, y: 0 });
    return newScale;
  });
  const zoomOut = () => setDialogImageScale(s => {
    const newScale = Math.max(s - SCALE_STEP, MIN_SCALE);
    if (newScale === 1) setImageOffset({ x: 0, y: 0 });
    return newScale;
  });
  const resetZoom = () => {
    setDialogImageScale(1);
    setImageOffset({ x: 0, y: 0 });
  };

  const handlePanStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (dialogImageScale <= 1) return;
    e.preventDefault(); 
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    panStartRef.current = { x: clientX - imageOffset.x, y: clientY - imageOffset.y };
    setIsPanning(true);
  };

  useEffect(() => {
    const handleGlobalPanMove = (e: MouseEvent | TouchEvent) => {
      if (!isPanning) return;
      if ('touches' in e && e.cancelable) e.preventDefault();

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      setImageOffset({
        x: clientX - panStartRef.current.x,
        y: clientY - panStartRef.current.y,
      });
    };

    const handleGlobalPanEnd = () => {
      setIsPanning(false);
    };

    if (isPanning) {
      window.addEventListener('mousemove', handleGlobalPanMove);
      window.addEventListener('touchmove', handleGlobalPanMove, { passive: false }); 
      window.addEventListener('mouseup', handleGlobalPanEnd);
      window.addEventListener('touchend', handleGlobalPanEnd);
      window.addEventListener('mouseleave', handleGlobalPanEnd); 
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalPanMove);
      window.removeEventListener('touchmove', handleGlobalPanMove);
      window.removeEventListener('mouseup', handleGlobalPanEnd);
      window.removeEventListener('touchend', handleGlobalPanEnd);
      window.removeEventListener('mouseleave', handleGlobalPanEnd);
    };
  }, [isPanning]);


  return (
    <Dialog 
        open={isImageDialogOpen} 
        onOpenChange={(isOpen) => {
            setIsImageDialogOpen(isOpen);
            if (!isOpen) {
                setSelectedImageForDialog(null);
                setDialogImageScale(1); 
                setImageOffset({ x: 0, y: 0 });
                setIsPanning(false);
            }
        }}
    >
      {/* Neo-brutalist 拖放區 — 外層由 page.tsx 的 NeoCard 包，所以這裡不再用 <Card> 殼 */}
      <div className="space-y-5">
        <label
          htmlFor="imageUpload"
          className={cn(
            "flex flex-col items-center justify-center w-full p-12 rounded-[22px] border-neo-dashed transition-colors text-center",
            isLoading && "bg-muted/30 text-muted-foreground cursor-not-allowed",
            !isLoading && !canUploadMore && "bg-sage/30 text-ink cursor-default",
            !isLoading && canUploadMore && (
              isDraggingOver
                ? "bg-peach/40 cursor-copy"
                : "bg-cream cursor-pointer hover:bg-cream-deep"
            )
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin mb-3" />
              <p className="text-sm font-bold">處理中…</p>
            </>
          ) : !canUploadMore ? (
            <>
              <div className="w-[76px] h-[76px] rounded-full bg-sage border-[2px] border-ink flex items-center justify-center text-[38px] mb-4 shadow-neo-sm">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <p className="text-[20px] font-extrabold mb-1">已達上限 (4 張)</p>
              <p className="text-sm text-muted-foreground">您可以清除部分圖片後再試</p>
            </>
          ) : (
            <>
              <div className="w-[76px] h-[76px] rounded-full bg-peach border-[2px] border-ink flex items-center justify-center text-[38px] mb-4 shadow-neo-sm">
                📷
              </div>
              <p className="text-[20px] font-extrabold mb-1">
                {isDraggingOver ? '放開即可上傳' : '拖曳圖片到這裡'}
              </p>
              <p className="text-sm text-muted-foreground">
                或點擊選擇 1–4 張（JPG · PNG · HEIC · WEBP）
              </p>
            </>
          )}

          {/* 4 格預覽（永遠顯示，未上傳時顯示 dashed 編號 1-4） */}
          <div className="flex gap-3 justify-center mt-7 flex-wrap">
            {[0, 1, 2, 3].map(i => {
              const hasFile = !!selectedFiles[i];
              return (
                <div
                  key={i}
                  className={cn(
                    'w-16 h-16 rounded-[14px] flex items-center justify-center text-[11px] overflow-hidden relative bg-card',
                    hasFile
                      ? 'border-[1.5px] border-ink'
                      : 'border-[1.5px] border-dashed border-ink text-muted-foreground'
                  )}
                >
                  {hasFile ? (
                    <Image
                      src={imagePreviews[i]}
                      alt={`預覽 ${selectedFiles[i].name}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="font-extrabold">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        </label>

        <Input
          id="imageUpload"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={handleFileChange}
          disabled={isLoading || !canUploadMore}
          className="sr-only"
        />

        {/* 已上傳的大預覽（可放大、刪除） */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-ink">已選圖片預覽：</h3>
              <span className="text-xs text-muted-foreground font-mono">{selectedFiles.length}/4</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {imagePreviews.map((previewUrl, index) => (
                <DialogTrigger asChild key={previewUrl}>
                  <div
                    className="relative group aspect-square cursor-pointer rounded-[14px] overflow-hidden border-neo shadow-neo-sm hover:shadow-neo transition-all"
                    onClick={() => handleImagePreviewClick(previewUrl)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleImagePreviewClick(previewUrl);
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`放大檢視圖片 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                  >
                    <Image
                      src={previewUrl}
                      alt={`預覽 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                      data-ai-hint="document scan"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 border-[1.5px] border-ink"
                      onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                      disabled={isLoading}
                      aria-label={`移除圖片 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogTrigger>
              ))}
            </div>
            <button
              onClick={clearAllImages}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 border-neo rounded-full px-4 py-2.5 text-sm font-bold bg-card hover:bg-cream-deep shadow-neo-sm hover:shadow-neo transition-all disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              清除所有已選圖片
            </button>
          </div>
        )}
      </div>

      <DialogContent 
        className="sm:max-w-2xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl w-auto p-2 bg-background/95 backdrop-blur-sm"
      >
        <DialogTitle className="sr-only">放大的圖片預覽</DialogTitle>
        <DialogDescription className="sr-only">詳細檢視上傳的圖片內容，可使用按鈕或滑鼠滾輪進行縮放，以及拖曳平移圖片。</DialogDescription>
        {selectedImageForDialog && (
          <div 
            ref={imageDisplayAreaRef}
            className="relative w-full h-full flex justify-center items-center overflow-hidden"
            onWheel={handleDialogImageWheel} 
          >
            <Image
              src={selectedImageForDialog}
              alt="放大的圖片預覽"
              width={1200} 
              height={800}
              style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                  maxHeight: 'calc(85vh - 2rem - 40px)', 
                  objectFit: 'contain',
                  transform: `scale(${dialogImageScale}) translate(${imageOffset.x}px, ${imageOffset.y}px)`,
                  cursor: isPanning ? 'grabbing' : (dialogImageScale > 1 ? 'grab' : 'default'),
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                  userSelect: 'none',
                  touchAction: dialogImageScale > 1 ? 'none' : 'auto',
              }}
              className="rounded-md shadow-xl"
              data-ai-hint="document scan enlarged"
              onMouseDown={handlePanStart}
              onTouchStart={handlePanStart}
              draggable="false"
            />
          </div>
        )}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 sm:bottom-4 sm:gap-2 sm:p-2 bg-background/80 rounded-lg shadow-md">
            <Button variant="outline" size="icon" onClick={zoomOut} aria-label="縮小">
                <ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={resetZoom} aria-label="重設縮放">
                <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="outline" size="icon" onClick={zoomIn} aria-label="放大">
                <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    
