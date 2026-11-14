export const AuthProvider = Object.freeze({
  DEMO: 'demo',
  GOOGLE: 'google',
});

const TENANT_COLUMNS = 'id, name, mailbox_address AS mailboxAddress, auth_provider AS authProvider';

export class TenantRepository {
  constructor(db) {
    this.db = db;
  }

  seed(tenants) {
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO tenants (id, name, mailbox_address, auth_provider) VALUES (?, ?, ?, ?)',
    );
    for (const tenant of tenants) {
      insert.run(tenant.id, tenant.name, tenant.mailboxAddress, tenant.authProvider);
    }
  }

  findById(tenantId) {
    return this.db.prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = ?`).get(tenantId) ?? null;
  }

  findGoogleTenantByEmail(email) {
    return this.db
      .prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE auth_provider = ? AND lower(mailbox_address) = lower(?)`)
      .get(AuthProvider.GOOGLE, email) ?? null;
  }

  listDemoTenants() {
    return this.db
      .prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE auth_provider = ? ORDER BY name`)
      .all(AuthProvider.DEMO);
  }
}
