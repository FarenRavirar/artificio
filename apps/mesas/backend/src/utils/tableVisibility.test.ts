import { canReadTableComments, canWriteTableComments, isImportedTableExpired, isPublicTable } from './tableVisibility.js';

const baseTable = {
  status: 'active',
  archived_at: null,
  origin: 'manual',
  created_at: '2026-07-28T00:00:00.000Z',
  starts_at: null,
};

describe('isPublicTable', () => {
  it('aceita mesa ativa, não arquivada e não expirada', () => {
    expect(isPublicTable(baseTable)).toBe(true);
  });

  it.each([
    ['rascunho', { ...baseTable, status: 'draft' }],
    ['arquivada', { ...baseTable, archived_at: '2026-07-28T00:00:00.000Z' }],
    ['importada expirada', { ...baseTable, origin: 'imported', created_at: '2020-01-01T00:00:00.000Z' }],
  ] as const)('rejeita mesa %s', (_label, table) => {
    expect(isPublicTable(table)).toBe(false);
  });
});

// T7.3 (spec 090, requisito 26a). Os seis estados do enum real
// (`db/types.ts:218`) mais as duas dimensões ortogonais — `archived_at` e
// expiração de importada. A tabela abaixo é a mesma que `routes/tables.ts`
// aplica em `:605-631`; se as duas divergirem, a mesa abre para o visitante e
// recusa o comentário dele.
describe('política de comentário por ciclo de vida da mesa', () => {
  const expirada = { ...baseTable, origin: 'imported', created_at: '2020-01-01T00:00:00.000Z' };

  it.each([
    ['ativa', baseTable, true, true],
    // Lotada segue pública E comentável: `routes/tables.ts:610-611` devolve
    // 200 para ela, "só não aceita mais gente" — vaga é do jogo, não da
    // conversa.
    ['lotada (full)', { ...baseTable, status: 'full' }, true, true],
    // Encerrada preserva a conversa e fecha a fala nova.
    ['encerrada (ended)', { ...baseTable, status: 'ended' }, true, false],
    ['cancelada', { ...baseTable, status: 'cancelled' }, true, false],
    ['arquivada', { ...baseTable, archived_at: '2026-07-28T00:00:00.000Z' }, true, false],
    ['importada expirada', expirada, true, false],
    // Nunca foi pública: nem leitura, nem escrita.
    ['rascunho', { ...baseTable, status: 'draft' }, false, false],
    ['em revisão', { ...baseTable, status: 'pending_review' }, false, false],
    // `%s` consome os argumentos em ordem, e o 2º é o objeto da mesa — por
    // isso o rótulo nomeia só o caso, e os booleanos esperados ficam no corpo.
  ] as const)('mesa %s', (_label, table, read, write) => {
    expect(canReadTableComments(table)).toBe(read);
    expect(canWriteTableComments(table)).toBe(write);
  });

  it('lotada e arquivada ao mesmo tempo não aceita escrita', () => {
    // `archived_at` é ortogonal ao status: sem a checagem separada, `full`
    // passaria pelo ramo final e a mesa arquivada voltaria a aceitar fala.
    const table = { ...baseTable, status: 'full', archived_at: '2026-07-28T00:00:00.000Z' };
    expect(canWriteTableComments(table)).toBe(false);
    expect(canReadTableComments(table)).toBe(true);
  });

  it('status desconhecido falha fechado na escrita e permite leitura', () => {
    // Valor novo no enum cai fora de `active`/`full` e é recusado, em vez de
    // herdar o comportamento de "encerrada" por omissão (motivo em
    // `routes/tables.ts:615-616`).
    const table = { ...baseTable, status: 'estado_novo_do_enum' };
    expect(canWriteTableComments(table)).toBe(false);
    expect(canReadTableComments(table)).toBe(true);
  });
});

// Achado de review (PR #279): `Invalid Date` faz QUALQUER comparação devolver
// false, então a função respondia "não expirado" para data corrompida — falha
// aberta, mantendo pública uma divulgação que deveria ter saído do ar.
describe('isImportedTableExpired — data inválida falha fechado', () => {
  it('created_at inválido é tratado como expirado', () => {
    expect(isImportedTableExpired({ origin: 'imported', created_at: 'lixo', starts_at: null })).toBe(true);
  });

  // `starts_at` inválido NÃO expira sozinho, e isso é correto: a comparação
  // `limiteEvento < limite5Dias` é false com Invalid Date, então a expiração cai
  // no limite de 5 dias após `created_at` — que é válido. Só a perda de
  // `created_at` torna a expiração incalculável.
  it('starts_at inválido cai no limite de 5 dias, sem expirar mesa recém-criada', () => {
    expect(isImportedTableExpired({ origin: 'imported', created_at: new Date().toISOString(), starts_at: 'lixo' })).toBe(false);
  });

  it('starts_at inválido com created_at antigo expira pelo limite de 5 dias', () => {
    const antigo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isImportedTableExpired({ origin: 'imported', created_at: antigo, starts_at: 'lixo' })).toBe(true);
  });

  it('mesa não importada segue fora da regra, mesmo com data inválida', () => {
    expect(isImportedTableExpired({ origin: 'manual', created_at: 'lixo', starts_at: null })).toBe(false);
  });

  it('importada recém-criada com datas válidas NÃO expira', () => {
    expect(isImportedTableExpired({ origin: 'imported', created_at: new Date().toISOString(), starts_at: null })).toBe(false);
  });
});
