import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mailbox_address TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_emails (
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    message_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    received_at TEXT NOT NULL,
    status TEXT NOT NULL,
    category TEXT,
    action_text TEXT,
    deadline TEXT,
    confidence REAL,
    score INTEGER,
    priority TEXT,
    task_id TEXT,
    task_due TEXT,
    error TEXT,
    processed_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, message_id)
  );

  CREATE TABLE IF NOT EXISTS thread_tasks (
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    thread_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    PRIMARY KEY (tenant_id, thread_id)
  );

  CREATE TABLE IF NOT EXISTS mailbox_checks (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
    last_checked_at TEXT NOT NULL
  );
`;

export function openDatabase(filePath = ':memory:') {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}
