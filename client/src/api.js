async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error ?? `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  getInfo: () => request('/api/info'),
  getSession: () => request('/api/session'),
  demoLogin: (tenantId) => request(`/auth/demo/${tenantId}`, { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getEmails: () => request('/api/emails'),
  getTasks: () => request('/api/tasks'),
  checkMailbox: () => request('/api/check', { method: 'POST' }),
  deliverEmail: (email) => request('/api/mock/inbox', { method: 'POST', body: JSON.stringify(email) }),
  deleteTask: (taskId) => request(`/api/tasks/${taskId}`, { method: 'DELETE' }),
};

export const GOOGLE_LOGIN_URL = '/auth/google';
