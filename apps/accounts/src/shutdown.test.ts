import { describe, expect, it, vi } from "vitest";
import { shutdownWithError } from "./shutdown.js";

function spies(destroy = vi.fn(async () => undefined)) {
  const logError = vi.fn();
  const setExitCode = vi.fn();
  return { destroy, logError, setExitCode };
}

describe("shutdownWithError", () => {
  it("registra o motivo, fecha o pool e marca saída com falha", async () => {
    const deps = spies();
    await shutdownWithError("accounts failed to bind port", new Error("EADDRINUSE"), deps);

    expect(deps.logError).toHaveBeenCalledWith("accounts failed to bind port", "EADDRINUSE");
    expect(deps.destroy).toHaveBeenCalled();
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  // O exit code é o que faz o orquestrador reiniciar o container: se falha ao
  // fechar o pool abortasse o encerramento, o processo ficaria vivo sem servir —
  // exatamente o falso-verde que este caminho existe para evitar.
  it("marca saída com falha mesmo quando fechar o pool falha", async () => {
    const deps = spies(vi.fn(async () => { throw new Error("pool travado"); }));
    await shutdownWithError("accounts failed to start", new Error("boom"), deps);

    expect(deps.logError).toHaveBeenCalledWith("accounts failed to start", "boom");
    expect(deps.logError).toHaveBeenCalledWith("accounts failed to close database pool", "pool travado");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("descreve erro não-Error sem quebrar", async () => {
    const deps = spies();
    await shutdownWithError("accounts failed to start", "string solta", deps);

    expect(deps.logError).toHaveBeenCalledWith("accounts failed to start", "unknown_error");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  it("aguarda o fechamento do pool antes de marcar a saída", async () => {
    const order: string[] = [];
    const deps = {
      destroy: vi.fn(async () => {
        await Promise.resolve();
        order.push("destroy");
      }),
      logError: vi.fn(),
      setExitCode: vi.fn(() => order.push("exit")),
    };

    await shutdownWithError("accounts failed to bind port", new Error("EADDRINUSE"), deps);

    expect(order).toEqual(["destroy", "exit"]);
  });
});
