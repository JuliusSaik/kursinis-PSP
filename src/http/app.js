import express from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { TaskNotFoundError } from '../integrations/mockTasksClient.js';
import { AuthProvider } from '../storage/tenantRepository.js';

const SESSION_COOKIE = 'piemail.sid';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function requireText(body, fields) {
  return fields.filter((field) => typeof body?.[field] !== 'string' || body[field].trim() === '');
}

// A new session ID on login prevents session fixation.
function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

function isGoogleAuthError(error) {
  return error.response?.status === 401 || error.response?.data?.error === 'invalid_grant';
}

// The tenant always comes from the server-side session, never from the request, so a signed-in
// user cannot reach another tenant's data by changing a URL or an ID.
function requireTenant(tenants) {
  return (req, res, next) => {
    const tenant = req.session.tenantId ? tenants.findById(req.session.tenantId) : null;
    if (!tenant) {
      return res.status(401).json({ error: 'Not signed in' });
    }
    req.tenant = tenant;
    next();
  };
}

export function createApp({ tenants, emails, mailboxChecker, integrationsFor, googleAuth, sessionSecret, demoLogin, info }) {
  const app = express();
  app.use(express.json());
  app.use(session({
    name: SESSION_COOKIE,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_MS },
  }));
  app.use(express.static(path.resolve('client/dist')));

  async function startSession(req, tenant, googleTokens = null) {
    await regenerateSession(req);
    req.session.tenantId = tenant.id;
    req.session.googleTokens = googleTokens;
  }

  app.get('/auth/google', (req, res) => {
    if (!googleAuth.isEnabled) {
      return res.status(404).json({ error: 'Google login is not configured' });
    }
    const state = randomBytes(16).toString('hex');
    req.session.oauthState = state;
    res.redirect(googleAuth.authUrl(state));
  });

  app.get('/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    const expectedState = req.session.oauthState;
    delete req.session.oauthState;
    if (!code || !state || state !== expectedState) {
      return res.redirect('/?loginError=google');
    }

    let account;
    try {
      account = await googleAuth.exchangeCode(code);
    } catch (error) {
      console.error('Google login failed:', error.message);
      return res.redirect('/?loginError=google');
    }

    const tenant = tenants.findGoogleTenantByEmail(account.email);
    if (!tenant) {
      return res.redirect('/?loginError=not_registered');
    }
    await startSession(req, tenant, account.tokens);
    res.redirect('/');
  });

  app.post('/auth/demo/:tenantId', async (req, res) => {
    const tenant = demoLogin ? tenants.findById(req.params.tenantId) : null;
    if (tenant?.authProvider !== AuthProvider.DEMO) {
      return res.status(403).json({ error: 'Demo login is not available for this tenant' });
    }
    await startSession(req, tenant);
    res.json(tenant);
  });

  app.post('/auth/logout', (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(SESSION_COOKIE).status(204).end();
    });
  });

  app.get('/api/info', (req, res) => res.json(info()));

  app.get('/api/session', (req, res) => {
    res.json({
      tenant: req.session.tenantId ? tenants.findById(req.session.tenantId) : null,
      googleLogin: googleAuth.isEnabled,
      demoTenants: demoLogin ? tenants.listDemoTenants() : [],
    });
  });

  const api = express.Router();
  api.use(requireTenant(tenants));
  api.use((req, res, next) => {
    req.integrations = integrationsFor(req.tenant, req.session);
    next();
  });

  api.post('/check', async (req, res) => {
    res.json(await mailboxChecker.check(req.tenant, req.integrations));
  });

  api.get('/emails', (req, res) => res.json(emails.listByTenant(req.tenant.id)));

  api.get('/emails/:messageId', (req, res) => {
    const email = emails.findByMessageId(req.tenant.id, req.params.messageId);
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json(email);
  });

  api.get('/tasks', async (req, res) => {
    res.json(await req.integrations.tasks.listTasks());
  });

  api.delete('/tasks/:taskId', async (req, res) => {
    try {
      await req.integrations.tasks.deleteTask(req.params.taskId);
      res.status(204).end();
    } catch (error) {
      if (!(error instanceof TaskNotFoundError)) throw error;
      res.status(404).json({ error: error.message });
    }
  });

  api.post('/mock/inbox', (req, res) => {
    if (req.tenant.authProvider !== AuthProvider.DEMO) {
      return res.status(400).json({ error: 'Simulated emails are only available for demo tenants' });
    }
    const missing = requireText(req.body, ['from', 'subject', 'body']);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
    }
    res.status(201).json(req.integrations.mail.deliver(req.body));
  });

  app.use('/api', api);

  app.use((error, req, res, next) => {
    if (isGoogleAuthError(error)) {
      return res.status(401).json({ error: 'Google access expired, please sign in again' });
    }
    console.error(error);
    res.status(502).json({ error: `Request failed: ${error.message}` });
  });

  return app;
}
