import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MockClassifier } from '../src/ai/mockClassifier.js';
import { createApp } from '../src/http/app.js';
import { createTestSystem, inboxEmail, TENANT_A, TENANT_B } from './helpers.js';

function createTestApp() {
  const system = createTestSystem({
    classifier: new MockClassifier(),
    inbox: {
      [TENANT_A.id]: [inboxEmail({ id: 'msg-a', threadId: 'shared-thread' })],
      [TENANT_B.id]: [inboxEmail({ id: 'msg-b', threadId: 'shared-thread', body: 'Kiek kainuoja kirpimas?' })],
    },
  });
  const app = createApp({ ...system, info: () => ({}) });
  return { app, system };
}

describe('tenant isolation', () => {
  it('does not let one tenant read or change another tenant data', async () => {
    const { app, system } = createTestApp();
    await request(app).post(`/api/tenants/${TENANT_A.id}/check`).expect(200);
    await request(app).post(`/api/tenants/${TENANT_B.id}/check`).expect(200);

    const emailsOfB = await request(app).get(`/api/tenants/${TENANT_B.id}/emails`).expect(200);
    expect(emailsOfB.body.map((email) => email.messageId)).toEqual(['msg-b']);

    await request(app).get(`/api/tenants/${TENANT_B.id}/emails/msg-a`).expect(404);

    const [taskOfA] = (await request(app).get(`/api/tenants/${TENANT_A.id}/tasks`)).body;
    await request(app).delete(`/api/tenants/${TENANT_B.id}/mock/tasks/${taskOfA.id}`).expect(404);

    const tasksOfA = await system.tasksClientFor(TENANT_A).listTasks();
    const tasksOfB = await system.tasksClientFor(TENANT_B).listTasks();
    expect(tasksOfA).toEqual([taskOfA]);
    expect(tasksOfB).toHaveLength(1);
    expect(tasksOfB[0].id).not.toBe(taskOfA.id);
    expect(system.emails.findThreadTaskId(TENANT_B.id, 'shared-thread')).toBe(tasksOfB[0].id);
  });

  it('rejects requests for an unknown tenant', async () => {
    const { app } = createTestApp();
    await request(app).post('/api/tenants/unknown/check').expect(404);
  });
});
