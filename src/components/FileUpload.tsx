
"use client";

import type { ChangeEvent, ClipboardEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, ImagePlus, UploadCloud, CheckCircle2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
}

export function FileUpload({ onFilesSelected, isLoading }: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { toast } = useToast();

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      const totalAfterAdding = selectedFiles.length + filesArray.length;

      if (totalAfterAdding > 4) {
        toast({
          title: '上傳錯誤',
          description: `最多只能選擇 4 張圖片。您已選擇 ${selectedFiles.length} 張，嘗試再加入 ${filesArray.length} 張。`,
          variant: 'destructive',
        });
        event.target.value = ''; 
        return;
      }
      
      const imageFiles = filesArray.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length !== filesArray.length) {
        toast({
          title: '檔案類型錯誤',
          description: '偵測到非圖片檔案，已自動過濾。請僅選擇圖片檔案。',
          variant: 'destructive',
        });
      }

      if (imageFiles.length > 0) {
        setSelectedFiles(prevFiles => {
          const newFiles = [...prevFiles, ...imageFiles].slice(0, 4);
          return newFiles;
        });
      }
      event.target.value = ''; 
    }
  }, [toast, selectedFiles.length]);

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
      if (selectedFiles.length + newPastedFiles.length > 4) {
        toast({
          title: '貼上圖片失敗',
          description: `最多只能選擇 4 張圖片。您已選擇 ${selectedFiles.length} 張，嘗試再貼上 ${newPastedFiles.length} 張。`,
          variant: 'destructive',
        });
        return;
      }

      setSelectedFiles(prevFiles => {
        const updatedFiles = [...prevFiles, ...newPastedFiles].slice(0, 4);
        return updatedFiles;
      });

      toast({
        title: '圖片已貼上',
        description: `成功貼上 ${newPastedFiles.length} 張圖片。`,
        variant: 'default',
      });
    }
  }, [selectedFiles.length, toast, isLoading]);

  useEffect(() => {
    const pasteHandler = (event: Event) => handlePaste(event as ClipboardEvent<Document>);
    document.addEventListener('paste', pasteHandler);
    return () => {
      document.removeEventListener('paste', pasteHandler);
    };
  }, [handlePaste]);

  useEffect(() => {
    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    // It's important to revoke previous object URLs to prevent memory leaks
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImagePreviews(newPreviews);
    onFilesSelected(selectedFiles);

    // Cleanup function to revoke object URLs when component unmounts or selectedFiles change
    return () => {
      newPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedFiles, onFilesSelected, imagePreviews]); // Added imagePreviews to dependency to avoid stale closure


  const removeImage = (index: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setSelectedFiles([]);
  };

  const canUploadMore = selectedFiles.length < 4;

  return (
    <Card className="w-full bg-muted dark:bg-muted">
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
                isLoading || !canUploadMore ? "cursor-not-allowed bg-muted/50 border-muted-foreground/30" : "cursor-pointer hover:border-primary/80 border-primary/50 bg-primary/10 hover:bg-primary/20",
                !canUploadMore && !isLoading && "border-accent bg-accent/10"
              )}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-10 w-10 text-primary mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm font-medium text-foreground">處理中...</p>
                </>
              ) : canUploadMore ? (
                <>
                  <UploadCloud className="w-10 h-10 text-primary/80 mb-2" />
                  <p className="text-sm font-medium text-foreground text-center">
                    點擊此處或拖曳圖片至此上傳（或截圖貼上）
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    已選 {selectedFiles.length}/4 張圖片
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-10 h-10 text-accent mb-2" />
                  <p className="text-sm font-medium text-foreground">已達圖片上傳上限 (4張)</p>
                  <p className="text-xs text-muted-foreground mt-1">您可以清除部分圖片後再試</p>
                </>
              )}
            </label>
            <Input
              id="imageUpload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={isLoading || !canUploadMore}
              className="sr-only"
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-4">
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

