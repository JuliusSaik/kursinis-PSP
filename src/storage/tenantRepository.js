export class TenantRepository {
  constructor(db) {
    this.db = db;
  }

  seed(tenants) {
    const insert = this.db.prepare('INSERT OR IGNORE INTO tenants (id, name, mailbox_address) VALUES (?, ?, ?)');
    for (const tenant of tenants) {
      insert.run(tenant.id, tenant.name, tenant.mailboxAddress);
    }
  }

  list() {
    return this.db.prepare('SELECT id, name, mailbox_address AS mailboxAddress FROM tenants ORDER BY name').all();
  }

  findById(tenantId) {
    return this.db
      .prepare('SELECT id, name, mailbox_address AS mailboxAddress FROM tenants WHERE id = ?')
      .get(tenantId) ?? null;
  }
}
