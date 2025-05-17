// src/ai/flows/generate-pirls-questions.ts
'use server';

/**
 * @fileOverview Generates PIRLS-style multiple-choice questions based on text extracted from images.
 *
 * - generatePirlsQuestions - A function that generates PIRLS questions.
 * - GeneratePirlsQuestionsInput - The input type for the generatePirlsQuestions function.
 * - GeneratePirlsQuestionsOutput - The output type for the generatePirlsQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePirlsQuestionsInputSchema = z.object({
  extractedText: z
    .string()
    .describe('The extracted text from the uploaded images.'),
});
export type GeneratePirlsQuestionsInput = z.infer<typeof GeneratePirlsQuestionsInputSchema>;

const PirlsQuestionSchema = z.object({
  question: z.string().describe('The question text.'),
  options: z.array(z.string()).length(4).describe('Four answer options, only one correct.'),
  correctAnswerIndex: z
    .number()
    .min(0)
    .max(3)
    .describe('The index (0-3) of the correct answer in the options array.'),
  explanation: z
    .string()
    .describe('Explanation of why the answer is correct, with reference to the text.'),
  pirlsLevel: z
    .enum(['locate & retrieve', 'make straightforward inferences', 'interpret & integrate', 'evaluate & critique'])
    .describe('The PIRLS reading literacy level of the question.'),
});

const GeneratePirlsQuestionsOutputSchema = z.object({
  questions: z.array(PirlsQuestionSchema).length(8).describe('Eight PIRLS-style multiple-choice questions.'),
});

export type GeneratePirlsQuestionsOutput = z.infer<typeof GeneratePirlsQuestionsOutputSchema>;

export async function generatePirlsQuestions(
  input: GeneratePirlsQuestionsInput
): Promise<GeneratePirlsQuestionsOutput> {
  return generatePirlsQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePirlsQuestionsPrompt',
  input: {schema: GeneratePirlsQuestionsInputSchema},
  output: {schema: GeneratePirlsQuestionsOutputSchema},
  prompt: `You are an expert in designing questions for the PIRLS (Progress in International Reading Literacy Study) reading comprehension assessment.

  Your task is to generate eight multiple-choice questions based on the provided text. Each question should align with one of the four PIRLS reading literacy levels:

  1. Locate and Retrieve: These questions require students to find explicitly stated information within the text.
  2. Make Straightforward Inferences: These questions ask students to draw simple conclusions based on information presented in the text.
  3. Interpret and Integrate: These questions require students to combine information from different parts of the text to understand the author's meaning or purpose.
  4. Evaluate and Critique: These questions challenge students to assess the quality and credibility of the text.

  You must generate two questions for each of the four PIRLS levels, for a total of eight questions.

  Each question must have four answer options, with only one correct answer. Provide the index of the correct answer (0-3). Also, provide a brief explanation of why the chosen answer is correct, referencing the specific paragraph or sentence in the text where the answer can be found. Each question must also have a designated pirlsLevel.

  Text:
  {{extractedText}}

  Ensure the output is a valid JSON object conforming to the output schema.
  `,
});

const generatePirlsQuestionsFlow = ai.defineFlow(
  {
    name: 'generatePirlsQuestionsFlow',
    inputSchema: GeneratePirlsQuestionsInputSchema,
    outputSchema: GeneratePirlsQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
