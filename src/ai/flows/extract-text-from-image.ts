// src/ai/flows/extract-text-from-image.ts
'use server';

/**
 * @fileOverview Extracts text from an image using a Genkit flow.
 *
 * - extractTextFromImage - A function that handles the text extraction process.
 * - ExtractTextFromImageInput - The input type for the extractTextFromImage function.
 * - ExtractTextFromImageOutput - The return type for the extractTextFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTextFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to extract text from, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractTextFromImageInput = z.infer<typeof ExtractTextFromImageInputSchema>;

const ExtractTextFromImageOutputSchema = z.object({
  extractedText: z
    .string()
    .describe('The extracted text from the image, if extraction was successful.'),
  success: z.boolean().describe('Whether or not the text extraction was successful.'),
  error: z.string().optional().describe('If extraction was unsuccessful, the error message.'),
});
export type ExtractTextFromImageOutput = z.infer<typeof ExtractTextFromImageOutputSchema>;

export async function extractTextFromImage(input: ExtractTextFromImageInput): Promise<ExtractTextFromImageOutput> {
  return extractTextFromImageFlow(input);
}

const extractTextFromImagePrompt = ai.definePrompt({
  name: 'extractTextFromImagePrompt',
  input: {schema: ExtractTextFromImageInputSchema},
  output: {schema: ExtractTextFromImageOutputSchema},
  prompt: `Extract the text from the following image. If there is no text, or you cannot extract the text, return an empty string for extractedText and set success to false, including the error reason. If you successfully extracted the text, set success to true.

Image: {{media url=photoDataUri}}`,
});

const extractTextFromImageFlow = ai.defineFlow(
  {
    name: 'extractTextFromImageFlow',
    inputSchema: ExtractTextFromImageInputSchema,
    outputSchema: ExtractTextFromImageOutputSchema,
  },
  async input => {
    try {
      const {output} = await extractTextFromImagePrompt(input);
      return output!;
    } catch (error: any) {
      console.error('Error extracting text from image:', error);
      return {
        extractedText: '',
        success: false,
        error: error.message || 'Failed to extract text from image.',
      };
    }
  }
);
