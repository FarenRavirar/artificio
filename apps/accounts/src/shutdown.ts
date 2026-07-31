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

export interface ShutdownDeps {
  destroy: () => Promise<unknown>;
  cleanupTimeoutMs?: number;
  forceExit?: (code: number) => void;
  logError?: (message: string, detail: string) => void;
  setExitCode?: (code: number) => void;
  setTimeoutFn?: (callback: () => void, ms: number) => { unref?: () => void };
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
  const cleanupTimeoutMs = deps.cleanupTimeoutMs ?? CLEANUP_TIMEOUT_MS;

  logError(reason, describeError(error));

  // O fechamento do pool tem prazo. Um `destroy()` que nunca resolve — conexão
  // pendurada num Postgres inacessível, que é justamente o cenário de falha de
  // boot — travaria este `await` para sempre, e o exit code nunca seria
  // definido: o processo ficaria vivo e sem servir, o falso-verde que esta
  // função existe para evitar (achado de review, PR #234).
  let timedOut = false;
  await Promise.race([
    deps.destroy().catch((destroyError: unknown) => {
      logError("accounts failed to close database pool", describeError(destroyError));
    }),
    new Promise<void>((resolve) => {
      const timer = setTimeoutFn(() => {
        timedOut = true;
        logError("accounts database pool cleanup timed out", `${cleanupTimeoutMs}ms`);
        resolve();
      }, cleanupTimeoutMs);
      // Não segura o event loop: se o pool fechar antes, o processo sai na hora.
      timer.unref?.();
    }),
  ]);

  setExitCode(1);

  // `process.exitCode` só encerra quando o event loop esvazia, e um pool travado
  // mantém handle de socket vivo indefinidamente. Neste caminho o pool já provou
  // não responder, então a saída é forçada — sem isto, o container continuaria
  // "no ar" com o SSO morto, que é exatamente o que se quer evitar.
  if (timedOut) forceExit(1);
}
