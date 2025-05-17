"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, ImagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      if (filesArray.length > 4) {
        toast({
          title: '上傳錯誤',
          description: '最多只能選擇 4 張圖片。',
          variant: 'destructive',
        });
        // Reset input value to allow re-selection of same files after error
        event.target.value = ''; 
        return;
      }
      
      // Filter out non-image files
      const imageFiles = filesArray.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length !== filesArray.length) {
        toast({
          title: '檔案類型錯誤',
          description: '請僅選擇圖片檔案。',
          variant: 'destructive',
        });
      }

      if (imageFiles.length > 0) {
        setSelectedFiles(prevFiles => {
          const newFiles = [...prevFiles, ...imageFiles].slice(0, 4); // Max 4 files
           if (prevFiles.length + imageFiles.length > 4 && newFiles.length === 4) {
            toast({
              title: '上傳限制',
              description: '已達到4張圖片上限，部分圖片未加入。',
              variant: 'default',
            });
          }
          return newFiles;
        });
      }
      // Reset input value to allow re-selection of same files
      event.target.value = ''; 
    }
  }, [toast]);

  useEffect(() => {
    const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
    imagePreviews.forEach(url => URL.revokeObjectURL(url)); // Clean up old previews
    setImagePreviews(newPreviews);
    onFilesSelected(selectedFiles);

    return () => {
      newPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]); // Dependencies: onFilesSelected removed to prevent re-renders from parent

  const removeImage = (index: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-6 w-6 text-primary" />
          上傳圖片
        </CardTitle>
        <CardDescription>請選擇 1 至 4 張包含文字的圖片（例如：JPG, PNG）。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            id="imageUpload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={isLoading || selectedFiles.length >= 4}
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
          />
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {imagePreviews.map((previewUrl, index) => (
                <div key={index} className="relative group aspect-square">
                  <Image
                    src={previewUrl}
                    alt={`預覽 ${index + 1}`}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md border"
                    data-ai-hint="document scan"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-70 group-hover:opacity-100"
                    onClick={() => removeImage(index)}
                    disabled={isLoading}
                    aria-label={`移除圖片 ${index + 1}`}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {selectedFiles.length > 0 && (
             <Button 
              variant="outline" 
              onClick={() => { setSelectedFiles([]); setImagePreviews([]); }}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              清除所有圖片
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
