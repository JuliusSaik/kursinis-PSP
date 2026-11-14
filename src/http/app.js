import express from 'express';
import path from 'node:path';
import { TaskNotFoundError } from '../integrations/mockTasksClient.js';

function tenantContext(tenants) {
  return (req, res, next) => {
    const tenant = tenants.findById(req.params.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    req.tenant = tenant;
    next();
  };
}

function requireText(body, fields) {
  return fields.filter((field) => typeof body?.[field] !== 'string' || body[field].trim() === '');
}

export function createApp({ tenants, emails, mailboxChecker, tasksClientFor, mockGmailFor, info }) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.resolve('client/dist')));

  app.get('/api/info', (req, res) => res.json(info()));
  app.get('/api/tenants', (req, res) => res.json(tenants.list()));

  const tenantRouter = express.Router({ mergeParams: true });
  app.use('/api/tenants/:tenantId', tenantContext(tenants), tenantRouter);

  tenantRouter.post('/check', async (req, res) => {
    try {
      res.json(await mailboxChecker.check(req.tenant));
    } catch (error) {
      res.status(502).json({ error: `Mailbox check failed: ${error.message}` });
    }
  });

  tenantRouter.get('/emails', (req, res) => res.json(emails.listByTenant(req.tenant.id)));

  tenantRouter.get('/emails/:messageId', (req, res) => {
    const email = emails.findByMessageId(req.tenant.id, req.params.messageId);
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json(email);
  });

  tenantRouter.get('/tasks', async (req, res) => {
    res.json(await tasksClientFor(req.tenant).listTasks());
  });

  if (mockGmailFor) {
    tenantRouter.post('/mock/inbox', (req, res) => {
      const missing = requireText(req.body, ['from', 'subject', 'body']);
      if (missing.length > 0) {
        return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
      }
      res.status(201).json(mockGmailFor(req.tenant).deliver(req.body));
    });

    tenantRouter.delete('/mock/tasks/:taskId', async (req, res) => {
      try {
        await tasksClientFor(req.tenant).deleteTask(req.params.taskId);
        res.status(204).end();
      } catch (error) {
        if (!(error instanceof TaskNotFoundError)) throw error;
        res.status(404).json({ error: error.message });
      }
    });
  }

  return app;
}
