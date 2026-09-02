import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../db', () => ({
  db: { insertInto: vi.fn(), updateTable: vi.fn() },
}));

import { db } from '../../db/index.js';
import { registrarObservacoes } from '../roleMappings.js';

const insertInto = db.insertInto as unknown as Mock;
const updateTable = db.updateTable as unknown as Mock;

/**
 * Encadeamento do Kysely reduzido ao que o codigo usa. `executeTakeFirst`
 * devolve o que o teste programou: uma linha (observacao nova) ou `undefined`
 * (`DO NOTHING` bateu, ou seja, anuncio ja contabilizado).
 */
function cadeia(retorno: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ['values', 'onConflict', 'returning', 'set', 'where']) {
    c[m] = vi.fn(() => c);
  }
  c.executeTakeFirst = vi.fn(async () => retorno);
  c.execute = vi.fn(async () => []);
  // `onConflict` recebe um callback que monta o builder; devolver o proprio `c`
  // basta porque nada do resultado dele e lido pelo codigo sob teste.
  c.onConflict = vi.fn((fn: (oc: unknown) => unknown) => {
    const oc = {
      columns: () => ({ doUpdateSet: () => oc, doNothing: () => oc }),
    };
    fn(oc);
    return c;
  });
  return c;
}

const observacao = [{ discordId: '111', sourceType: 'role' as const, kind: 'system' as const, textoVizinho: 'D&D 2024' }];

beforeEach(() => {
  insertInto.mockReset();
  updateTable.mockReset();
});

describe('registrarObservacoes — contagem por ANUNCIO, nao por parse', () => {
  it('anuncio novo conta: nao desfaz o incremento', async () => {
    const mapeamento = cadeia({ id: 'map-1' });
    const observacaoNova = cadeia({ mapping_id: 'map-1' }); // DO NOTHING nao bateu
    insertInto.mockReturnValueOnce(mapeamento).mockReturnValueOnce(observacaoNova);

    await registrarObservacoes('guild-1', observacao, 'msg-1');

    expect(updateTable).not.toHaveBeenCalled();
  });

  it('REPARSE do mesmo anuncio nao infla occurrences', async () => {
    // O fluxo que expoe isto e o reprocessamento em lote da aba Ignoradas, onde
    // reparsear a mesma mensagem varias vezes e a operacao normal. Sem o desfazer,
    // uma unica co-ocorrencia (que pode ser acidente) subia ao topo da fila de
    // revisao fingindo ser padrao repetido. Achado do Codex (P2).
    const mapeamento = cadeia({ id: 'map-1' });
    const jaContabilizada = cadeia(undefined); // DO NOTHING bateu
    insertInto.mockReturnValueOnce(mapeamento).mockReturnValueOnce(jaContabilizada);
    const decremento = cadeia(undefined);
    updateTable.mockReturnValue(decremento);

    await registrarObservacoes('guild-1', observacao, 'msg-1');

    expect(updateTable).toHaveBeenCalledWith('discord_role_mappings');
    // Nunca abaixo de 1: a linha existe porque foi observada ao menos uma vez.
    expect(decremento.where).toHaveBeenCalledWith('occurrences', '>', 1);
  });

  it('sem id de mensagem nao registra observacao nem desfaz nada', async () => {
    // Origem sem id (import antigo) mantem o comportamento anterior: conta e segue.
    const mapeamento = cadeia({ id: 'map-1' });
    insertInto.mockReturnValueOnce(mapeamento);

    await registrarObservacoes('guild-1', observacao, null);

    expect(insertInto).toHaveBeenCalledTimes(1);
    expect(updateTable).not.toHaveBeenCalled();
  });
});
