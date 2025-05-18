
"use client";

import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, ImagePlus, UploadCloud, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

export function FileUpload({ onFilesSelected, isLoading }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { toast } = useToast();
  const previewsSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for the file input

  // Common function to process new files (from click, paste, or drop)
  const processNewFiles = useCallback((newFilesArray: File[]) => {
    if (isLoading) return; // Should ideally be checked by callers

    const currentFileCount = selectedFiles.length;
    const filesToAdd = newFilesArray.slice(0, 4 - currentFileCount); // Only take files up to the limit

    if (newFilesArray.length > filesToAdd.length) {
        toast({
            title: '上傳限制',
            description: `最多只能選擇 4 張圖片。您嘗試加入 ${newFilesArray.length} 張，但只能再加入 ${filesToAdd.length} 張。`,
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
        const updatedFiles = [...prevFiles, ...imageFiles].slice(0, 4); // Ensure not to exceed 4
        return updatedFiles;
      });
      toast({
          title: '圖片已加入',
          description: `成功加入 ${imageFiles.length} 張圖片。`,
          variant: 'default',
          className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
      });
    } else if (filesToAdd.length > 0) {
        // This means files were attempted but none were valid images or fit
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
      // Reset file input value to allow selecting the same file again
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

  // Update image previews and call onFilesSelected when selectedFiles changes
  useEffect(() => {
    // Revoke old object URLs to prevent memory leaks
    const oldPreviews = [...imagePreviews]; // Create a copy
    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
    
    onFilesSelected(selectedFiles); // Inform parent component

    // Cleanup function
    return () => {
      oldPreviews.forEach(url => URL.revokeObjectURL(url)); // Revoke old ones
      // Also revoke the new ones if the component unmounts or selectedFiles changes again before these newPreviews become "old"
      newPreviews.forEach(url => URL.revokeObjectURL(url)); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles, onFilesSelected]); 


  const removeImage = (index: number) => {
    const urlToRevoke = imagePreviews[index];
    if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
    }
    // Update previews first to ensure the correct one is removed from state before revoking its URL
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    imagePreviews.forEach(url => URL.revokeObjectURL(url)); // Revoke all current previews
    setImagePreviews([]);
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
    // Check if the leave target is outside the dropzone
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
        return;
    }
    setIsDraggingOver(false);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault(); // Necessary to allow drop
    event.stopPropagation();
    if (!isLoading && canUploadMore && !isDraggingOver) {
        setIsDraggingOver(true); // Ensure isDraggingOver is set if it wasn't by DragEnter
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


  return (
    <Card className="w-full bg-muted dark:bg-muted/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-6 w-6 text-primary" />
          上傳圖片
        </CardTitle>
        <CardDescription>請選擇 1 至 4 張包含文字的圖片（例如：JPG, PNG），或截圖貼上圖片。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label
              htmlFor="imageUpload"
              className={cn(
                "flex flex-col items-center justify-center w-full h-40 p-4 rounded-lg border-2 border-dashed transition-colors",
                // Disabled states (loading or no more uploads allowed)
                (isLoading || (!canUploadMore && !isDraggingOver)) && 
                  (!canUploadMore && !isLoading && !isDraggingOver 
                    ? "border-accent bg-accent/10 text-accent-foreground" // Max files reached, not loading, not dragging
                    : "bg-muted/50 border-muted-foreground/30 text-muted-foreground"),
                (isLoading || !canUploadMore) && "cursor-not-allowed",
                
                // Enabled states
                !isLoading && canUploadMore && (
                  isDraggingOver 
                    ? "border-primary bg-primary/20 ring-2 ring-primary ring-offset-2" // Dragging over
                    : "cursor-pointer hover:border-primary/80 border-primary/50 bg-primary/10 hover:bg-primary/20 text-foreground" // Default enabled
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
                  <CheckCircle2 className="w-10 h-10 text-accent mb-2" />
                  <p className="text-sm font-medium">已達圖片上傳上限 (4張)</p>
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
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={isLoading || !canUploadMore}
              className="sr-only"
            />
          </div>

          {selectedFiles.length > 0 && (
            <div ref={previewsSectionRef} className="space-y-4">
              <h3 className="text-md font-semibold text-foreground">已選圖片預覽：</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {imagePreviews.map((previewUrl, index) => (
                  <div key={previewUrl} className="relative group aspect-square">
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
                      onClick={() => removeImage(index)}
                      disabled={isLoading}
                      aria-label={`移除圖片 ${selectedFiles[index]?.name || `圖片 ${index + 1}`}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
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
  );
}
