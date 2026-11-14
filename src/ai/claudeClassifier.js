import Anthropic from '@anthropic-ai/sdk';
import { AiServiceError } from '../analysis/errors.js';
import { buildEmailContent, buildSystemPrompt, CLASSIFICATION_SCHEMA } from './prompt.js';

export class ClaudeClassifier {
  static DEFAULT_MODEL = 'claude-haiku-5-5';

  constructor({ apiKey, model = ClaudeClassifier.DEFAULT_MODEL, client = null }) {
    this.model = model;
    this.client = client ?? (apiKey ? new Anthropic({ apiKey, timeout: 20_000, maxRetries: 2 }) : null);
  }

  async classify(email, { today }) {
    if (!this.client) {
      throw new AiServiceError('ANTHROPIC_API_KEY is not configured');
    }

    let response;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: CLASSIFICATION_SCHEMA },
        },
        system: buildSystemPrompt(today),
        messages: [{ role: 'user', content: buildEmailContent(email) }],
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        const status = error.status ? ` (HTTP ${error.status})` : '';
        throw new AiServiceError(`AI service error${status}: ${error.message}`, { cause: error });
      }
      throw error;
    }

    if (response.stop_reason === 'refusal') {
      throw new AiServiceError('AI model declined to classify this email');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiServiceError('AI response was cut off before it was complete');
    }
    return response.content.find((block) => block.type === 'text')?.text ?? '';
  }
}
