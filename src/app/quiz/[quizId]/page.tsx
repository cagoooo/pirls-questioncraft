
// src/app/quiz/[quizId]/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QuizView } from '@/components/QuizView';
import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PirlsLogo } from '@/components/PirlsLogo';
import { useToast } from '@/hooks/use-toast';

interface QuizData {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs: string[];
}

type ProgressCallback = (progress: number, message: string) => void;

export default function SharedQuizPage() {
  console.log('SharedQuizPage: Component rendering started');
  const params = useParams();
  const quizId = params?.quizId as string | undefined;
  console.log('SharedQuizPage: quizId from params:', quizId);

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingQuizResultsPdf, setIsGeneratingQuizResultsPdf] = useState(false);
  const [fileGenerationProgress, setFileGenerationProgress] = useState(0);
  const [fileGenerationMessage, setFileGenerationMessage] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    console.log('SharedQuizPage: useEffect triggered. quizId:', quizId);
    if (quizId) {
      const fetchQuizData = async () => {
        console.log('SharedQuizPage: fetchQuizData called for quizId:', quizId);
        setIsLoading(true);
        setError(null);
        setQuizData(null); // Reset quizData before fetching
        try {
          const response = await fetch(`/api/share?quizId=${quizId}`);
          console.log('SharedQuizPage: API response status:', response.status);
          const data = await response.json();
          console.log('SharedQuizPage: API response data:', data);

          if (response.ok && data.success && data.quizData) {
            console.log('SharedQuizPage: Quiz data fetched successfully');
            setQuizData(data.quizData);
          } else {
            console.error('SharedQuizPage: Failed to fetch quiz data or data invalid. Response OK:', response.ok, 'Data Success:', data.success, 'QuizData present:', !!data.quizData);
            throw new Error(data.error || '無法載入測驗，連結可能已失效或不存在。');
          }
        } catch (err: any) {
          console.error("SharedQuizPage: 載入分享測驗失敗:", err);
          setError(err.message || '發生未知錯誤，無法載入測驗。');
        } finally {
          console.log('SharedQuizPage: fetchQuizData finally block. Setting isLoading to false.');
          setIsLoading(false);
        }
      };
      fetchQuizData();
    } else {
      console.log('SharedQuizPage: quizId is missing. Setting error.');
      setError('無效的測驗連結。');
      setIsLoading(false);
    }
  }, [quizId]);

  const handleShowQuizResultsPdfProgress = (show: boolean) => {
    setIsGeneratingQuizResultsPdf(show);
  };

  const handleUpdateQuizResultsPdfProgress: ProgressCallback = (progress, message) => {
     setFileGenerationProgress(progress);
     setFileGenerationMessage(message);
  };

  console.log('SharedQuizPage: Rendering. isLoading:', isLoading, 'error:', error, 'quizData is null:', quizData === null);

  if (isLoading) {
    console.log('SharedQuizPage: Rendering loading state');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold">載入測驗中...</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-muted-foreground">請稍候，正在為您準備測驗內容。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    console.log('SharedQuizPage: Rendering error state:', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-xl font-semibold text-destructive">載入失敗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>錯誤</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild className="w-full">
              <Link href="/">返回首頁</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quizData) {
    console.log('SharedQuizPage: Rendering QuizView with quizData');
    return (
      <div className="container mx-auto p-4 sm:p-8 min-h-screen flex flex-col items-center">
         <header className="my-8 text-center">
            <PirlsLogo className="mx-auto mb-4 h-16 w-auto sm:h-20" />
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">PIRLS 線上測驗</h1>
        </header>
        <main className="w-full max-w-3xl">
          <QuizView
            questionsOutput={quizData.questionsOutput}
            imageFiles={[]}
            imageFilesDataURIs={quizData.imageFilesDataURIs}
            onExitQuiz={() => {
                toast({ title: "測驗已結束", description: "感謝您的參與！您可以關閉此頁面。" });
            }}
            toast={toast}
            showFileGenerationProgress={handleShowQuizResultsPdfProgress}
            updateFileGenerationProgress={handleUpdateQuizResultsPdfProgress}
            isGeneratingQuizResultsPdf={isGeneratingQuizResultsPdf}
          />
        </main>
      </div>
    );
  }
  
  console.log('SharedQuizPage: Rendering fallback state (unknown state)');
  return (
    <div className="flex items-center justify-center min-h-screen">
        <p>未知狀態，請嘗試重新整理或返回首頁。</p>
         <Button asChild className="mt-4">
            <Link href="/">返回首頁</Link>
        </Button>
    </div>
  );
}
