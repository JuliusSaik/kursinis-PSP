import { MockGmailClient } from '../src/integrations/mockGmailClient.js';
import { MockTasksClient } from '../src/integrations/mockTasksClient.js';
import { MemoryStore } from '../src/integrations/stores.js';
import { MailboxChecker } from '../src/mailbox/mailboxChecker.js';
import { openDatabase } from '../src/storage/database.js';
import { EmailRepository } from '../src/storage/emailRepository.js';
import { createApp } from '../src/http/app.js';
import { AuthProvider, TenantRepository } from '../src/storage/tenantRepository.js';

export const TENANT_A = { id: 'tenant-a', name: 'Tenant A', mailboxAddress: 'owner@a.test', authProvider: AuthProvider.DEMO };
export const TENANT_B = { id: 'tenant-b', name: 'Tenant B', mailboxAddress: 'owner@b.test', authProvider: AuthProvider.DEMO };
export const GOOGLE_TENANT = {
  id: 'owner@gmail.test',
  name: 'owner@gmail.test',
  mailboxAddress: 'owner@gmail.test',
  authProvider: AuthProvider.GOOGLE,
};

export class StubClassifier {
  constructor(responder) {
    this.responder = responder;
  }

  async classify(email, context) {
    return this.responder(email, context);
  }
}

export function inboxEmail(overrides = {}) {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    from: 'client@example.test',
    subject: 'Stalviršių užsakymas',
    body: 'Norėčiau užsakyti 3 stalviršius iki spalio 20 d.',
    receivedAt: '2026-10-05T06:00:00.000Z',
    labels: ['INBOX'],
    hasListUnsubscribe: false,
    ...overrides,
  };
}

export function createTestSystem({ classifier, today = '2026-10-05', inbox = {} }) {
  const db = openDatabase(':memory:');
  const tenants = new TenantRepository(db);
  tenants.seed([TENANT_A, TENANT_B, GOOGLE_TENANT]);
  const emails = new EmailRepository(db);

  let tick = Date.parse('2026-11-01T00:00:00.000Z');
  const clock = {
    currentDay: today,
    today: () => clock.currentDay,
    now: () => new Date((tick += 1000)),
  };
  const gmailStore = new MemoryStore(inbox);
  const tasksStore = new MemoryStore({});
  const mockGmailFor = (tenant) => new MockGmailClient({ store: gmailStore, tenantId: tenant.id, now: clock.now });
  const tasksClientFor = (tenant) => new MockTasksClient({ store: tasksStore, tenantId: tenant.id });
  const integrationsFor = (tenant) => ({ mail: mockGmailFor(tenant), tasks: tasksClientFor(tenant) });

  const mailboxChecker = new MailboxChecker({ emails, classifier, clock });
  const check = (tenant) => mailboxChecker.check(tenant, integrationsFor(tenant));

  return { tenants, emails, clock, mailboxChecker, check, integrationsFor, mockGmailFor, tasksClientFor };
}

export class FakeGoogleAuth {
  constructor(email) {
    this.email = email;
    this.isEnabled = true;
  }

  authUrl(state) {
    return `https://accounts.google.test/auth?state=${state}`;
  }

  async exchangeCode() {
    return { email: this.email, tokens: { access_token: 'test-token' } };
  }
}

export function createTestApp(system, { googleAuth = new FakeGoogleAuth(GOOGLE_TENANT.mailboxAddress) } = {}) {
  return createApp({
    ...system,
    googleAuth,
    sessionSecret: 'test-secret',
    demoLogin: true,
    info: () => ({}),
  });
}
