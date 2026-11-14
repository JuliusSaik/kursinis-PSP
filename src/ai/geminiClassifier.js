import { ApiError, GoogleGenAI } from '@google/genai';
import { AiServiceError } from '../analysis/errors.js';
import { buildEmailContent, buildSystemPrompt, CLASSIFICATION_SCHEMA } from './prompt.js';

export class GeminiClassifier {
  static DEFAULT_MODEL = 'gemini-3.5-flash-lite';

  constructor({ apiKey, model = GeminiClassifier.DEFAULT_MODEL, client = null }) {
    this.model = model;
    this.client = client ?? (apiKey ? new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } }) : null);
  }

  async classify(email, { today }) {
    if (!this.client) {
      throw new AiServiceError('GEMINI_API_KEY is not configured');
    }

    let response;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: buildEmailContent(email),
        config: {
          systemInstruction: buildSystemPrompt(today),
          responseMimeType: 'application/json',
          responseJsonSchema: CLASSIFICATION_SCHEMA,
          maxOutputTokens: 2048,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw new AiServiceError(`AI service error (HTTP ${error.status}): ${error.message}`, { cause: error });
      }
      throw new AiServiceError(`AI service is unreachable: ${error.message}`, { cause: error });
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new AiServiceError('AI response was cut off before it was complete');
    }
    if (response.promptFeedback?.blockReason || (finishReason && finishReason !== 'STOP')) {
      throw new AiServiceError('AI model declined to classify this email');
    }
    return response.text ?? '';
  }
}
