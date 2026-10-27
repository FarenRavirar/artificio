import { purgeOldClientErrors } from '../services/clientErrors.js';

/**
 * Retenção de 90 dias de `client_errors` (spec 106 R19, plan §9): apaga o que não
 * reincide há esse prazo. O texto da Política de Privacidade (F9) cita os 90 dias.
 *
 * Uso: `npm run client-errors:purge` (dist) ou `client-errors:purge:dev`.
 */
try {
  const removed = await purgeOldClientErrors();
  console.log(`[client-errors:purge] ${removed} erros removidos`);
  process.exit(0);
} catch (error: unknown) {
  console.error('[client-errors:purge] Erro:', error);
  process.exit(1);
}
