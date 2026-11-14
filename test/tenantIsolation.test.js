import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { MockClassifier } from '../src/ai/mockClassifier.js';
import { createTestApp, createTestSystem, FakeGoogleAuth, GOOGLE_TENANT, inboxEmail, TENANT_A, TENANT_B } from './helpers.js';

function createSystem() {
  return createTestSystem({
    classifier: new MockClassifier(),
    inbox: {
      [TENANT_A.id]: [inboxEmail({ id: 'msg-a', threadId: 'shared-thread' })],
      [TENANT_B.id]: [inboxEmail({ id: 'msg-b', threadId: 'shared-thread', body: 'Kiek kainuoja kirpimas?' })],
    },
  });
}

async function signInAsDemo(app, tenant) {
  const agent = request.agent(app);
  await agent.post(`/auth/demo/${tenant.id}`).expect(200);
  return agent;
}

async function signInWithGoogle(app) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/google').expect(302);
  const state = new URL(start.headers.location).searchParams.get('state');
  return { agent, callback: await agent.get(`/auth/google/callback?code=test-code&state=${state}`).expect(302) };
}

describe('tenant isolation', () => {
  it('shows a signed-in tenant only its own emails and tasks', async () => {
    const system = createSystem();
    const app = createTestApp(system);
    const agentA = await signInAsDemo(app, TENANT_A);
    const agentB = await signInAsDemo(app, TENANT_B);
    await agentA.post('/api/check').expect(200);
    await agentB.post('/api/check').expect(200);

    const emailsOfB = await agentB.get('/api/emails').expect(200);
    expect(emailsOfB.body.map((email) => email.messageId)).toEqual(['msg-b']);
    await agentB.get('/api/emails/msg-a').expect(404);

    const [taskOfA] = (await agentA.get('/api/tasks')).body;
    await agentB.delete(`/api/tasks/${taskOfA.id}`).expect(404);

    const tasksOfA = await system.tasksClientFor(TENANT_A).listTasks();
    const tasksOfB = await system.tasksClientFor(TENANT_B).listTasks();
    expect(tasksOfA).toEqual([taskOfA]);
    expect(tasksOfB).toHaveLength(1);
    expect(tasksOfB[0].id).not.toBe(taskOfA.id);
    expect(system.emails.findThreadTaskId(TENANT_B.id, 'shared-thread')).toBe(tasksOfB[0].id);
  });

  it('rejects requests without a signed-in tenant', async () => {
    const app = createTestApp(createSystem());
    await request(app).post('/api/check').expect(401);
    await request(app).get('/api/emails').expect(401);
  });

  it('does not allow demo login into a Google tenant', async () => {
    const app = createTestApp(createSystem());
    await request(app).post(`/auth/demo/${encodeURIComponent(GOOGLE_TENANT.id)}`).expect(403);
  });

  it('signs a registered Google account into its own tenant only', async () => {
    const app = createTestApp(createSystem());
    const { agent, callback } = await signInWithGoogle(app);

    expect(callback.headers.location).toBe('/');
    const session = await agent.get('/api/session').expect(200);
    expect(session.body.tenant).toMatchObject({ id: GOOGLE_TENANT.id, authProvider: 'google' });
  });

  it('refuses a Google account that is not registered as a tenant', async () => {
    const app = createTestApp(createSystem(), { googleAuth: new FakeGoogleAuth('stranger@gmail.test') });
    const { agent, callback } = await signInWithGoogle(app);

    expect(callback.headers.location).toBe('/?loginError=not_registered');
    const session = await agent.get('/api/session').expect(200);
    expect(session.body.tenant).toBeNull();
    await agent.get('/api/emails').expect(401);
  });

  it('rejects a Google callback with a forged state', async () => {
    const app = createTestApp(createSystem());
    const agent = request.agent(app);
    await agent.get('/auth/google').expect(302);
    const callback = await agent.get('/auth/google/callback?code=test-code&state=forged').expect(302);

    expect(callback.headers.location).toBe('/?loginError=google');
  });
});
