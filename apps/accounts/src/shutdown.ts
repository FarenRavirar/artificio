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
export interface ShutdownDeps {
  destroy: () => Promise<unknown>;
  logError?: (message: string, detail: string) => void;
  setExitCode?: (code: number) => void;
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

  logError(reason, describeError(error));
  try {
    await deps.destroy();
  } catch (destroyError) {
    // Falha ao fechar o pool não pode engolir o encerramento: o exit code é o
    // que faz o orquestrador reiniciar o container em vez de dá-lo por saudável.
    logError("accounts failed to close database pool", describeError(destroyError));
  }
  setExitCode(1);
}
