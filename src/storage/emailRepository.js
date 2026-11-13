export const EmailStatus = Object.freeze({
  TASK_CREATED: 'task_created',
  TASK_UPDATED: 'task_updated',
  NEEDS_REVIEW: 'needs_review',
  NO_ACTION: 'no_action',
  ANALYSIS_FAILED: 'analysis_failed',
  TASK_FAILED: 'task_failed',
});

const RETRYABLE_STATUSES = [EmailStatus.ANALYSIS_FAILED, EmailStatus.TASK_FAILED];

const EMAIL_COLUMNS = `
  message_id AS messageId, thread_id AS threadId, sender, subject, received_at AS receivedAt,
  status, category, action_text AS actionText, deadline, confidence, score, priority,
  task_id AS taskId, task_due AS taskDue, error, processed_at AS processedAt
`;

export class EmailRepository {
  constructor(db) {
    this.db = db;
  }

  save(tenantId, record) {
    this.db.prepare(`
      INSERT INTO processed_emails (
        tenant_id, message_id, thread_id, sender, subject, received_at, status, category, action_text,
        deadline, confidence, score, priority, task_id, task_due, error, processed_at
      ) VALUES (
        :tenantId, :messageId, :threadId, :sender, :subject, :receivedAt, :status, :category, :actionText,
        :deadline, :confidence, :score, :priority, :taskId, :taskDue, :error, :processedAt
      )
      ON CONFLICT (tenant_id, message_id) DO UPDATE SET
        status = excluded.status, category = excluded.category, action_text = excluded.action_text,
        deadline = excluded.deadline, confidence = excluded.confidence, score = excluded.score,
        priority = excluded.priority, task_id = excluded.task_id, task_due = excluded.task_due,
        error = excluded.error, processed_at = excluded.processed_at
    `).run({
      category: null, actionText: null, deadline: null, confidence: null, score: null,
      priority: null, taskId: null, taskDue: null, error: null,
      ...record,
      tenantId,
    });
  }

  findByMessageId(tenantId, messageId) {
    return this.db
      .prepare(`SELECT ${EMAIL_COLUMNS} FROM processed_emails WHERE tenant_id = ? AND message_id = ?`)
      .get(tenantId, messageId) ?? null;
  }

  listByTenant(tenantId) {
    return this.db
      .prepare(`SELECT ${EMAIL_COLUMNS} FROM processed_emails WHERE tenant_id = ? ORDER BY received_at DESC`)
      .all(tenantId);
  }

  listRetryableMessageIds(tenantId) {
    const placeholders = RETRYABLE_STATUSES.map(() => '?').join(', ');
    return this.db
      .prepare(`SELECT message_id AS messageId FROM processed_emails WHERE tenant_id = ? AND status IN (${placeholders})`)
      .all(tenantId, ...RETRYABLE_STATUSES)
      .map((row) => row.messageId);
  }

  isProcessed(tenantId, messageId) {
    const email = this.findByMessageId(tenantId, messageId);
    return email !== null && !RETRYABLE_STATUSES.includes(email.status);
  }

  findThreadTaskId(tenantId, threadId) {
    const row = this.db
      .prepare('SELECT task_id AS taskId FROM thread_tasks WHERE tenant_id = ? AND thread_id = ?')
      .get(tenantId, threadId);
    return row?.taskId ?? null;
  }

  linkThreadTask(tenantId, threadId, taskId) {
    this.db.prepare(`
      INSERT INTO thread_tasks (tenant_id, thread_id, task_id) VALUES (?, ?, ?)
      ON CONFLICT (tenant_id, thread_id) DO UPDATE SET task_id = excluded.task_id
    `).run(tenantId, threadId, taskId);
  }

  getLastCheckedAt(tenantId) {
    const row = this.db.prepare('SELECT last_checked_at AS lastCheckedAt FROM mailbox_checks WHERE tenant_id = ?').get(tenantId);
    return row?.lastCheckedAt ?? null;
  }

  setLastCheckedAt(tenantId, checkedAt) {
    this.db.prepare(`
      INSERT INTO mailbox_checks (tenant_id, last_checked_at) VALUES (?, ?)
      ON CONFLICT (tenant_id) DO UPDATE SET last_checked_at = excluded.last_checked_at
    `).run(tenantId, checkedAt);
  }
}
