import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Dashboard from './components/Dashboard.jsx';
import LoginPage from './components/LoginPage.jsx';

function takeLoginError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('loginError');
  if (error) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  return error;
}

export default function App() {
  const [info, setInfo] = useState(null);
  const [session, setSession] = useState(null);
  const [loginError, setLoginError] = useState(takeLoginError);
  const [loadError, setLoadError] = useState('');

  const loadSession = useCallback(async () => {
    const [infoResponse, sessionResponse] = await Promise.all([api.getInfo(), api.getSession()]);
    setInfo(infoResponse);
    setSession(sessionResponse);
  }, []);

  useEffect(() => {
    loadSession().catch((error) => setLoadError(error.message));
  }, [loadSession]);

  async function demoLogin(tenantId) {
    try {
      await api.demoLogin(tenantId);
      setLoginError(null);
      await loadSession();
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function logout() {
    await api.logout();
    await loadSession();
  }

  if (loadError) return <main><p className="error">{loadError}</p></main>;
  if (!session) return <main><p className="muted">Kraunama...</p></main>;

  if (!session.tenant) {
    return <LoginPage session={session} loginError={loginError} onDemoLogin={demoLogin} />;
  }

  return <Dashboard tenant={session.tenant} info={info} onLogout={logout} onSessionExpired={loadSession} />;
}
