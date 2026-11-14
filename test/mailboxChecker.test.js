import { describe, expect, it } from 'vitest';
import { MockClassifier } from '../src/ai/mockClassifier.js';
import { AiServiceError } from '../src/analysis/errors.js';
import { createTestSystem, inboxEmail, StubClassifier, TENANT_A } from './helpers.js';

const newsletter = inboxEmail({
  id: 'msg-news',
  threadId: 'thread-news',
  subject: 'Akcijos',
  body: 'Užsakykite dabar su nuolaida',
  labels: ['INBOX', 'CATEGORY_PROMOTIONS'],
  hasListUnsubscribe: true,
});

describe('MailboxChecker', () => {
  it('keeps one task per thread and updates it when a reply moves the deadline', async () => {
    const system = createTestSystem({
      classifier: new MockClassifier(),
      inbox: { [TENANT_A.id]: [inboxEmail(), newsletter] },
    });
    const tasks = system.tasksClientFor(TENANT_A);

    const first = await system.check(TENANT_A);
    expect(first.filteredOut).toBe(1);
    expect(first.processed).toHaveLength(1);

    const repeated = await system.check(TENANT_A);
    expect(repeated.processed).toHaveLength(0);

    system.clock.currentDay = '2026-10-07';
    system.mockGmailFor(TENANT_A).deliver({
      from: 'client@example.test',
      subject: 'Re: Stalviršių užsakymas',
      body: 'Atsiprašau, stalviršių reikia jau rytoj, spalio 8 d.',
      threadId: 'thread-1',
    });
    const reply = await system.check(TENANT_A);

    expect(reply.processed[0]).toMatchObject({ status: 'task_updated', priority: 'kritinis', score: 90 });
    expect(await tasks.listTasks()).toEqual([
      expect.objectContaining({ title: '[Kritinis] Patvirtinti užsakymą: Stalviršių užsakymas', due: '2026-10-07' }),
    ]);
    expect(system.emails.listByTenant(TENANT_A.id)).toHaveLength(2);
  });

  it('marks an email as failed when the AI fails and analyses it again on the next check', async () => {
    let aiAvailable = false;
    const classifier = new StubClassifier((email, context) => {
      if (!aiAvailable) throw new AiServiceError('AI service responded with HTTP 401');
      return new MockClassifier().classify(email, context);
    });
    const callback = inboxEmail({ subject: 'Pasiūlymas', body: 'Laba diena, ar galėtumėte man paskambinti dėl jūsų pasiūlymo?' });
    const system = createTestSystem({ classifier, inbox: { [TENANT_A.id]: [callback] } });

    const failed = await system.check(TENANT_A);
    expect(failed.processed[0]).toMatchObject({ status: 'analysis_failed', taskId: null });
    expect(await system.tasksClientFor(TENANT_A).listTasks()).toHaveLength(0);

    aiAvailable = true;
    const retried = await system.check(TENANT_A);

    expect(retried.processed[0]).toMatchObject({
      status: 'task_created',
      category: 'perskambinimas',
      score: 40,
      priority: 'aukstas',
      taskDue: '2026-10-06',
    });
    expect(system.emails.listByTenant(TENANT_A.id)).toHaveLength(1);
  });

  it('creates a new task when the linked one was deleted on the phone', async () => {
    const system = createTestSystem({ classifier: new MockClassifier(), inbox: { [TENANT_A.id]: [inboxEmail()] } });
    const tasks = system.tasksClientFor(TENANT_A);
    await system.check(TENANT_A);
    const [original] = await tasks.listTasks();
    await tasks.deleteTask(original.id);

    system.mockGmailFor(TENANT_A).deliver({
      from: 'client@example.test',
      subject: 'Re: Stalviršių užsakymas',
      body: 'Gal galite užsakymą pristatyti iki spalio 22 d.?',
      threadId: 'thread-1',
    });
    const result = await system.check(TENANT_A);

    expect(result.processed[0].status).toBe('task_created');
    const remaining = await tasks.listTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(original.id);
  });

  it('leaves the thread task unchanged when a reply needs no action', async () => {
    const system = createTestSystem({ classifier: new MockClassifier(), inbox: { [TENANT_A.id]: [inboxEmail()] } });
    await system.check(TENANT_A);
    const before = await system.tasksClientFor(TENANT_A).listTasks();

    system.mockGmailFor(TENANT_A).deliver({
      from: 'client@example.test',
      subject: 'Re: Stalviršių užsakymas',
      body: 'Ačiū, viskas aišku.',
      threadId: 'thread-1',
    });
    const result = await system.check(TENANT_A);

    expect(result.processed[0].status).toBe('no_action');
    expect(await system.tasksClientFor(TENANT_A).listTasks()).toEqual(before);
  });
});
