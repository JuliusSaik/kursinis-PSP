import path from 'node:path';
import { AI_PROVIDERS } from './ai/createClassifier.js';
import { isValidIsoDate } from './analysis/dates.js';

function parseList(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const aiProvider = env.AI_PROVIDER || 'mock';
  if (!AI_PROVIDERS.includes(aiProvider)) {
    throw new Error(`AI_PROVIDER must be one of: ${AI_PROVIDERS.join(', ')}`);
  }

  const fixedToday = env.APP_TODAY || null;
  if (fixedToday && !isValidIsoDate(fixedToday)) {
    throw new Error('APP_TODAY must be a date in YYYY-MM-DD format');
  }

  const port = Number(env.PORT) || 3000;
  const publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
  const dataDir = path.resolve(env.DATA_DIR || 'data/runtime');

  return {
    port,
    timeZone: env.TIME_ZONE || 'Europe/Vilnius',
    fixedToday,
    sessionSecret: env.SESSION_SECRET || 'piemail-dev-secret',
    demoLogin: env.DEMO_LOGIN !== 'false',
    ai: {
      provider: aiProvider,
      model: env.AI_MODEL || '',
      apiKeys: {
        anthropic: env.ANTHROPIC_API_KEY || '',
        gemini: env.GEMINI_API_KEY || '',
      },
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${publicUrl}/auth/google/callback`,
      accounts: parseList(env.GOOGLE_ACCOUNTS),
    },
    databasePath: path.join(dataDir, 'piemail.db'),
    mockGmailPath: path.join(dataDir, 'mock-gmail.json'),
    mockTasksPath: path.join(dataDir, 'mock-tasks.json'),
  };
}
