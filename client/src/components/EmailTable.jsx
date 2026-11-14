import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../labels.js';

export default function EmailTable({ emails }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Gauta</th>
          <th>Siuntėjas</th>
          <th>Tema</th>
          <th>Kategorija</th>
          <th>Balai</th>
          <th>Prioritetas</th>
          <th>Terminas</th>
          <th>Užduoties data</th>
          <th>Būsena</th>
        </tr>
      </thead>
      <tbody>
        {emails.map((email) => (
          <tr key={email.messageId} title={email.error ?? email.actionText ?? ''}>
            <td>{new Date(email.receivedAt).toLocaleString('lt-LT')}</td>
            <td>{email.sender}</td>
            <td>{email.subject}</td>
            <td>{CATEGORY_LABELS[email.category]}</td>
            <td>{email.score}</td>
            <td className={`priority-${email.priority}`}>{PRIORITY_LABELS[email.priority]}</td>
            <td>{email.deadline}</td>
            <td>{email.taskDue}</td>
            <td className={`status-${email.status}`}>{STATUS_LABELS[email.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
