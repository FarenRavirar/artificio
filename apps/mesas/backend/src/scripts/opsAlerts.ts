import { alertContactTails } from '../services/contactTailSweep.js';
import { alertStaleFeedback } from '../services/devFeedbackNotices.js';

/**
 * Alertas operacionais ao admin (spec 106 plan §11.3 e §12): fila de feedback
 * parada e contato com cauda de Markdown. Um script só, para o cron não ganhar
 * um processo por verificação.
 *
 * Uso: `npm run ops:alerts` (dist) ou `ops:alerts:dev`.
 */
// Varreduras independentes: a falha de uma não impede a outra; qualquer falha dá saída não-zero.
const [stale, tails] = await Promise.allSettled([alertStaleFeedback(), alertContactTails()]);
let failed = false;
for (const [nome, resultado] of [['relatos parados', stale], ['contatos com cauda', tails]] as const) {
  if (resultado.status === 'fulfilled') {
    console.log(`[ops:alerts] ${nome}: ${resultado.value}`);
  } else {
    failed = true;
    console.error(`[ops:alerts] Erro em ${nome}:`, resultado.reason);
  }
}
process.exit(failed ? 1 : 0);
