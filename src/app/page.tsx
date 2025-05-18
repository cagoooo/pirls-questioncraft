
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
import { exportPIRLStoExcel } from '@/lib/generateExcel';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckSquare, Brain, Loader2, Download, Sheet as SheetIcon } from 'lucide-react';

export default function PIRLSQuestionCraftPage() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedQuestionsOutput, setGeneratedQuestionsOutput] = useState<GeneratePirlsQuestionsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [fileGenerationProgress, setFileGenerationProgress] = useState(0);
  const [fileGenerationMessage, setFileGenerationMessage] = useState('');

  const { toast } = useToast();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const loadingSectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const fileProgressSectionRef = useRef<HTMLDivElement>(null); // Ref for file progress section
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
    if (files.length > 0 && generateButtonRef.current) {
      const timer = setTimeout(() => {
        generateButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      // No cleanup needed for one-shot timeout in callback
    }
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
    
    setTimeout(() => {
      loadingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    const currentImageFilesCount = imageFiles.length;
    const totalSteps = 1 + currentImageFilesCount + 1 + 1 + 1; 
    let completedSteps = 0;

    const updateDisplayProgress = (stepsDone: number, message: string) => {
      setLoadingMessage(message);
      const progress = totalSteps > 0 ? Math.max(0, Math.min(100, (stepsDone / totalSteps) * 100)) : 0;
      setLoadingProgress(progress); 
    };
    
    completedSteps++;
    updateDisplayProgress(completedSteps, '準備開始處理...'); 

    try {
      const extractedTextsArray: string[] = [];
      if (currentImageFilesCount > 0) {
        for (let i = 0; i < currentImageFilesCount; i++) {
          const file = imageFiles[i]; 
          completedSteps++;
          updateDisplayProgress(completedSteps, `提取 "${file.name}" 中的文字... (${i + 1}/${currentImageFilesCount})`);
          
          const photoDataUri = await convertFileToDataUri(file);
          const extractionResult: ExtractTextFromImageOutput = await extractTextFromImage({ photoDataUri });
          
          if (extractionResult.success && extractionResult.extractedText) {
            extractedTextsArray.push(extractionResult.extractedText);
          } else if (!extractionResult.success) {
            throw new Error(`無法從圖片 "${file.name}" 提取文字: ${extractionResult.error || '未知錯誤'}`);
          }
        }
      } else {
        completedSteps += currentImageFilesCount; 
      }


      if (currentImageFilesCount > 0 && extractedTextsArray.length === 0) {
        throw new Error('所有圖片中均未偵測到有效文字內容。');
      }
      
      completedSteps++;
      updateDisplayProgress(completedSteps, '整合文字內容...');
      const combinedText = extractedTextsArray.join('\n\n---\n\n');
      

      completedSteps++;
      updateDisplayProgress(completedSteps, '開始生成PIRLS題目...');
      const questionsResult = await generatePirlsQuestions({ extractedText: combinedText });
      
      
      if (questionsResult && questionsResult.questions) {
        completedSteps++;
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

    } catch (err: any) {
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
      if (!error && generatedQuestionsOutput) {
         updateDisplayProgress(totalSteps, '所有處理步驟已完成！');
      } else if (error) {
        // Message already set in catch
      } else if (!generatedQuestionsOutput && !error) {
        updateDisplayProgress(completedSteps, '處理完成但未生成題目');
      }
    }
  }, [imageFiles, toast, generatedQuestionsOutput, error, loadingMessage]);

  const fileProgressCallback = (progress: number, message: string) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

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
    setFileGenerationProgress(0);
    setFileGenerationMessage('正在初始化 PDF 產生程序...');
    setTimeout(() => {
      fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    try {
      await exportPIRLStoPDF(imageFiles, generatedQuestionsOutput, toast, fileProgressCallback);
    } catch (pdfError: any) {
      console.error("PDF 生成失敗:", pdfError);
      toast({
        title: 'PDF 生成失敗',
        description: pdfError.message || '無法生成 PDF 檔案，請稍後再試。',
        variant: 'destructive',
      });
      setFileGenerationMessage(`PDF 生成失敗: ${pdfError.message || '未知錯誤'}`);
      setFileGenerationProgress(0); 
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!generatedQuestionsOutput) {
      toast({
        title: '無法下載 Excel',
        description: '請先生成題目。',
        variant: 'destructive',
      });
      return;
    }
    setIsGeneratingExcel(true);
    setFileGenerationProgress(0);
    setFileGenerationMessage('正在初始化 Excel 產生程序...');
    setTimeout(() => {
      fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    try {
      await exportPIRLStoExcel(generatedQuestionsOutput, toast, fileProgressCallback);
    } catch (excelError: any) {
      console.error("Excel 生成失敗:", excelError);
      toast({
        title: 'Excel 生成失敗',
        description: excelError.message || '無法生成 Excel 檔案，請稍後再試。',
        variant: 'destructive',
      });
      setFileGenerationMessage(`Excel 生成失敗: ${excelError.message || '未知錯誤'}`);
      setFileGenerationProgress(0);
    } finally {
      setIsGeneratingExcel(false);
    }
  };


  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen flex flex-col items-center">
      <header className="my-8 text-center">
        <PirlsLogo className="mx-auto mb-4 h-20 w-auto sm:h-24" />
        <h1 className="
          inline-block
          text-3xl sm:text-4xl font-bold text-primary
          py-3 px-6 sm:py-4 sm:px-8
          bg-primary/5 dark:bg-primary/10
          border-2 border-primary/30
          rounded-xl
          shadow-lg
          transition-all duration-300 ease-in-out
          hover:shadow-xl hover:border-primary/50 hover:bg-primary/10 dark:hover:bg-primary/20
          cursor-default
        ">
          PIRLS 閱讀素養題組生成站
        </h1>
        <p className="mt-4 text-md sm:text-lg text-muted-foreground">
          上傳圖片，APP 為您分析內容並設計PIRLS四層次選擇題。
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <FileUpload 
          onFilesSelected={handleImageFilesChange} 
          isLoading={isLoading || isGeneratingPdf || isGeneratingExcel} 
        />

        <Button
          ref={generateButtonRef}
          onClick={handleGenerateQuestions}
          disabled={isLoading || isGeneratingPdf || isGeneratingExcel || imageFiles.length === 0}
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
           <Card ref={loadingSectionRef} className="w-full shadow-md">
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
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0 sm:space-x-2">
                <h2 className="text-2xl font-semibold text-center flex items-center justify-center">
                  <CheckSquare className="h-7 w-7 mr-2 text-green-600" />
                  為您生成的PIRLS題目
                </h2>
                <div className="flex space-x-2">
                  <Button
                      onClick={handleDownloadPdf}
                      disabled={isGeneratingPdf || isGeneratingExcel || isLoading || !generatedQuestionsOutput || imageFiles.length === 0}
                      variant="outline"
                  >
                      {isGeneratingPdf ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              PDF準備中...
                          </>
                      ) : (
                          <>
                              <Download className="mr-2 h-4 w-4" />
                              下載 PDF
                          </>
                      )}
                  </Button>
                  <Button
                      onClick={handleDownloadExcel}
                      disabled={isGeneratingPdf || isGeneratingExcel || isLoading || !generatedQuestionsOutput}
                      variant="outline"
                  >
                      {isGeneratingExcel ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Excel準備中...
                          </>
                      ) : (
                          <>
                              <SheetIcon className="mr-2 h-4 w-4" />
                              下載 Excel
                          </>
                      )}
                  </Button>
                </div>
            </div>

            {(isGeneratingPdf || isGeneratingExcel) && (
              <Card ref={fileProgressSectionRef} className="w-full shadow-md mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center text-xl font-semibold">
                    <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
                    檔案處理中...
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <Progress value={fileGenerationProgress} className="w-full h-3" />
                  <p className="text-sm text-muted-foreground text-center">
                    {fileGenerationMessage} ({Math.round(fileGenerationProgress)}%)
                  </p>
                </CardContent>
              </Card>
            )}

            <Accordion type="single" collapsible className="w-full">
              {generatedQuestionsOutput.questions.map((q, index) => (
                <QuestionCard key={index} questionItem={q} questionNumber={index + 1} />
              ))}
            </Accordion>
          </section>
        )}
      </main>
      
      <footer className="w-full max-w-3xl mt-16 mb-8 p-6 bg-muted dark:bg-card rounded-xl shadow-lg text-center text-sm text-muted-foreground transition-all duration-300 ease-in-out hover:shadow-2xl hover:bg-secondary dark:hover:bg-muted">
        <p className="leading-relaxed">
          &copy; {currentYear ? currentYear : ''}{' '}
          <a 
            href="https://www.smes.tyc.edu.tw/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            桃園市石門國小資訊組 阿凱老師 設計
          </a>
        </p>
      </footer>
    </div>
  );
}

    