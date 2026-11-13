import fs from 'node:fs';
import { MockClassifier } from './ai/mockClassifier.js';
import { OpenAiClassifier } from './ai/openAiClassifier.js';
import { createClock } from './clock.js';
import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { MockGmailClient } from './integrations/mockGmailClient.js';
import { MockTasksClient } from './integrations/mockTasksClient.js';
import { JsonFileStore } from './integrations/stores.js';
import { MailboxChecker } from './mailbox/mailboxChecker.js';
import { openDatabase } from './storage/database.js';
import { EmailRepository } from './storage/emailRepository.js';
import { TenantRepository } from './storage/tenantRepository.js';

function readSeed(name) {
  return JSON.parse(fs.readFileSync(new URL(`../data/seed/${name}`, import.meta.url), 'utf8'));
}

function createClassifier(config) {
  return config.aiProvider === 'openai' ? new OpenAiClassifier(config.openAi) : new MockClassifier();
}

const config = loadConfig();
const clock = createClock(config);
const db = openDatabase(config.databasePath);

const tenants = new TenantRepository(db);
tenants.seed(readSeed('tenants.json'));
const emails = new EmailRepository(db);

const gmailStore = new JsonFileStore(config.mockGmailPath, readSeed('mock-gmail.json'));
const tasksStore = new JsonFileStore(config.mockTasksPath, {});
const mockGmailFor = (tenant) => new MockGmailClient({ store: gmailStore, tenantId: tenant.id, now: clock.now });
const tasksClientFor = (tenant) => new MockTasksClient({ store: tasksStore, tenantId: tenant.id });

const mailboxChecker = new MailboxChecker({
  emails,
  classifier: createClassifier(config),
  clock,
  mailClientFor: mockGmailFor,
  tasksClientFor,
});

const app = createApp({
  tenants,
  emails,
  mailboxChecker,
  tasksClientFor,
  mockGmailFor,
  info: () => ({ today: clock.today(), aiProvider: config.aiProvider, mockIntegrations: true }),
});

app.listen(config.port, () => {
  console.log(`PiEmail is running at http://localhost:${config.port} (AI provider: ${config.aiProvider}, today: ${clock.today()})`);
});
