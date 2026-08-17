import { describeClosure, normalizeClosedTable } from './closedTable';

/**
 * T7.8 (spec 090) — normalizador do payload `410` (mesa encerrada), em `closedTable.ts`.
 *
 * Cobre a regra pétrea de normalização (AGENTS.md §Regras Gerais de Código):
 * dado de API é `unknown` até passar por normalizador tipado. O foco é o campo
 * `id`, acrescentado ao `410` para a conversa da mesa encerrada poder ser lida
 * (requisito 26a), e a degradação quando ele não vem.
 */

const PAYLOAD = {
  data: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    slug: 'mesa-encerrada',
    title: 'Mesa de Teste',
    closed_at: '2026-07-28T01:00:00.000Z',
    closed_reason: 'gm',
    closed_by_name: 'Mestre Fulano',
  },
};

describe('normalizeClosedTable', () => {
  it('lê o id que sustenta a conversa da mesa encerrada', () => {
    expect(normalizeClosedTable(PAYLOAD).id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it.each([
    // `undefined` e não `{}`: o override entra por spread, então objeto vazio
    // preservaria o `id` do payload base e o caso "ausente" testaria o oposto
    // do que o nome diz.
    ['ausente', { id: undefined }],
    ['nulo', { id: null }],
    ['numérico', { id: 123 }],
    ['string vazia', { id: '   ' }],
  ])('degrada id %s para null, sem quebrar a tela', (_label, override) => {
    // Durante deploy escalonado a API antiga não envia `id`. A tela de
    // encerramento precisa continuar inteira — só não monta a conversa.
    const result = normalizeClosedTable({ data: { ...PAYLOAD.data, ...override } });

    expect(result.id).toBeNull();
    // O resto do payload segue normalizado: a degradação é do campo, não da tela.
    expect(result.title).toBe('Mesa de Teste');
    expect(result.closedByName).toBe('Mestre Fulano');
  });

  it('sobrevive a payload que não é objeto', () => {
    // `unknown` de verdade: resposta que não é JSON de objeto não pode virar
    // `TypeError` no render.
    for (const entrada of [null, undefined, 'texto', 42, []]) {
      const result = normalizeClosedTable(entrada);
      expect(result.id).toBeNull();
      expect(result.title).toBe('Esta mesa');
      expect(result.reason).toBe('unknown');
    }
  });

  it('recusa motivo fora do vocabulário conhecido', () => {
    const result = normalizeClosedTable({ data: { ...PAYLOAD.data, closed_reason: 'inventado' } });
    expect(result.reason).toBe('unknown');
  });

  it.each(['gm', 'admin', 'auto_expired', 'ended', 'cancelled', 'unknown'] as const)(
    'preserva o motivo %s que o backend envia',
    (reason) => {
      // `ended` e `cancelled` chegam pelo fallback do status quando ninguém
      // gravou `closed_reason` (`routes/tables.ts`) — e `closed_reason` é nulo
      // em todas as mesas hoje, então esse é o caminho vivo. Sem eles no
      // vocabulário, degradavam para `unknown` e a tela trocava a frase
      // específica pela genérica (achado de review, PR #268).
      const result = normalizeClosedTable({ data: { ...PAYLOAD.data, closed_reason: reason } });
      expect(result.reason).toBe(reason);
    },
  );

  it.each([
    ['ended', 'Esta mesa chegou ao fim.'],
    ['cancelled', 'Esta mesa foi cancelada.'],
  ] as const)('descreve %s com frase própria, não a genérica', (reason, frase) => {
    const closed = normalizeClosedTable({ data: { ...PAYLOAD.data, closed_reason: reason } });
    expect(describeClosure(closed)).toBe(frase);
  });

  it('data inválida vira null em vez de Invalid Date no render', () => {
    const result = normalizeClosedTable({ data: { ...PAYLOAD.data, closed_at: 'não é data' } });
    expect(result.closedAt).toBeNull();
  });
});
