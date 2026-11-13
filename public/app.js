const CATEGORY_LABELS = {
  uzsakymas: 'Užsakymas',
  kliento_uzklausa: 'Kliento užklausa',
  perskambinimas: 'Perskambinimas',
  saskaita: 'Sąskaita',
  kita: 'Kita',
};

const PRIORITY_LABELS = { kritinis: 'Kritinis', aukstas: 'Aukštas', zemas: 'Žemas' };

const STATUS_LABELS = {
  task_created: 'Užduotis sukurta',
  task_updated: 'Užduotis atnaujinta',
  needs_review: 'Reikia peržiūrėti',
  no_action: 'Veiksmo nereikia',
  analysis_failed: 'Nepavyko analizuoti',
  task_failed: 'Nepavyko sukurti užduoties',
};

const elements = {
  info: document.querySelector('#info'),
  tenant: document.querySelector('#tenant'),
  check: document.querySelector('#check'),
  status: document.querySelector('#status'),
  emails: document.querySelector('#emails'),
  tasks: document.querySelector('#tasks'),
  incoming: document.querySelector('#incoming'),
};

const tenantUrl = (path) => `/api/tenants/${elements.tenant.value}${path}`;

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

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text ?? '';
  if (className) td.className = className;
  return td;
}

function renderEmails(emails) {
  elements.emails.replaceChildren(...emails.map((email) => {
    const row = document.createElement('tr');
    row.title = email.error ?? email.actionText ?? '';
    row.append(
      cell(new Date(email.receivedAt).toLocaleString('lt-LT')),
      cell(email.sender),
      cell(email.subject),
      cell(CATEGORY_LABELS[email.category]),
      cell(email.score),
      cell(PRIORITY_LABELS[email.priority], `priority-${email.priority}`),
      cell(email.deadline),
      cell(email.taskDue),
      cell(STATUS_LABELS[email.status], `status-${email.status}`),
    );
    return row;
  }));

  const threadSelect = elements.incoming.elements.threadId;
  const threads = new Map(emails.map((email) => [email.threadId, email.subject]));
  threadSelect.replaceChildren(
    new Option('Nauja gija', ''),
    ...[...threads].map(([threadId, subject]) => new Option(`Atsakymas: ${subject}`, threadId)),
  );
}

function renderTasks(tasks) {
  if (tasks.length === 0) {
    elements.tasks.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Užduočių nėra', className: 'muted' }));
    return;
  }
  elements.tasks.replaceChildren(...tasks.map((task) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = `${task.due}  ${task.title}`;
    const remove = Object.assign(document.createElement('button'), { textContent: 'Ištrinti', className: 'secondary' });
    remove.title = 'Imituoja užduoties ištrynimą telefone';
    remove.addEventListener('click', () => deleteTask(task.id));
    item.append(text, remove);
    return item;
  }));
}

async function refresh() {
  const [emails, tasks] = await Promise.all([request(tenantUrl('/emails')), request(tenantUrl('/tasks'))]);
  renderEmails(emails);
  renderTasks(tasks);
}

async function checkMailbox() {
  elements.check.disabled = true;
  elements.status.textContent = 'Tikrinama...';
  try {
    const summary = await request(tenantUrl('/check'), { method: 'POST' });
    elements.status.textContent =
      `Gauta ${summary.fetched}, atmesta filtru ${summary.filteredOut}, apdorota ${summary.processed.length}`;
    await refresh();
  } catch (error) {
    elements.status.textContent = error.message;
  } finally {
    elements.check.disabled = false;
  }
}

async function deleteTask(taskId) {
  await request(tenantUrl(`/mock/tasks/${taskId}`), { method: 'DELETE' });
  await refresh();
}

async function deliverIncoming(event) {
  event.preventDefault();
  const form = new FormData(elements.incoming);
  await request(tenantUrl('/mock/inbox'), { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
  elements.incoming.elements.body.value = '';
  elements.status.textContent = 'Laiškas įdėtas. Paspauskite Tikrinti laiškus.';
}

async function init() {
  const [info, tenants] = await Promise.all([request('/api/info'), request('/api/tenants')]);
  elements.info.textContent = `Šiandien: ${info.today} | AI: ${info.aiProvider}`;
  elements.tenant.replaceChildren(...tenants.map((tenant) => new Option(`${tenant.name} (${tenant.mailboxAddress})`, tenant.id)));

  elements.tenant.addEventListener('change', () => {
    elements.status.textContent = '';
    refresh();
  });
  elements.check.addEventListener('click', checkMailbox);
  elements.incoming.addEventListener('submit', deliverIncoming);
  await refresh();
}

init().catch((error) => {
  elements.status.textContent = error.message;
});
