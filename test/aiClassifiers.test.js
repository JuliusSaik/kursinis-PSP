import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { ClaudeClassifier } from '../src/ai/claudeClassifier.js';
import { AI_PROVIDERS, createClassifier } from '../src/ai/createClassifier.js';
import { GeminiClassifier } from '../src/ai/geminiClassifier.js';
import { analyzeEmail } from '../src/analysis/analyzeEmail.js';
import { AiServiceError } from '../src/analysis/errors.js';
import { inboxEmail } from './helpers.js';

const TODAY = '2026-10-05';

const ORDER_ANSWER = JSON.stringify({
  category: 'uzsakymas',
  actionRequired: true,
  actionText: 'Patvirtinti užsakymą',
  deadline: '2026-10-20',
  confidence: 0.9,
});

const NO_ACTION_ANSWER = JSON.stringify({
  category: 'kita',
  actionRequired: false,
  actionText: '',
  deadline: '',
  confidence: 0.8,
});

// Each provider gets a fake SDK client that answers like the real API, so the same
// expectations run against every classifier without network calls.
const PROVIDER_FAKES = {
  claude: {
    create: (client) => new ClaudeClassifier({ client }),
    method: (client) => client.messages,
    methodName: 'create',
    answer: (text) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] }),
    truncated: () => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"cat' }] }),
    declined: () => ({ stop_reason: 'refusal', content: [] }),
    httpError: () => new Anthropic.AuthenticationError(401, { error: { message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers()),
    sentEmail: (params) => JSON.parse(params.messages[0].content),
    sentSystem: (params) => params.system,
    withoutKey: () => new ClaudeClassifier({ apiKey: '' }),
    keyName: 'ANTHROPIC_API_KEY',
  },
  gemini: {
    create: (client) => new GeminiClassifier({ client }),
    method: (client) => client.models,
    methodName: 'generateContent',
    answer: (text) => ({ text, candidates: [{ finishReason: 'STOP' }] }),
    truncated: () => ({ text: '{"cat', candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    declined: () => ({ text: undefined, candidates: [], promptFeedback: { blockReason: 'SAFETY' } }),
    httpError: () => new ApiError({ message: 'API key not valid', status: 401 }),
    sentEmail: (params) => JSON.parse(params.contents),
    sentSystem: (params) => params.config.systemInstruction,
    withoutKey: () => new GeminiClassifier({ apiKey: '' }),
    keyName: 'GEMINI_API_KEY',
  },
};

function fakeClient(fake, respond) {
  const calls = [];
  const client = { messages: {}, models: {} };
  fake.method(client)[fake.methodName] = async (params) => {
    calls.push(params);
    return respond(params);
  };
  return { client, calls };
}

const classifyWith = (fake, respond) =>
  fake.create(fakeClient(fake, respond).client).classify(inboxEmail(), { today: TODAY });

describe.each(Object.entries(PROVIDER_FAKES))('%s classifier', (provider, fake) => {
  it('sends the email and today to the model and its answer drives the business rules', async () => {
    const { client, calls } = fakeClient(fake, () => fake.answer(ORDER_ANSWER));

    const { ok, result } = await analyzeEmail(inboxEmail(), { classifier: fake.create(client), today: TODAY });

    expect(ok).toBe(true);
    expect(result).toMatchObject({ category: 'uzsakymas', score: 50, priority: 'aukstas', taskDue: '2026-10-16' });
    expect(fake.sentSystem(calls[0])).toContain(`Today is ${TODAY}.`);
    expect(fake.sentEmail(calls[0]).body).toBe(inboxEmail().body);
  });

  it('treats an empty deadline from the model as no deadline', async () => {
    const { client } = fakeClient(fake, () => fake.answer(NO_ACTION_ANSWER));
    const { result } = await analyzeEmail(inboxEmail(), { classifier: fake.create(client), today: TODAY });

    expect(result).toMatchObject({ deadline: null, taskDecision: 'none' });
  });

  it('turns API errors, blocked and cut off answers and a missing key into AI service errors', async () => {
    const failing = () => {
      throw fake.httpError();
    };
    await expect(classifyWith(fake, failing)).rejects.toThrow(AiServiceError);
    await expect(classifyWith(fake, failing)).rejects.toThrow(/HTTP 401/);
    await expect(classifyWith(fake, fake.declined)).rejects.toThrow(/declined/);
    await expect(classifyWith(fake, fake.truncated)).rejects.toThrow(/cut off/);
    await expect(fake.withoutKey().classify(inboxEmail(), { today: TODAY })).rejects.toThrow(fake.keyName);
  });
});

describe('createClassifier', () => {
  it('builds the configured provider with its default model unless AI_MODEL overrides it', () => {
    const apiKeys = { anthropic: '', gemini: '' };

    expect(AI_PROVIDERS).toEqual(['mock', 'claude', 'gemini']);
    expect(createClassifier({ provider: 'gemini', model: '', apiKeys }).model).toBe(GeminiClassifier.DEFAULT_MODEL);
    expect(createClassifier({ provider: 'claude', model: '', apiKeys }).model).toBe(ClaudeClassifier.DEFAULT_MODEL);
    expect(createClassifier({ provider: 'gemini', model: 'gemini-3.8-flash', apiKeys }).model).toBe('gemini-3.8-flash');
  });
});
