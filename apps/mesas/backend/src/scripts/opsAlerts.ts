import { alertContactTails } from '../services/contactTailSweep.js';
import { alertStaleFeedback } from '../services/devFeedbackNotices.js';

/**
 * Alertas operacionais ao admin (spec 106 plan §11.3 e §12): fila de feedback
 * parada e contato com cauda de Markdown. Um script só, para o cron não ganhar
 * um processo por verificação.
 *
 * Uso: `npm run ops:alerts` (dist) ou `ops:alerts:dev`.
 */
try {
  const stale = await alertStaleFeedback();
  const tails = await alertContactTails();
  console.log(`[ops:alerts] relatos parados avisados: ${stale}; contatos com cauda: ${tails}`);
  process.exit(0);
} catch (error: unknown) {
  console.error('[ops:alerts] Erro:', error);
  process.exit(1);
}
