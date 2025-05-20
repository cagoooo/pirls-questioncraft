// src/app/quiz/[quizId]/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // Import from next/navigation for App Router
import { QuizView } from '@/components/QuizView';
import { type GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PirlsLogo } from '@/components/PirlsLogo';
import { useToast } from '@/hooks/use-toast'; // Import useToast

interface QuizData {
  questionsOutput: GeneratePirlsQuestionsOutput;
  imageFilesDataURIs: string[];
}

type ProgressCallback = (progress: number, message: string) => void;


export default function SharedQuizPage() {
  const params = useParams();
  const quizId = params?.quizId as string | undefined;

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingQuizResultsPdf, setIsGeneratingQuizResultsPdf] = useState(false);
  const [fileGenerationProgress, setFileGenerationProgress] useState(0);
  const [fileGenerationMessage, setFileGenerationMessage] useState('');
  
  const { toast } = useToast(); // Initialize useToast


  useEffect(() => {
    if (quizId) {
      const fetchQuizData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/share?quizId=${quizId}`);
          const data = await response.json();

          if (response.ok && data.success && data.quizData) {
            setQuizData(data.quizData);
          } else {
            throw new Error(data.error || '無法載入測驗，連結可能已失效或不存在。');
          }
        } catch (err: any) {
          console.error("載入分享測驗失敗:", err);
          setError(err.message || '發生未知錯誤，無法載入測驗。');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuizData();
    } else {
      setError('無效的測驗連結。');
      setIsLoading(false);
    }
  }, [quizId]);

  // Dummy progress callbacks for QuizView as results PDF generation is complex here
  const handleShowQuizResultsPdfProgress = (show: boolean) => {
    setIsGeneratingQuizResultsPdf(show);
    if (show) {
        // Placeholder: In a real scenario, you might want to show some UI feedback
        // For now, it just sets the state.
    }
  };

  const handleUpdateQuizResultsPdfProgress: ProgressCallback = (progress, message) => {
     setFileGenerationProgress(progress);
     setFileGenerationMessage(message);
    // Placeholder for progress update
  };


  if (isLoading) {
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
    return (
      <div className="container mx-auto p-4 sm:p-8 min-h-screen flex flex-col items-center">
         <header className="my-8 text-center">
            <PirlsLogo className="mx-auto mb-4 h-16 w-auto sm:h-20" />
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">PIRLS 線上測驗</h1>
        </header>
        <main className="w-full max-w-3xl">
          <QuizView
            questionsOutput={quizData.questionsOutput}
            imageFiles={[]} // Pass empty array as we are using data URIs
            imageFilesDataURIs={quizData.imageFilesDataURIs}
            onExitQuiz={() => {
                // For a shared quiz, "exit" might mean going back to a generic page or just disabling further interaction.
                // For simplicity, we can just show a message or redirect to home.
                toast({ title: "測驗已結束", description: "感謝您的參與！您可以關閉此頁面。" });
                // Or: window.location.href = '/';
            }}
            toast={toast}
            showFileGenerationProgress={handleShowQuizResultsPdfProgress} // Pass down
            updateFileGenerationProgress={handleUpdateQuizResultsPdfProgress} // Pass down
            isGeneratingQuizResultsPdf={isGeneratingQuizResultsPdf} // Pass down
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
        <p>未知狀態，請嘗試重新整理或返回首頁。</p>
         <Button asChild className="mt-4">
            <Link href="/">返回首頁</Link>
        </Button>
    </div>
  );
}
