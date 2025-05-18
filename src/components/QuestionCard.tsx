
"use client";

import type { GeneratePirlsQuestionsOutput } from '@/ai/flows/generate-pirls-questions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileSearch, Lightbulb, Blocks, GraduationCap, CheckCircle2 } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

type PirlsQuestion = GeneratePirlsQuestionsOutput['questions'][0];

interface QuestionCardProps {
  questionItem: PirlsQuestion;
  questionNumber: number;
}

const pirlsLevelDetails: Record<PirlsQuestion['pirlsLevel'], { label: string; icon: React.ElementType; badgeVariant: VariantProps<typeof badgeVariants>['variant'], borderColorClass: string }> = {
  'locate & retrieve': { label: '訊息提取與檢索', icon: FileSearch, badgeVariant: 'pirlsLocate', borderColorClass: 'border-blue-500' },
  'make straightforward inferences': { label: '直接推論', icon: Lightbulb, badgeVariant: 'pirlsInfer', borderColorClass: 'border-green-500' },
  'interpret & integrate': { label: '詮釋與整合', icon: Blocks, badgeVariant: 'pirlsInterpret', borderColorClass: 'border-yellow-500' },
  'evaluate & critique': { label: '評估與批判', icon: GraduationCap, badgeVariant: 'pirlsEvaluate', borderColorClass: 'border-purple-500' },
};

const optionLabels = ['A', 'B', 'C', 'D'];

export function QuestionCard({ questionItem, questionNumber }: QuestionCardProps) {
  const levelDetail = pirlsLevelDetails[questionItem.pirlsLevel];
  const IconComponent = levelDetail.icon;

  return (
    <AccordionItem value={`item-${questionNumber}`} className="border-b-0">
      <Card className={cn(
        "mb-4 shadow-md hover:shadow-lg transition-shadow duration-200 border-l-4",
        levelDetail.borderColorClass
      )}>
        <AccordionTrigger className="hover:no-underline p-4">
          <div className="flex flex-row justify-between items-start w-full">
            <div>
              <CardTitle className="text-lg mb-1 text-left">題目 {questionNumber}: {questionItem.question}</CardTitle>
              <Badge variant={levelDetail.badgeVariant} className="text-xs font-semibold">
                <IconComponent className="h-3 w-3 mr-1.5" />
                {levelDetail.label}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              <p className="font-semibold text-sm text-muted-foreground">答案選項：</p>
              <ul className="space-y-2">
                {questionItem.options.map((option, index) => (
                  <li
                    key={index}
                    className={`flex items-start p-3 rounded-md border ${
                      index === questionItem.correctAnswerIndex
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-border'
                    }`}
                  >
                    {index === questionItem.correctAnswerIndex ? (
                      <CheckCircle2 className="h-5 w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <span className="mr-2 text-muted-foreground font-medium w-5 text-center flex-shrink-0 mt-0.5">{optionLabels[index]}.</span>
                    )}
                    <span className="text-sm">{option}</span>
                  </li>
                ))}
              </ul>
              <div>
                <p className="font-semibold text-sm mt-4 mb-1">
                  正確答案：
                  <Badge variant="default" className="ml-2 bg-green-600 hover:bg-green-700">
                    {optionLabels[questionItem.correctAnswerIndex]}
                  </Badge>
                </p>
                <CardDescription className="text-sm whitespace-pre-wrap p-3 bg-muted/50 rounded-md">
                  <span className="font-semibold">說明：</span>
                  {questionItem.explanation}
                </CardDescription>
              </div>
            </div>
          </CardContent>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
