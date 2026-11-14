import fs from 'node:fs';
import { createClassifier } from './ai/createClassifier.js';
import { GoogleAuth } from './auth/googleAuth.js';
import { createClock } from './clock.js';
import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { GoogleGmailClient } from './integrations/googleGmailClient.js';
import { GoogleTasksClient } from './integrations/googleTasksClient.js';
import { MockGmailClient } from './integrations/mockGmailClient.js';
import { MockTasksClient } from './integrations/mockTasksClient.js';
import { JsonFileStore } from './integrations/stores.js';
import { MailboxChecker } from './mailbox/mailboxChecker.js';
import { openDatabase } from './storage/database.js';
import { EmailRepository } from './storage/emailRepository.js';
import { AuthProvider, TenantRepository } from './storage/tenantRepository.js';

function readSeed(name) {
  return JSON.parse(fs.readFileSync(new URL(`../data/seed/${name}`, import.meta.url), 'utf8'));
}

function googleTenants(accounts) {
  return accounts.map((email) => ({ id: email, name: email, mailboxAddress: email, authProvider: AuthProvider.GOOGLE }));
}

const config = loadConfig();
const clock = createClock(config);
const db = openDatabase(config.databasePath);

const tenants = new TenantRepository(db);
tenants.seed([...readSeed('tenants.json'), ...googleTenants(config.google.accounts)]);
const emails = new EmailRepository(db);
const classifier = createClassifier(config.ai);
const googleAuth = new GoogleAuth(config.google);

const gmailStore = new JsonFileStore(config.mockGmailPath, readSeed('mock-gmail.json'));
const tasksStore = new JsonFileStore(config.mockTasksPath, {});

function integrationsFor(tenant, session) {
  if (tenant.authProvider === AuthProvider.GOOGLE) {
    const auth = googleAuth.clientFor(session.googleTokens, (tokens) => {
      session.googleTokens = tokens;
    });
    return { mail: new GoogleGmailClient({ auth }), tasks: new GoogleTasksClient({ auth }) };
  }
  return {
    mail: new MockGmailClient({ store: gmailStore, tenantId: tenant.id, now: clock.now }),
    tasks: new MockTasksClient({ store: tasksStore, tenantId: tenant.id }),
  };
}

const app = createApp({
  tenants,
  emails,
  mailboxChecker: new MailboxChecker({ emails, classifier, clock }),
  integrationsFor,
  googleAuth,
  sessionSecret: config.sessionSecret,
  demoLogin: config.demoLogin,
  info: () => ({ today: clock.today(), aiProvider: config.ai.provider, aiModel: classifier.model ?? null }),
});

app.listen(config.port, () => {
  const google = googleAuth.isEnabled ? `on (${config.google.accounts.length} accounts)` : 'off';
  console.log(`PiEmail is running at http://localhost:${config.port} (AI: ${config.ai.provider}${classifier.model ? ` ${classifier.model}` : ''}, Google login: ${google}, today: ${clock.today()})`);
});
