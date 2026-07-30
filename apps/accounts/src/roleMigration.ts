import type { UserRole } from '@artificio/auth';

export type RoleOrigin = 'downloads' | 'mesas' | 'glossario';

export interface CentralRoleAccount {
  id: string;
  email: string;
  role: UserRole;
}

export interface LocalRoleSource {
  origin: RoleOrigin;
  localId: string;
  centralId: string | null;
  email: string | null;
  role: string;
  realm: 'prod' | 'beta';
}

export interface RoleMigrationReportRow {
  origin: RoleOrigin;
  localId: string;
  accountId: string | null;
  previousRole: UserRole | null;
  finalRole: UserRole | null;
  conflict: boolean;
  reason: string;
}

const ROLE_WEIGHT: Record<UserRole, number> = { user: 0, moderator: 1, admin: 2 };

const normalizeEmail = (email: string): string => email.trim().toLocaleLowerCase('en-US');

function globalGrant(source: LocalRoleSource): UserRole | null {
  if (source.role === 'admin') return 'admin';
  if (source.origin === 'downloads' && source.role === 'moderator') return 'moderator';
  return null;
}

function strongest(left: UserRole, right: UserRole): UserRole {
  return ROLE_WEIGHT[right] > ROLE_WEIGHT[left] ? right : left;
}

export function buildRoleMigrationReport(
  accounts: readonly CentralRoleAccount[],
  sources: readonly LocalRoleSource[],
): RoleMigrationReportRow[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const accountsByEmail = new Map<string, CentralRoleAccount[]>();
  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    accountsByEmail.set(email, [...(accountsByEmail.get(email) ?? []), account]);
  }

  const matches = sources.map((source) => {
    if (source.realm !== 'prod') {
      return { source, account: null, conflict: false, reason: 'beta_excluded' } as const;
    }

    if (source.centralId) {
      const exact = accountsById.get(source.centralId);
      if (exact) return { source, account: exact, conflict: false, reason: 'matched_exact_id' } as const;
      // ID explícito divergente nunca cai para e-mail: isso mascararia vínculo quebrado.
      return { source, account: null, conflict: true, reason: 'central_id_not_found' } as const;
    }

    if (source.origin === 'downloads') {
      return { source, account: null, conflict: false, reason: 'downloads_requires_exact_id' } as const;
    }

    if (!source.email) {
      return { source, account: null, conflict: false, reason: 'missing_identity' } as const;
    }

    const emailMatches = accountsByEmail.get(normalizeEmail(source.email)) ?? [];
    if (emailMatches.length === 1) {
      return { source, account: emailMatches[0], conflict: false, reason: 'matched_normalized_email' } as const;
    }
    if (emailMatches.length > 1) {
      return { source, account: null, conflict: true, reason: 'duplicate_central_email' } as const;
    }
    return { source, account: null, conflict: false, reason: 'account_not_found' } as const;
  });

  const finalByAccount = new Map(accounts.map((account) => [account.id, account.role]));
  for (const match of matches) {
    const grant = globalGrant(match.source);
    if (match.account && grant) {
      finalByAccount.set(match.account.id, strongest(finalByAccount.get(match.account.id) ?? 'user', grant));
    }
  }

  return matches
    .map(({ source, account, conflict, reason }) => ({
      origin: source.origin,
      localId: source.localId,
      accountId: account?.id ?? null,
      previousRole: account?.role ?? null,
      finalRole: account ? finalByAccount.get(account.id) ?? account.role : null,
      conflict,
      reason: account && !globalGrant(source) ? `${reason}:domain_role_only` : reason,
    }))
    .sort((left, right) => `${left.origin}:${left.localId}`.localeCompare(`${right.origin}:${right.localId}`, 'en'));
}

export function applyRoleMigrationReport(
  accounts: readonly CentralRoleAccount[],
  report: readonly RoleMigrationReportRow[],
): CentralRoleAccount[] {
  const finalByAccount = new Map<string, UserRole>();
  for (const row of report) {
    if (row.accountId && row.finalRole && !row.conflict) {
      finalByAccount.set(row.accountId, strongest(finalByAccount.get(row.accountId) ?? 'user', row.finalRole));
    }
  }
  return accounts.map((account) => ({
    ...account,
    role: strongest(account.role, finalByAccount.get(account.id) ?? 'user'),
  }));
}
