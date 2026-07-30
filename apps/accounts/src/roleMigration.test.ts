import { describe, expect, it } from 'vitest';
import { applyRoleMigrationReport, buildRoleMigrationReport, type CentralRoleAccount, type LocalRoleSource } from './roleMigration.js';

const accounts: CentralRoleAccount[] = [
  { id: 'a-admin', email: 'admin@example.com', role: 'user' },
  { id: 'a-mod', email: 'mod@example.com', role: 'user' },
  { id: 'a-gm', email: 'gm@example.com', role: 'user' },
];

const sources: LocalRoleSource[] = [
  { origin: 'downloads', localId: 'd1', centralId: 'a-mod', email: null, role: 'moderator', realm: 'prod' },
  { origin: 'mesas', localId: 'm1', centralId: null, email: ' ADMIN@example.com ', role: 'admin', realm: 'prod' },
  { origin: 'mesas', localId: 'm2', centralId: null, email: 'gm@example.com', role: 'gm', realm: 'prod' },
  { origin: 'glossario', localId: 'g1', centralId: null, email: 'admin@example.com', role: 'editor', realm: 'prod' },
  { origin: 'downloads', localId: 'd-beta', centralId: 'a-admin', email: null, role: 'admin', realm: 'beta' },
  { origin: 'downloads', localId: 'd-missing', centralId: null, email: 'mod@example.com', role: 'moderator', realm: 'prod' },
];

describe('migração determinística de papéis globais', () => {
  it('aplica identidade, realm e separação global/domínio', () => {
    const report = buildRoleMigrationReport(accounts, sources);
    expect(report).toMatchObject([
      { origin: 'downloads', localId: 'd-beta', accountId: null, reason: 'beta_excluded' },
      { origin: 'downloads', localId: 'd-missing', accountId: null, reason: 'downloads_requires_exact_id' },
      { origin: 'downloads', localId: 'd1', accountId: 'a-mod', finalRole: 'moderator' },
      { origin: 'glossario', localId: 'g1', accountId: 'a-admin', finalRole: 'admin', reason: 'matched_normalized_email:domain_role_only' },
      { origin: 'mesas', localId: 'm1', accountId: 'a-admin', finalRole: 'admin' },
      { origin: 'mesas', localId: 'm2', accountId: 'a-gm', finalRole: 'user', reason: 'matched_normalized_email:domain_role_only' },
    ]);
  });

  it('produz relatório estável e aplicação idempotente', () => {
    const firstReport = buildRoleMigrationReport(accounts, sources);
    expect(buildRoleMigrationReport(accounts, [...sources].reverse())).toEqual(firstReport);
    const once = applyRoleMigrationReport(accounts, firstReport);
    expect(applyRoleMigrationReport(once, firstReport)).toEqual(once);
  });

  it('não usa e-mail quando existe vínculo central quebrado', () => {
    const [row] = buildRoleMigrationReport(accounts, [{
      origin: 'mesas', localId: 'm-conflict', centralId: 'missing', email: 'admin@example.com', role: 'admin', realm: 'prod',
    }]);
    expect(row).toMatchObject({ accountId: null, conflict: true, reason: 'central_id_not_found' });
  });
});
