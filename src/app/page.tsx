
"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PirlsLogo } from '@/components/PirlsLogo';
import { FileUpload } from '@/components/FileUpload';
import { QuestionCard } from '@/components/QuestionCard';
import { QuizView } from '@/components/QuizView';
import { extractTextFromImage, type ExtractTextFromImageOutput } from '@/ai/flows/extract-text-from-image';
import { generatePirlsQuestions, type GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { exportPIRLStoPDF } from '@/lib/generatePdf';
import { exportPIRLStoExcel } from '@/lib/generateExcel';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckSquare, Brain, Loader2, Download, Sheet as SheetIcon, ClipboardCheck, Share2, Copy } from 'lucide-react';

type ProgressCallback = (progress: number, message: string) => void;

export default function PIRLSQuestionCraftPage() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isGeneratingQuizResultsPdf, setIsGeneratingQuizResultsPdf] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [generatedQuestionsOutput, setGeneratedQuestionsOutput] = useState<GeneratePirlsQuestionsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [fileGenerationProgress, setFileGenerationProgress] = useState(0);
  const [fileGenerationMessage, setFileGenerationMessage] = useState('');
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const { toast } = useToast();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const loadingSectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const fileProgressSectionRef = useRef<HTMLDivElement>(null); 
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  const placeholderShareLink = typeof window !== 'undefined' ? `${window.location.origin}/quiz/placeholder-id` : 'https://pirlss.smes.tyc.edu.tw/quiz/placeholder-id';


  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    if ((isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf) && fileProgressSectionRef.current) {
      const timer = setTimeout(() => {
        fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); 
      return () => clearTimeout(timer);
    }
  }, [isGeneratingPdf, isGeneratingExcel, isGeneratingQuizResultsPdf]);


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
    setIsQuizActive(false);
    if (files.length > 0 && generateButtonRef.current) {
      const timer = setTimeout(() => {
        generateButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
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
    setIsQuizActive(false);
    
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
          } else {
            console.warn(`Text extraction failed for ${file.name}: ${extractionResult.error || 'No text extracted or an error occurred'}`);
            toast({
              title: `圖片 "${file.name}" 處理提示`,
              description: extractionResult.error || '無法提取文字或圖片中無文字。',
              variant: 'default', 
            });
          }
        }
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
    }
  }, [imageFiles, toast, loadingMessage]);

  const fileProgressCallback: ProgressCallback = (progress, message) => {
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

  const handleStartQuiz = () => {
    if (generatedQuestionsOutput && imageFiles.length > 0) {
      setIsQuizActive(true);
      setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
       toast({
        title: '無法開始測驗',
        description: '請先上傳圖片並成功生成題目。',
        variant: 'destructive',
      });
    }
  };

  const handleExitQuiz = () => {
    setIsQuizActive(false);
  };

  const handleShowQuizResultsPdfProgress = (show: boolean) => {
    setIsGeneratingQuizResultsPdf(show);
  };

  const handleUpdateQuizResultsPdfProgress: ProgressCallback = (progress, message) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(placeholderShareLink).then(() => {
      toast({
        title: "連結已複製",
        description: "示意分享連結已複製到剪貼簿。",
        variant: "default",
        className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white',
      });
    }).catch(err => {
      console.error("複製連結失敗:", err);
      toast({
        title: "複製失敗",
        description: "無法複製連結，請手動複製。",
        variant: "destructive",
      });
    });
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
        {!isQuizActive && (
          <FileUpload 
            onFilesSelected={handleImageFilesChange} 
            isLoading={isLoading || isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf} 
          />
        )}

        {!isQuizActive && (
          <Button
            ref={generateButtonRef}
            onClick={handleGenerateQuestions}
            disabled={isLoading || isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf || imageFiles.length === 0}
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
        )}

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
             {(isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf) && (
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
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0 sm:space-x-2">
                <h2 className="text-2xl font-semibold text-center flex items-center justify-center">
                  <CheckSquare className="h-7 w-7 mr-2 text-green-600" />
                  {isQuizActive ? "PIRLS 線上測驗" : "為您生成的PIRLS題目"}
                </h2>
                {!isQuizActive && (
                  <div className="flex space-x-1 sm:space-x-2 flex-wrap justify-center">
                    <Button
                        onClick={handleStartQuiz}
                        disabled={isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput || imageFiles.length === 0}
                        variant="outline"
                        className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
                    >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        開始測驗
                    </Button>
                     <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => setIsShareDialogOpen(true)}
                            disabled={isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput || imageFiles.length === 0}
                            variant="outline"
                            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            分享測驗
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>分享您的測驗</DialogTitle>
                            <DialogDescription>
                              讓其他人可以透過連結或QR Code參與此測驗。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <div className="space-y-1">
                              <label htmlFor="share-link" className="text-sm font-medium">
                                分享連結 (示意)
                              </label>
                              <div className="flex items-center space-x-2">
                                <Input id="share-link" value={placeholderShareLink} readOnly className="flex-1" />
                                <Button type="button" size="sm" onClick={handleCopyShareLink}>
                                  <Copy className="h-4 w-4 mr-1 sm:mr-2" />
                                  <span className="hidden sm:inline">複製</span>
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                               <label className="text-sm font-medium">QR Code (示意)</label>
                               <div className="flex items-center justify-center p-4 border rounded-md bg-muted h-32">
                                 <p className="text-muted-foreground text-sm">QR Code 預留位置</p>
                               </div>
                            </div>
                             <Alert variant="default" className="bg-yellow-50 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <AlertTitle className="text-yellow-700 dark:text-yellow-300">請注意</AlertTitle>
                              <AlertDescription className="text-yellow-600 dark:text-yellow-500 text-xs">
                                完整的測驗分享功能（包含圖片和學生作答追蹤）需要將題組儲存到伺服器。目前的連結和QR碼僅為示意，尚無法讓他人直接進行測驗。
                              </AlertDescription>
                            </Alert>
                          </div>
                          <DialogFooter className="sm:justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsShareDialogOpen(false)}>
                              關閉
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    <Button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput || imageFiles.length === 0}
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
                        disabled={isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput}
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
                )}
            </div>
            
            {isQuizActive && generatedQuestionsOutput && imageFiles.length > 0 ? (
              <QuizView 
                questionsOutput={generatedQuestionsOutput} 
                imageFiles={imageFiles} 
                onExitQuiz={handleExitQuiz}
                toast={toast}
                showFileGenerationProgress={handleShowQuizResultsPdfProgress}
                updateFileGenerationProgress={handleUpdateQuizResultsPdfProgress}
                isGeneratingQuizResultsPdf={isGeneratingQuizResultsPdf}
              />
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {generatedQuestionsOutput?.questions.map((q, index) => (
                  <QuestionCard key={index} questionItem={q} questionNumber={index + 1} />
                ))}
              </Accordion>
            )}
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
    

    


