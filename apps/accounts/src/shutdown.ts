/**
 * Encerramento por falha de boot do `accounts.`
 *
 * `app.listen` é assíncrono: falha de bind (EADDRINUSE) emite `'error'` no
 * servidor em vez de lançar dentro do `try` do boot, então o `catch` nunca
 * dispara sozinho. Sem este caminho o processo ficava vivo, sem servir e com o
 * pool aberto — container saudável para o orquestrador enquanto o SSO está
 * morto, mesma classe de falso-verde do E018 (achado de review, PR #233).
 *
 * Vive em módulo próprio porque `index.ts` roda no import (top-level await): lá
 * dentro, a função só seria exercitada subindo o servidor de verdade.
 */

/** Prazo para o pool fechar antes de o encerramento seguir sem ele. */
export const CLEANUP_TIMEOUT_MS = 5_000;

export type ShutdownTimer = { unref?: () => void };

export interface ShutdownDeps {
  destroy: () => Promise<unknown>;
  cleanupTimeoutMs?: number;
  clearTimeoutFn?: (timer: ShutdownTimer) => void;
  forceExit?: (code: number) => void;
  logError?: (message: string, detail: string) => void;
  setExitCode?: (code: number) => void;
  setTimeoutFn?: (callback: () => void, ms: number) => ShutdownTimer;
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown_error";

export async function shutdownWithError(
  reason: string,
  error: unknown,
  deps: ShutdownDeps,
): Promise<void> {
  const logError = deps.logError ?? ((message, detail) => console.error(message, detail));
  const setExitCode = deps.setExitCode ?? ((code) => { process.exitCode = code; });
  const forceExit = deps.forceExit ?? ((code) => { process.exit(code); });
  const setTimeoutFn = deps.setTimeoutFn
    ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const clearTimeoutFn = deps.clearTimeoutFn
    ?? ((timer) => globalThis.clearTimeout(timer as ReturnType<typeof globalThis.setTimeout>));
  const cleanupTimeoutMs = deps.cleanupTimeoutMs ?? CLEANUP_TIMEOUT_MS;

  logError(reason, describeError(error));

  // O fechamento do pool tem prazo. Um `destroy()` que nunca resolve — conexão
  // pendurada num Postgres inacessível, que é justamente o cenário de falha de
  // boot — travaria este `await` para sempre, e o exit code nunca seria
  // definido: o processo ficaria vivo e sem servir, o falso-verde que esta
  // função existe para evitar (achado de review, PR #234).
  let settled: "cleaned" | "timeout" | null = null;

  await new Promise<void>((resolve) => {
    // `Promise.race` não cancela o perdedor: o timer continuava agendado depois
    // do pool fechar e podia registrar "cleanup timed out" para uma limpeza que
    // deu certo (2ª passada do review, PR #234). Quem chegar primeiro fixa
    // `settled`, e o outro vira no-op.
    const finish = (outcome: "cleaned" | "timeout") => {
      if (settled !== null) return;
      settled = outcome;
      resolve();
    };

    const timer = setTimeoutFn(() => {
      if (settled !== null) return;
      logError("accounts database pool cleanup timed out", `${cleanupTimeoutMs}ms`);
      finish("timeout");
    }, cleanupTimeoutMs);
    // Timer pendente não segura o processo enquanto ele ainda pode sair sozinho.
    timer.unref?.();

    void deps.destroy()
      .catch((destroyError: unknown) => {
        logError("accounts failed to close database pool", describeError(destroyError));
      })
      .finally(() => {
        clearTimeoutFn(timer);
        finish("cleaned");
      });
  });

  setExitCode(1);

  // `process.exitCode` só encerra quando o event loop esvazia. Quando o pool
  // estourou o prazo ele já provou não responder, e seu socket segue aberto:
  // sem saída forçada o container continuaria "no ar" com o SSO morto. Isto não
  // vale para a limpeza bem-sucedida — ali `process.exit` cortaria o flush de
  // log e qualquer outro encerramento pendente, e outros handles ativos são
  // problema de quem os abriu, não deste caminho.
  if (settled === "timeout") forceExit(1);
}
