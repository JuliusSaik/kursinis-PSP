import { ClaudeClassifier } from './claudeClassifier.js';
import { GeminiClassifier } from './geminiClassifier.js';
import { MockClassifier } from './mockClassifier.js';

// Every classifier implements classify(email, { today }) and returns the model's JSON answer.
// Failures are thrown as AiServiceError, so the analysis module never depends on a provider.
// A new provider only needs a class like these and one entry here.
const PROVIDERS = {
  mock: () => new MockClassifier(),
  claude: ({ model, apiKeys }) => new ClaudeClassifier({ apiKey: apiKeys.anthropic, model }),
  gemini: ({ model, apiKeys }) => new GeminiClassifier({ apiKey: apiKeys.gemini, model }),
};

export const AI_PROVIDERS = Object.freeze(Object.keys(PROVIDERS));

export function createClassifier({ provider, model, apiKeys }) {
  return PROVIDERS[provider]({ model: model || undefined, apiKeys });
}
