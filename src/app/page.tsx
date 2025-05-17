"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PirlsLogo } from '@/components/PirlsLogo';
import { FileUpload } from '@/components/FileUpload';
import { QuestionCard } from '@/components/QuestionCard';
import { extractTextFromImage, type ExtractTextFromImageOutput } from '@/ai/flows/extract-text-from-image';
import { generatePirlsQuestions, type GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckSquare, Brain } from 'lucide-react';

export default function PIRLSQuestionCraftPage() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedQuestionsOutput, setGeneratedQuestionsOutput] = useState<GeneratePirlsQuestionsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const convertFileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerateQuestions = useCallback(async () => {
    if (imageFiles.length === 0) {
      toast({
        title: '沒有圖片',
        description: '請先上傳至少一張圖片。',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedQuestionsOutput(null);
    setLoadingProgress(0);
    setLoadingMessage('準備開始處理...');

    try {
      const totalSteps = imageFiles.length + 2; // Each image extraction + 1 for combining text + 1 for question generation
      let currentStep = 0;

      const updateProgress = (message: string) => {
        currentStep++;
        setLoadingMessage(message);
        setLoadingProgress((currentStep / totalSteps) * 100);
      };
      
      updateProgress('開始提取圖片文字...');
      const extractedTextsArray: string[] = [];
      for (const file of imageFiles) {
        updateProgress(`提取 "${file.name}" 中的文字...`);
        const photoDataUri = await convertFileToDataUri(file);
        const extractionResult: ExtractTextFromImageOutput = await extractTextFromImage({ photoDataUri });
        if (extractionResult.success && extractionResult.extractedText) {
          extractedTextsArray.push(extractionResult.extractedText);
        } else if (!extractionResult.success) {
          throw new Error(`無法從圖片 "${file.name}" 提取文字: ${extractionResult.error || '未知錯誤'}`);
        }
        // If successful but no text, it's fine, just don't add to array.
      }

      if (extractedTextsArray.length === 0) {
        throw new Error('所有圖片中均未偵測到有效文字內容。');
      }
      
      updateProgress('整合文字內容...');
      const combinedText = extractedTextsArray.join('\n\n---\n\n'); // Add separator for clarity

      updateProgress('開始生成PIRLS題目...');
      const questionsResult = await generatePirlsQuestions({ extractedText: combinedText });
      
      if (questionsResult && questionsResult.questions) {
        setGeneratedQuestionsOutput(questionsResult);
        toast({
          title: '成功！',
          description: 'PIRLS 題目已生成。',
          variant: 'default',
          className: 'bg-green-500 border-green-500 text-white',
        });
      } else {
        throw new Error('AI未能成功生成題目。');
      }

    } catch (err: any) {
      console.error("生成題目時發生錯誤:", err);
      const errorMessage = err.message || '發生未知錯誤，請稍後再試。';
      setError(errorMessage);
      toast({
        title: '生成失敗',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingProgress(100);
      setLoadingMessage(error ? '處理失敗' : '處理完成！');
    }
  }, [imageFiles, toast, error]);


  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen flex flex-col items-center">
      <header className="my-8 text-center">
        <PirlsLogo className="mx-auto mb-2 h-16 w-auto" />
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">PIRLS 閱讀素養題組生成器</h1>
        <p className="mt-2 text-md sm:text-lg text-muted-foreground">
          上傳圖片，AI 為您分析內容並設計PIRLS四層次選擇題。
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <FileUpload onFilesSelected={setImageFiles} isLoading={isLoading} />

        <Button
          onClick={handleGenerateQuestions}
          disabled={isLoading || imageFiles.length === 0}
          className="w-full text-lg py-6"
          size="lg"
        >
          {isLoading ? '處理中...' : (
            <>
              <Brain className="mr-2 h-5 w-5" />
              生成PIRLS題目
            </>
          )}
        </Button>

        {isLoading && (
          <div className="space-y-2">
            <Progress value={loadingProgress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">{loadingMessage} ({Math.round(loadingProgress)}%)</p>
          </div>
        )}

        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>錯誤</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {generatedQuestionsOutput && !isLoading && (
          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-center flex items-center justify-center">
              <CheckSquare className="h-7 w-7 mr-2 text-green-600" />
              生成的PIRLS題目
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {generatedQuestionsOutput.questions.map((q, index) => (
                <QuestionCard key={index} questionItem={q} questionNumber={index + 1} />
              ))}
            </Accordion>
          </section>
        )}
      </main>
      
      <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PIRLS QuestionCraft. All rights reserved.</p>
      </footer>
    </div>
  );
}
