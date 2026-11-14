import path from 'node:path';
import { isValidIsoDate } from './analysis/dates.js';

const AI_PROVIDERS = ['mock', 'openai'];

export function loadConfig(env = process.env) {
  const aiProvider = env.AI_PROVIDER || 'mock';
  if (!AI_PROVIDERS.includes(aiProvider)) {
    throw new Error(`AI_PROVIDER must be one of: ${AI_PROVIDERS.join(', ')}`);
  }

  const fixedToday = env.APP_TODAY || null;
  if (fixedToday && !isValidIsoDate(fixedToday)) {
    throw new Error('APP_TODAY must be a date in YYYY-MM-DD format');
  }

  const dataDir = path.resolve(env.DATA_DIR || 'data/runtime');

  return {
    port: Number(env.PORT) || 3000,
    timeZone: env.TIME_ZONE || 'Europe/Vilnius',
    fixedToday,
    aiProvider,
    openAi: {
      apiKey: env.OPENAI_API_KEY || '',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    databasePath: path.join(dataDir, 'piemail.db'),
    mockGmailPath: path.join(dataDir, 'mock-gmail.json'),
    mockTasksPath: path.join(dataDir, 'mock-tasks.json'),
  };
}
