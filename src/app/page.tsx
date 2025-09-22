
"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDesc, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PirlsLogo } from '@/components/PirlsLogo';
import { FileUpload } from '@/components/FileUpload';
import { QuestionCard } from '@/components/QuestionCard';
import { QuizView } from '@/components/QuizView';
import { generatePirlsQuestions, type GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { generatePirlsQuestionsFromText } from '@/ai/flows/generate-pirls-questions-from-text';
import { exportPIRLStoPDF } from '@/lib/generatePdf';
import { exportPIRLStoExcel } from '@/lib/generateExcel';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, CheckSquare, Brain, Loader2, Download, Sheet as SheetIcon, ClipboardCheck, Share2, Copy, AlertTriangle, Sparkles, Blocks, Bot, Languages, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type ProgressCallback = (progress: number, message: string) => void;
type InputMode = 'image' | 'text';

/**
 * Resizes an image file to a maximum dimension while maintaining aspect ratio
 * and converts it to a JPEG data URI for optimization.
 * @param file The image file to resize.
 * @param maxSize The maximum width or height of the image.
 * @returns A promise that resolves with the data URI of the resized image.
 */
const resizeImage = (file: File, maxSize: number = 2048): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        return reject(new Error("FileReader did not return a result."));
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate the new dimensions
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          return reject(new Error('Failed to get canvas 2D context.'));
        }
        
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to JPEG data URI for better compression
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};


export default function PIRLSQuestionCraftPage() {
  const [inputMode, setInputMode] = useState<InputMode>('image');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [inputText, setInputText] = useState('');
  const [questionMode, setQuestionMode] = useState<'8-questions' | '10-questions'>('8-questions');
  const [languageMode, setLanguageMode] = useState<'zh-TW' | 'en'>('zh-TW');
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
  const [isSharingQuiz, setIsSharingQuiz] = useState(false);
  const [currentShareLink, setCurrentShareLink] = useState('');


  const { toast } = useToast();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const loadingSectionRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const fileProgressSectionRef = useRef<HTMLDivElement>(null); 
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    if ((isGeneratingPdf || isGeneratingExcel) && fileProgressSectionRef.current) {
      const timer = setTimeout(() => {
        fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100); 
      return () => clearTimeout(timer);
    }
  }, [isGeneratingPdf, isGeneratingExcel]);

  useEffect(() => {
    if (isGeneratingQuizResultsPdf && fileProgressSectionRef.current) {
        const timer = setTimeout(() => {
            fileProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [isGeneratingQuizResultsPdf]);

  const handleImageFilesChange = useCallback((files: File[]) => {
    setImageFiles(files);
    setGeneratedQuestionsOutput(null);
    setError(null);
    setIsQuizActive(false);
    setCurrentShareLink(''); // Reset share link if images change
    if (files.length > 0 && generateButtonRef.current) {
      const timer = setTimeout(() => {
        generateButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleInputTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setGeneratedQuestionsOutput(null);
    setError(null);
    setIsQuizActive(false);
    setCurrentShareLink('');
  }, []);


  const handleGenerateQuestions = useCallback(async () => {
    const isReady = (inputMode === 'image' && imageFiles.length > 0) || (inputMode === 'text' && inputText.trim().length > 0);

    if (!isReady) {
      toast({
        title: inputMode === 'image' ? '沒有圖片' : '沒有文字',
        description: inputMode === 'image' ? '請先上傳至少一張圖片。' : '請在文字區塊中輸入或貼上內容。',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedQuestionsOutput(null);
    setIsQuizActive(false);
    setCurrentShareLink('');

    setTimeout(() => {
      loadingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    const updateDisplayProgress = (progress: number, message: string) => {
      setLoadingMessage(message);
      setLoadingProgress(progress);
    };

    updateDisplayProgress(10, '準備開始處理...');

    try {
      let questionsResult: GeneratePirlsQuestionsOutput;

      if (inputMode === 'image') {
        updateDisplayProgress(20, '正在壓縮與處理圖片...');
        const photoDataUris = await Promise.all(imageFiles.map(file => resizeImage(file)));

        if (photoDataUris.length === 0) {
          throw new Error('無法處理圖片，請確認檔案是否正確。');
        }

        updateDisplayProgress(50, 'AI 正在分析圖片並設計題目...');
        questionsResult = await generatePirlsQuestions({
          photoDataUris,
          questionMode,
          languageMode,
        });

      } else { // inputMode === 'text'
        updateDisplayProgress(40, 'AI 正在分析文字並設計題目...');
        questionsResult = await generatePirlsQuestionsFromText({
          text: inputText,
          questionMode,
          languageMode,
        });
      }


      if (questionsResult && questionsResult.questions) {
        updateDisplayProgress(100, '題目已成功生成！');
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
      console.error("生成題目時發生錯誤:", err.message, err.stack);
      const errorMessage = err.message || '發生未知錯誤，請稍後再試。';
      setError(errorMessage);
      toast({
        title: '生成失敗',
        description: errorMessage,
        variant: 'destructive',
      });
      updateDisplayProgress(loadingProgress, '處理時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  }, [inputMode, imageFiles, inputText, toast, questionMode, languageMode, loadingProgress]);

  const fileProgressCallback: ProgressCallback = (progress, message) => {
    setFileGenerationProgress(progress);
    setFileGenerationMessage(message);
  };

  const handleDownloadPdf = async () => {
    if (!generatedQuestionsOutput) {
      toast({ title: '無法下載 PDF', description: '請先生成題目。', variant: 'destructive' });
      return;
    }
    if (inputMode === 'text') {
      toast({ title: 'PDF 功能限制', description: '從純文字生成的題組目前不支援匯出為包含文本的 PDF。', variant: 'destructive' });
      return;
    }
    if (imageFiles.length === 0) {
      toast({ title: '無法下載 PDF', description: '請確認已上傳圖片以匯出包含文本的 PDF。', variant: 'destructive' });
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
    if (generatedQuestionsOutput && (imageFiles.length > 0 || inputText.trim().length > 0)) {
      setIsQuizActive(true);
      setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
       toast({
        title: '無法開始測驗',
        description: '請先提供內容 (圖片或文字) 並成功生成題目。',
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

  const handleShareQuiz = async () => {
    if (!generatedQuestionsOutput || (imageFiles.length === 0 && inputText.trim().length === 0)) {
      toast({ title: "無法分享", description: "請先生成題目並上傳圖片或輸入文字。", variant: "destructive" });
      return;
    }
    setIsSharingQuiz(true);
    setCurrentShareLink(''); // Clear previous link
    setIsShareDialogOpen(true); // Open dialog to show loading/link

    try {
      const imageFilesDataURIs = inputMode === 'image' ? await Promise.all(imageFiles.map(file => resizeImage(file))) : [];
      const bodyPayload = {
        questionsOutput: generatedQuestionsOutput,
        imageFilesDataURIs,
        inputText: inputMode === 'text' ? inputText : '',
      };

      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await response.json();

      if (response.ok && data.success && data.quizId) {
        const newShareLink = `${window.location.origin}/quiz/${data.quizId}`;
        setCurrentShareLink(newShareLink);
        toast({ title: "臨時分享連結已生成", description: "連結已顯示在分享視窗中。", className: 'bg-green-500 border-green-500 text-white dark:bg-green-600 dark:border-green-600 dark:text-white' });
      } else {
        throw new Error(data.error || '無法生成分享連結');
      }
    } catch (shareError: any) {
      console.error("分享測驗失敗:", shareError);
      setCurrentShareLink('');
      toast({
        title: "分享失敗",
        description: `無法生成臨時分享連結: ${shareError.message || '未知錯誤'}`,
        variant: "destructive",
      });
    } finally {
      setIsSharingQuiz(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!currentShareLink) {
        toast({ title: "無連結可複製", description: "請先生成分享連結。", variant: "destructive" });
        return;
    }
    navigator.clipboard.writeText(currentShareLink).then(() => {
      toast({
        title: "連結已複製",
        description: "臨時分享連結已複製到剪貼簿。",
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
          上傳圖片或貼上文本，APP 為您分析內容並設計PIRLS四層次選擇題。
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        {!isQuizActive && (
          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as InputMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" />上傳圖片</TabsTrigger>
              <TabsTrigger value="text"><FileText className="mr-2 h-4 w-4" />貼上文本</TabsTrigger>
            </TabsList>
            <TabsContent value="image" className="mt-6">
              <FileUpload 
                onFilesSelected={handleImageFilesChange} 
                isLoading={isLoading || isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf} 
              />
            </TabsContent>
            <TabsContent value="text" className="mt-6">
              <Card className="w-full bg-accent/10 dark:bg-accent/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                    <FileText className="h-6 w-6 text-primary" />
                    貼上文本內容
                  </CardTitle>
                  <CardDescription>請將您想分析的文字（例如從 PDF、Word 或網頁複製的內容）貼到下面的文字框中。</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="請在此貼上您的文本內容..."
                    value={inputText}
                    onChange={handleInputTextChange}
                    className="h-48 text-base"
                    disabled={isLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {!isQuizActive && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center"><Blocks className="mr-2 h-5 w-5 text-primary" />題組模式</CardTitle>
                <CardDescription>選擇您希望 APP 生成的題目數量與組合。</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={questionMode}
                  onValueChange={(value) => {
                    if (!isLoading) setQuestionMode(value as '8-questions' | '10-questions');
                  }}
                  className="grid grid-cols-1 gap-4"
                  disabled={isLoading || isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf}
                >
                  <div>
                    <RadioGroupItem value="8-questions" id="mode-8" className="peer sr-only" />
                    <Label
                      htmlFor="mode-8"
                      className={cn(
                        "flex h-full flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
                        isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      )}
                    >
                      <span className="mb-2 block text-base font-semibold">標準模式 (8題)</span>
                      <p className="text-sm text-muted-foreground">各PIRLS層次各2題，適合標準評量。</p>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="10-questions" id="mode-10" className="peer sr-only" />
                    <Label
                      htmlFor="mode-10"
                      className={cn(
                        "flex h-full flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
                        isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      )}
                    >
                      <span className="mb-2 block text-base font-semibold">延伸模式 (10題)</span>
                      <p className="text-sm text-muted-foreground">強化基礎能力：訊息提取與直接推論各3題。</p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-100">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center"><Languages className="mr-2 h-5 w-5 text-primary" />語言模式</CardTitle>
                <CardDescription>選擇題目與選項的語言，詳解將維持中文。</CardDescription>
              </CardHeader>
              <CardContent>
                 <RadioGroup
                    value={languageMode}
                    onValueChange={(value) => {
                      if (!isLoading) setLanguageMode(value as 'zh-TW' | 'en');
                    }}
                    className="grid grid-cols-1 gap-4"
                    disabled={isLoading || isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf}
                  >
                  <div>
                    <RadioGroupItem value="zh-TW" id="lang-zh" className="peer sr-only" />
                    <Label
                      htmlFor="lang-zh"
                      className={cn(
                        "flex h-full flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
                        isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      )}
                    >
                      <span className="mb-2 block text-base font-semibold">繁體中文</span>
                      <p className="text-sm text-muted-foreground">所有內容均以繁體中文呈現。</p>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="en" id="lang-en" className="peer sr-only" />
                    <Label
                      htmlFor="lang-en"
                      className={cn(
                        "flex h-full flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
                        isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                      )}
                    >
                      <span className="mb-2 block text-base font-semibold">English</span>
                      <p className="text-sm text-muted-foreground">題目與選項為英文，適合英語閱讀測驗。</p>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>
        )}

        {!isQuizActive && (
          <Button
            ref={generateButtonRef}
            onClick={handleGenerateQuestions}
            disabled={
              isLoading || isGeneratingPdf || isGeneratingExcel || isGeneratingQuizResultsPdf ||
              (inputMode === 'image' && imageFiles.length === 0) ||
              (inputMode === 'text' && inputText.trim().length === 0)
            }
            className={cn(
              "w-full py-3 text-base sm:text-xl font-semibold transition-all duration-150 ease-out hover:scale-[1.015] hover:shadow-lg active:scale-100",
              "bg-accent text-accent-foreground hover:bg-accent/80"
            )}
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
                  {isQuizActive ? "PIRLS 線上測驗" : `為您生成的PIRLS題目 (${generatedQuestionsOutput.questions.length}題)`}
                </h2>
                {!isQuizActive && (
                  <div className="flex space-x-1 sm:space-x-2 flex-wrap justify-center">
                    <Button
                        onClick={handleStartQuiz}
                        disabled={isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput}
                        variant="outline"
                        className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800"
                    >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        開始測驗
                    </Button>
                     <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            onClick={handleShareQuiz}
                            disabled={isSharingQuiz || isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput}
                            variant="outline"
                            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
                          >
                            {isSharingQuiz ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                            {isSharingQuiz ? "處理中..." : "分享測驗"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>分享您的測驗</DialogTitle>
                            <DialogDesc>
                              透過以下臨時連結或QR Code分享此測驗給學生。
                            </DialogDesc>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            {isSharingQuiz && (
                               <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                <p className="ml-2 text-muted-foreground">正在生成臨時分享連結...</p>
                               </div>
                            )}
                            {!isSharingQuiz && currentShareLink && (
                              <>
                                <div className="space-y-1">
                                  <label htmlFor="share-link" className="text-sm font-medium">
                                    臨時分享連結
                                  </label>
                                  <div className="flex items-center space-x-2">
                                    <Input id="share-link" value={currentShareLink} readOnly className="flex-1" />
                                    <Button type="button" size="sm" onClick={handleCopyShareLink}>
                                      <Copy className="h-4 w-4 sm:mr-2" />
                                      <span className="hidden sm:inline">複製</span>
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-sm font-medium">QR Code</label>
                                  <div className="flex items-center justify-center p-4 border rounded-md bg-muted">
                                    <QRCodeSVG value={currentShareLink} size={192} bgColor={"#ffffff"} fgColor={"#000000"} level={"L"} includeMargin={false} />
                                  </div>
                                </div>
                              </>
                            )}
                            {!isSharingQuiz && !currentShareLink && (
                                 <p className="text-sm text-muted-foreground text-center py-2">點擊「分享測驗」按鈕以生成連結和QR Code。</p>
                            )}
                             <Alert variant="default" className="bg-yellow-50 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <AlertTitle className="text-yellow-700 dark:text-yellow-300">重要提示：臨時分享</AlertTitle>
                              <AlertDescription className="text-sm text-yellow-600 dark:text-yellow-500">
                                此分享連結是**臨時性的**，內容儲存在伺服器記憶體中。連結約在 **1 小時後或伺服器重啟/更新時失效**。
                                不適用於永久保存或非同步測驗。學生需在連結有效期內完成測驗。
                                在正式生產環境 (例如 Vercel)，此臨時分享的穩定性可能受限。
                              </AlertDescription>
                            </Alert>
                          </div>
                          <DialogFooter className="sm:justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsShareDialogOpen(false)} disabled={isSharingQuiz}>
                              關閉
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    <Button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf || isGeneratingExcel || isLoading || isGeneratingQuizResultsPdf || !generatedQuestionsOutput || (inputMode === 'image' && imageFiles.length === 0)}
                        variant="outline"
                        title={inputMode === 'text' ? '從純文字生成的題組目前不支援匯出為包含文本的 PDF。' : ''}
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
            
            {isQuizActive ? (
              <QuizView 
                questionsOutput={generatedQuestionsOutput} 
                imageFiles={imageFiles}
                inputText={inputText}
                onExitQuiz={handleExitQuiz}
                toast={toast}
                showFileGenerationProgress={handleShowQuizResultsPdfProgress}
                updateFileGenerationProgress={handleUpdateQuizResultsPdfProgress}
                isGeneratingQuizResultsPdf={isGeneratingQuizResultsPdf}
              />
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {generatedQuestionsOutput?.questions.map((q, index) => (
                  <QuestionCard 
                    key={index} 
                    questionItem={q} 
                    questionNumber={index + 1}
                    className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                    style={{ animationDelay: `${index * 80}ms` }}
                  />
                ))}
              </Accordion>
            )}
          </section>
        )}
      </main>
      
      <footer
        className="w-full max-w-3xl mt-16 mb-8 p-6 bg-foreground dark:bg-background rounded-xl shadow-lg text-center text-base text-background dark:text-foreground transition-all duration-300 ease-in-out hover:shadow-2xl hover:bg-foreground/90 dark:hover:bg-background/90"
      >
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

      <a
        href="https://document-ai-companion-ipad4.replit.app"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 left-4 sm:bottom-8 sm:left-8 z-50 flex items-center gap-2 h-12 px-4 bg-accent text-accent-foreground font-bold rounded-full shadow-lg hover:shadow-xl hover:bg-accent/80 transition-all duration-300 ease-in-out transform hover:scale-105"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm">創建專屬助手🦄</span>
      </a>

      <a
        href="https://line.me/R/ti/p/@733oiboa?oat_content=url&ts=05120012"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 flex items-center gap-2 h-12 px-4 bg-yellow-500 text-black font-bold rounded-full shadow-lg hover:shadow-xl hover:bg-yellow-400 transition-all duration-300 ease-in-out transform hover:scale-105"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm">點『石』成金🐝(評語優化)</span>
      </a>

    </div>
  );
}
    

    









    





    


    




    

    

    
