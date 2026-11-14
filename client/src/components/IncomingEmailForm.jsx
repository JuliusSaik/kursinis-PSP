import { useState } from 'react';

const EMPTY_EMAIL = { from: 'jonas@gmail.com', subject: '', threadId: '', body: '' };

export default function IncomingEmailForm({ emails, onSubmit }) {
  const [email, setEmail] = useState(EMPTY_EMAIL);
  const threads = [...new Map(emails.map((item) => [item.threadId, item.subject]))];

  function update(event) {
    setEmail({ ...email, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    await onSubmit(email);
    setEmail({ ...email, body: '' });
  }

  return (
    <form onSubmit={submit}>
      <label>
        Siuntėjas
        <input name="from" type="email" value={email.from} onChange={update} required />
      </label>
      <label>
        Tema
        <input name="subject" value={email.subject} onChange={update} required />
      </label>
      <label>
        Gija
        <select name="threadId" value={email.threadId} onChange={update}>
          <option value="">Nauja gija</option>
          {threads.map(([threadId, subject]) => (
            <option key={threadId} value={threadId}>Atsakymas: {subject}</option>
          ))}
        </select>
      </label>
      <label>
        Tekstas
        <textarea name="body" rows={4} value={email.body} onChange={update} required />
      </label>
      <button type="submit">Įdėti į pašto dėžutę</button>
    </form>
  );
}
