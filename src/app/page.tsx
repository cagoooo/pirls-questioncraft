
"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PirlsLogo } from '@/components/PirlsLogo';
import { FileUpload } from '@/components/FileUpload';
import { QuestionCard } from '@/components/QuestionCard';
import { extractTextFromImage, type ExtractTextFromImageOutput } from '@/ai/flows/extract-text-from-image';
import { generatePirlsQuestions, type GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { exportPIRLStoPDF } from '@/lib/generatePdf';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckSquare, Brain, Loader2, Download } from 'lucide-react';

export default function PIRLSQuestionCraftPage() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedQuestionsOutput, setGeneratedQuestionsOutput] = useState<GeneratePirlsQuestionsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const loadingSectionRef = useRef<HTMLDivElement>(null); // Added ref for loading section
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);


  const convertFileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageFilesChange = useCallback((files: File[]) => {
    setImageFiles(files);
    setGeneratedQuestionsOutput(null);
    setError(null);
  }, []);


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
    
    // Scroll to loading section
    setTimeout(() => {
      loadingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    const currentImageFilesCount = imageFiles.length;
    const totalSteps = currentImageFilesCount + 2; 
    let completedSteps = 0;

    const updateDisplayProgress = (stepsDone: number, message: string) => {
      setLoadingMessage(message);
      const progress = totalSteps > 0 ? Math.max(0, Math.min(100, (stepsDone / totalSteps) * 100)) : 0;
      setLoadingProgress(progress); 
    };

    updateDisplayProgress(completedSteps, '準備開始處理...'); 

    try {
      const extractedTextsArray: string[] = [];
      if (currentImageFilesCount > 0) {
        for (let i = 0; i < currentImageFilesCount; i++) {
          const file = imageFiles[i]; 
          updateDisplayProgress(completedSteps, `提取 "${file.name}" 中的文字... (${i + 1}/${currentImageFilesCount})`);
          
          const photoDataUri = await convertFileToDataUri(file);
          const extractionResult: ExtractTextFromImageOutput = await extractTextFromImage({ photoDataUri });
          
          if (extractionResult.success && extractionResult.extractedText) {
            extractedTextsArray.push(extractionResult.extractedText);
          } else if (!extractionResult.success) {
            throw new Error(`無法從圖片 "${file.name}" 提取文字: ${extractionResult.error || '未知錯誤'}`);
          }
          completedSteps++; 
        }
      }

      if (currentImageFilesCount > 0 && extractedTextsArray.length === 0) {
        throw new Error('所有圖片中均未偵測到有效文字內容。');
      }
      
      updateDisplayProgress(completedSteps, '整合文字內容...');
      const combinedText = extractedTextsArray.join('\\n\\n---\\n\\n'); 
      completedSteps++; 

      updateDisplayProgress(completedSteps, '開始生成PIRLS題目...');
      const questionsResult = await generatePirlsQuestions({ extractedText: combinedText });
      completedSteps++; 
      
      if (questionsResult && questionsResult.questions) {
        updateDisplayProgress(completedSteps, '題目已成功生成！'); 
        setGeneratedQuestionsOutput(questionsResult);
        toast({
          title: '成功！',
          description: 'PIRLS 題目已生成。',
          variant: 'default',
          className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
        });
        setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        throw new Error('APP未能成功生成題目。');
      }

    } catch (err: any)
      {
      console.error("生成題目時發生錯誤:", err);
      const errorMessage = err.message || '發生未知錯誤，請稍後再試。';
      setError(errorMessage);
      toast({
        title: '生成失敗',
        description: errorMessage,
        variant: 'destructive',
      });
      const currentProgressMessage = loadingMessage.split('...')[0] || '處理';
      updateDisplayProgress(completedSteps, `${currentProgressMessage}時發生錯誤`);

    } finally {
      setIsLoading(false);
      if (!error && generatedQuestionsOutput && completedSteps === totalSteps) {
         updateDisplayProgress(totalSteps, '所有處理步驟已完成！');
      } else if (error) {
        // Message already set in catch, progress already updated
      } else if (!generatedQuestionsOutput && !error) {
        updateDisplayProgress(completedSteps, '處理完成但未生成題目');
      }
    }
  }, [imageFiles, toast, generatedQuestionsOutput, loadingMessage]);

  const handleDownloadPdf = async () => {
    if (!generatedQuestionsOutput || imageFiles.length === 0) {
      toast({
        title: '無法下載 PDF',
        description: '請先生成題目並確認已上傳圖片。',
        variant: 'destructive',
      });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      await exportPIRLStoPDF(imageFiles, generatedQuestionsOutput, toast);
    } catch (pdfError: any) {
      console.error("PDF 生成失敗:", pdfError);
      toast({
        title: 'PDF 生成失敗',
        description: pdfError.message || '無法生成 PDF 檔案，請稍後再試。',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen flex flex-col items-center">
      <header className="my-8 text-center">
        <PirlsLogo className="mx-auto mb-2 h-16 w-auto sm:h-20" />
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">PIRLS 閱讀素養題組生成器</h1>
        <p className="mt-2 text-md sm:text-lg text-muted-foreground">
          上傳圖片，APP 為您分析內容並設計PIRLS四層次選擇題。
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <FileUpload onFilesSelected={handleImageFilesChange} isLoading={isLoading || isGeneratingPdf} />

        <Button
          onClick={handleGenerateQuestions}
          disabled={isLoading || isGeneratingPdf || imageFiles.length === 0}
          className="w-full py-3 text-sm sm:text-base sm:py-4 sm:text-lg transition-all duration-150 ease-out hover:scale-[1.015] hover:shadow-lg active:scale-100"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              處理中，請稍候...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-5 w-5" />
              生成PIRLS題目
            </>
          )}
        </Button>

        {isLoading && (
           <Card ref={loadingSectionRef} className="w-full shadow-md"> {/* Attached ref here */}
            <CardHeader>
              <CardTitle className="flex items-center text-xl font-semibold">
                <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
                APP 努力思考中...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <Progress value={loadingProgress} className="w-full h-3" />
              <p className="text-sm text-muted-foreground text-center">
                {loadingMessage} ({Math.round(loadingProgress)}%)
              </p>
            </CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>錯誤</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {generatedQuestionsOutput && !isLoading && (
          <section ref={resultsSectionRef} className="mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-center flex items-center justify-center mb-2 sm:mb-0">
                <CheckSquare className="h-7 w-7 mr-2 text-green-600" />
                為您生成的PIRLS題目
                </h2>
                <Button
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf || !generatedQuestionsOutput}
                    variant="outline"
                >
                    {isGeneratingPdf ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            PDF產生中...
                        </>
                    ) : (
                        <>
                            <Download className="mr-2 h-4 w-4" />
                            下載 PDF
                        </>
                    )}
                </Button>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {generatedQuestionsOutput.questions.map((q, index) => (
                <QuestionCard key={index} questionItem={q} questionNumber={index + 1} />
              ))}
            </Accordion>
          </section>
        )}
      </main>
      
      <footer className="w-full max-w-3xl mt-16 mb-8 p-6 bg-card/80 dark:bg-card/60 rounded-xl shadow-lg text-center text-sm text-muted-foreground transition-all duration-300 ease-in-out hover:shadow-2xl hover:bg-card">
        <p className="leading-relaxed">
          &copy; {currentYear ? currentYear : new Date().getFullYear()}{' '}
          <a 
            href="https://www.smes.tyc.edu.tw/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-medium text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          >
            桃園市石門國小資訊組 阿凱老師 設計
          </a>
        </p>
      </footer>
    </div>
  );
}

