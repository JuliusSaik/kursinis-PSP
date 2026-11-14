import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import EmailTable from './EmailTable.jsx';
import IncomingEmailForm from './IncomingEmailForm.jsx';
import TaskList from './TaskList.jsx';

export default function Dashboard({ tenant, info, onLogout, onSessionExpired }) {
  const [emails, setEmails] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const isDemo = tenant.authProvider === 'demo';

  const showError = useCallback((error) => {
    if (error.status === 401) {
      onSessionExpired();
      return;
    }
    setStatus(error.message);
  }, [onSessionExpired]);

  const refresh = useCallback(async () => {
    const [emailList, taskList] = await Promise.all([api.getEmails(), api.getTasks()]);
    setEmails(emailList);
    setTasks(taskList);
  }, []);

  useEffect(() => {
    refresh().catch(showError);
  }, [refresh, showError]);

  async function checkMailbox() {
    setChecking(true);
    setStatus('Tikrinama...');
    try {
      const summary = await api.checkMailbox();
      setStatus(`Gauta ${summary.fetched}, atmesta filtru ${summary.filteredOut}, apdorota ${summary.processed.length}`);
      await refresh();
    } catch (error) {
      showError(error);
    } finally {
      setChecking(false);
    }
  }

  async function deleteTask(taskId) {
    try {
      await api.deleteTask(taskId);
      await refresh();
    } catch (error) {
      showError(error);
    }
  }

  async function deliverEmail(email) {
    try {
      await api.deliverEmail(email);
      setStatus('Laiškas įdėtas. Paspauskite Tikrinti laiškus.');
    } catch (error) {
      showError(error);
    }
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>PiEmail</h1>
          {info && <p className="muted">Šiandien: {info.today} | AI: {info.aiProvider}{info.aiModel && ` (${info.aiModel})`}</p>}
        </div>
        <div className="account">
          <span>{tenant.name}{tenant.name !== tenant.mailboxAddress && ` (${tenant.mailboxAddress})`}</span>
          <button className="secondary" onClick={onLogout}>Atsijungti</button>
        </div>
      </header>

      <main>
        <section className="toolbar">
          <button onClick={checkMailbox} disabled={checking}>Tikrinti laiškus</button>
          <span className="muted">{status}</span>
        </section>

        <section>
          <h2>Išanalizuoti laiškai</h2>
          <EmailTable emails={emails} />
        </section>

        <div className="columns">
          <section>
            <h2>
              Google Tasks{' '}
              <span className="muted">{isDemo ? '(imitacija)' : '(sąrašas „PiEmail")'}</span>
            </h2>
            <TaskList tasks={tasks} onDelete={deleteTask} />
          </section>

          {isDemo && (
            <section>
              <h2>Imituoti gautą laišką</h2>
              <IncomingEmailForm emails={emails} onSubmit={deliverEmail} />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
