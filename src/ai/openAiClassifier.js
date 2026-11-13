import { AiServiceError } from '../analysis/errors.js';
import { buildClassificationMessages } from './prompt.js';

export class OpenAiClassifier {
  constructor({ apiKey, model, baseUrl = 'https://api.openai.com/v1', timeoutMs = 20000, fetchFn = fetch }) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
  }

  async classify(email, { today }) {
    if (!this.apiKey) {
      throw new AiServiceError('OPENAI_API_KEY is not configured');
    }

    let response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: buildClassificationMessages(email, today),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AiServiceError(`AI service is unreachable: ${error.message}`, { cause: error });
    }

    if (!response.ok) {
      throw new AiServiceError(`AI service responded with HTTP ${response.status}`);
    }

    const payload = await response.json();
    return payload.choices?.[0]?.message?.content ?? '';
  }
}
