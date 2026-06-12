import jwt from 'jsonwebtoken';

// Token curto, escopo só-migração. NÃO é sessão: não tem email/name/role, então
// `@artificio/auth verifyToken` o rejeita (não vira login). Vida ~10min.
const SCOPE = 'glossario-migration';
const TTL = '10m';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required');
  return s;
}

export function issueMigrationToken(legacyUserId: string): string {
  return jwt.sign({ scope: SCOPE }, secret(), { subject: legacyUserId, expiresIn: TTL });
}

/** Retorna o id do usuário legado (sub) se o token for válido e do escopo certo; senão null. */
export function verifyMigrationToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, secret()) as Record<string, unknown>;
    if (payload?.scope !== SCOPE) return null;
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
