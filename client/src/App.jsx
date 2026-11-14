import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import EmailTable from './components/EmailTable.jsx';
import IncomingEmailForm from './components/IncomingEmailForm.jsx';
import TaskList from './components/TaskList.jsx';

export default function App() {
  const [info, setInfo] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState('');
  const [emails, setEmails] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    Promise.all([api.getInfo(), api.getTenants()])
      .then(([infoResponse, tenantList]) => {
        setInfo(infoResponse);
        setTenants(tenantList);
        setTenantId(tenantList[0]?.id ?? '');
      })
      .catch((error) => setStatus(error.message));
  }, []);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    const [emailList, taskList] = await Promise.all([api.getEmails(tenantId), api.getTasks(tenantId)]);
    setEmails(emailList);
    setTasks(taskList);
  }, [tenantId]);

  useEffect(() => {
    refresh().catch((error) => setStatus(error.message));
  }, [refresh]);

  function changeTenant(event) {
    setStatus('');
    setTenantId(event.target.value);
  }

  async function checkMailbox() {
    setChecking(true);
    setStatus('Tikrinama...');
    try {
      const summary = await api.checkMailbox(tenantId);
      setStatus(`Gauta ${summary.fetched}, atmesta filtru ${summary.filteredOut}, apdorota ${summary.processed.length}`);
      await refresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setChecking(false);
    }
  }

  async function deleteTask(taskId) {
    await api.deleteTask(tenantId, taskId);
    await refresh();
  }

  async function deliverEmail(email) {
    await api.deliverEmail(tenantId, email);
    setStatus('Laiškas įdėtas. Paspauskite Tikrinti laiškus.');
  }

  return (
    <>
      <header>
        <h1>PiEmail</h1>
        {info && <p className="muted">Šiandien: {info.today} | AI: {info.aiProvider}</p>}
      </header>

      <main>
        <section className="toolbar">
          <label>
            Klientas
            <select value={tenantId} onChange={changeTenant}>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.mailboxAddress})
                </option>
              ))}
            </select>
          </label>
          <button onClick={checkMailbox} disabled={checking || !tenantId}>Tikrinti laiškus</button>
          <span className="muted">{status}</span>
        </section>

        <section>
          <h2>Išanalizuoti laiškai</h2>
          <EmailTable emails={emails} />
        </section>

        <div className="columns">
          <section>
            <h2>Google Tasks <span className="muted">(imitacija)</span></h2>
            <TaskList tasks={tasks} onDelete={deleteTask} />
          </section>

          <section>
            <h2>Imituoti gautą laišką</h2>
            <IncomingEmailForm emails={emails} onSubmit={deliverEmail} />
          </section>
        </div>
      </main>
    </>
  );
}
