async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

const tenantUrl = (tenantId, path) => `/api/tenants/${tenantId}${path}`;

export const api = {
  getInfo: () => request('/api/info'),
  getTenants: () => request('/api/tenants'),
  getEmails: (tenantId) => request(tenantUrl(tenantId, '/emails')),
  getTasks: (tenantId) => request(tenantUrl(tenantId, '/tasks')),
  checkMailbox: (tenantId) => request(tenantUrl(tenantId, '/check'), { method: 'POST' }),
  deliverEmail: (tenantId, email) =>
    request(tenantUrl(tenantId, '/mock/inbox'), { method: 'POST', body: JSON.stringify(email) }),
  deleteTask: (tenantId, taskId) => request(tenantUrl(tenantId, `/mock/tasks/${taskId}`), { method: 'DELETE' }),
};
