
"use client";

import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { XCircle, ImagePlus, UploadCloud, CheckCircle2, Trash2, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
      <Card className="w-full bg-accent/10 dark:bg-accent/20">
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <ImagePlus className="h-6 w-6 text-primary" />
            上傳圖片
          </CardTitle>
          <CardDescription>請選擇 1 至 4 張圖片（建議使用 JPG, PNG, WEBP, HEIC），或直接貼上螢幕截圖。</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-4 sm:p-6 sm:pt-6">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="imageUpload"
                className={cn(
                  "flex flex-col items-center justify-center w-full h-32 sm:h-40 p-4 rounded-lg border-2 border-dashed transition-colors",
                  isLoading && "bg-muted/30 border-muted-foreground/20 text-muted-foreground cursor-not-allowed",
                  !isLoading && !canUploadMore && "border-green-500/50 bg-green-500/5 text-green-700 cursor-default", // Full state
                  !isLoading && canUploadMore && (
                    isDraggingOver 
                      ? "border-primary bg-primary/20 ring-2 ring-primary ring-offset-2" // Dragging over
                      : "cursor-pointer border-primary/50 bg-background hover:border-primary hover:bg-primary/5 text-foreground" // Default active, can drop
                  )
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
                    <p className="text-sm font-medium">處理中...</p>
                  </>
                ) : !canUploadMore ? (
                   <>
                    <CheckCircle2 className="w-10 h-10 text-green-600 mb-2" />
                    <p className="text-sm font-medium text-green-700">已達圖片上傳上限 (4張)</p>
                    <p className="text-xs text-muted-foreground mt-1">您可以清除部分圖片後再試</p>
                  </>
                ) : isDraggingOver ? (
                  <>
                    <UploadCloud className="w-10 h-10 text-primary/80 mb-2" />
                    <p className="text-sm font-medium text-primary">放開以加入圖片</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      還可選 {4 - selectedFiles.length} 張圖片
                    </p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-10 h-10 text-primary/80 mb-2" />
                    <p className="text-sm font-medium text-center">
                      點擊此處或拖曳圖片至此上傳（或截圖貼上）
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      已選 {selectedFiles.length}/4 張圖片
                    </p>
                  </>
                )}
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
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base sm:text-md font-semibold text-foreground">已選圖片預覽：</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {imagePreviews.map((previewUrl, index) => (
                    <DialogTrigger asChild key={previewUrl}>
                      <div
                        className="relative group aspect-square cursor-pointer"
                        onClick={() => handleImagePreviewClick(previewUrl)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleImagePreviewClick(previewUrl);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`放大檢視圖片 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                      >
                        <Image
                          src={previewUrl}
                          alt={`預覽 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                          fill={true}
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="rounded-md border object-cover"
                          data-ai-hint="document scan"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
                          onClick={(e) => {
                            e.stopPropagation(); 
                            removeImage(index);
                          }}
                          disabled={isLoading}
                          aria-label={`移除圖片 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </DialogTrigger>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={clearAllImages}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  清除所有已選圖片
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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

    
