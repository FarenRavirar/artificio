// Fase 3 (spec 084) — helper pra adapters que, no estado atual, SEMPRE
// falham antes de produzir qualquer item (ex.: DriveThruRPG/DMs Guild sem
// parser de listagem implementado ainda). Um `async *` generator que nunca
// faz `yield` dispara a regra de lint `require-yield` (correta — sinaliza
// codigo generator sem uso real de generator); este helper evita a
// generator function desnecessaria mantendo o contrato AsyncIterable.
export function failingAsyncIterable<T>(run: () => Promise<never>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: (): AsyncIterator<T> => ({
      next: async (): Promise<IteratorResult<T>> => {
        await run();
        throw new Error('unreachable — run() sempre rejeita');
      },
    }),
  };
}
