import { describe, expect, it, vi } from "vitest";
import { shutdownWithError } from "./shutdown.js";

/**
 * Timer controlado pelo teste: `fire()` dispara o prazo de limpeza quando o caso
 * quer provar o estouro. Sem chamar `fire()`, o prazo nunca vence — é o
 * `destroy()` que decide o resultado, como em produção.
 */
function fakeTimer() {
  let pending: (() => void) | null = null;
  const token = { unref: vi.fn() };
  const setTimeoutFn = vi.fn((callback: () => void) => {
    pending = callback;
    return token;
  });
  // `clearTimeoutFn` real remove o agendamento; aqui só registramos a chamada e
  // deixamos `fire()` disponível para provar que disparar depois é inofensivo.
  const clearTimeoutFn = vi.fn();
  return { clearTimeoutFn, fire: () => pending?.(), setTimeoutFn, timerToken: token };
}

function spies(destroy = vi.fn(async () => undefined)) {
  const logError = vi.fn();
  const setExitCode = vi.fn();
  const forceExit = vi.fn();
  return { destroy, forceExit, logError, setExitCode, ...fakeTimer() };
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

  // O cenário de falha de boot é justamente aquele em que o Postgres não
  // responde: um `destroy()` pendurado travaria o `await` para sempre e o exit
  // code nunca seria definido — processo vivo, sem servir, container "saudável"
  // para o orquestrador (achado de review, PR #234).
  it("não fica preso quando o fechamento do pool nunca resolve", async () => {
    const deps = spies(vi.fn(() => new Promise<undefined>(() => { /* nunca resolve */ })));
    const shutdown = shutdownWithError("accounts failed to bind port", new Error("EADDRINUSE"), deps);

    deps.fire();
    await shutdown;

    expect(deps.logError).toHaveBeenCalledWith("accounts database pool cleanup timed out", "5000ms");
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  // `process.exitCode` só encerra quando o event loop esvazia, e o pool travado
  // mantém o socket aberto. Sem saída forçada o processo sobreviveria ao próprio
  // encerramento.
  it("força a saída quando a limpeza estoura o prazo", async () => {
    const deps = spies(vi.fn(() => new Promise<undefined>(() => { /* nunca resolve */ })));
    const shutdown = shutdownWithError("accounts failed to start", new Error("boom"), deps);

    deps.fire();
    await shutdown;

    expect(deps.forceExit).toHaveBeenCalledWith(1);
  });

  // Pool que fecha normalmente não pode ser morto à força: `process.exit`
  // interromperia flush de log e qualquer outro encerramento pendente.
  it("não força a saída quando o pool fecha dentro do prazo", async () => {
    const deps = spies();
    await shutdownWithError("accounts failed to bind port", new Error("EADDRINUSE"), deps);

    expect(deps.forceExit).not.toHaveBeenCalled();
    expect(deps.setExitCode).toHaveBeenCalledWith(1);
  });

  // `Promise.race` não cancela o perdedor: o timer seguia agendado depois de o
  // pool fechar e registrava "cleanup timed out" para uma limpeza bem-sucedida
  // (2ª passada do review, PR #234). O log de encerramento é o que se lê para
  // decidir se o SSO caiu por falha de banco — mentir ali custa diagnóstico.
  it("timer que dispara após a limpeza bem-sucedida não vira falso timeout", async () => {
    const deps = spies();
    await shutdownWithError("accounts failed to bind port", new Error("EADDRINUSE"), deps);

    expect(deps.clearTimeoutFn).toHaveBeenCalledWith(deps.timerToken);

    // Mesmo que o agendamento escape do `clear`, disparar agora é no-op.
    deps.fire();

    expect(deps.logError).not.toHaveBeenCalledWith(
      "accounts database pool cleanup timed out",
      expect.anything(),
    );
    expect(deps.forceExit).not.toHaveBeenCalled();
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
      // Timer que nunca dispara: aqui o `destroy()` resolve, e quem decide a
      // ordem é ele, não o prazo.
      ...fakeTimer(),
    };

    await shutdownWithError("accounts failed to bind port", new Error("EADDRINUSE"), deps);

    expect(order).toEqual(["destroy", "exit"]);
  });
});
