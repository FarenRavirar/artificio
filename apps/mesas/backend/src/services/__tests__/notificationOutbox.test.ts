import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
  insertInto: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({ db: dbMocks }));

import { enqueueNotification, resolveAccountsUserIds } from '../notificationOutbox.js';

// T7.4b (spec 096). O que estes testes protegem, e por quê:
//
// A tradução de id local → id central não quebra compilação nem teste quando
// está errada — ela falha em produção, na FK `recipient_user_id REFERENCES
// users(id)` do accounts, aviso por aviso. Medido em 2026-08-25: dos 88 usuários
// do mesas, ZERO têm `id` igual ao id central, e 14 guardam `google_sub` cru de
// 21 dígitos em vez do UUID.

function mockUsers(rows: Array<{ id: string; google_id: string | null }>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(rows),
  };
  dbMocks.selectFrom.mockReturnValue(chain);
  return chain;
}

function mockInsert() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  dbMocks.insertInto.mockReturnValue(chain);
  return chain;
}

const UUID_CENTRAL = '0f0e35b3-7375-476c-b6f8-932caf88b9a8';
const UUID_LOCAL = 'c3f560fe-7f99-4abf-8da9-0c49f84bb05c';
/** Formato real dos 14 registros legados: `google_sub` do Google, 21 dígitos. */
const GOOGLE_SUB_LEGADO = '104402786752391076361';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveAccountsUserIds — tradução do id (T7.4b)', () => {
  it('troca o id local pelo id central guardado em google_id', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: UUID_CENTRAL }]);

    const resolved = await resolveAccountsUserIds([UUID_LOCAL]);

    expect(resolved).toEqual([UUID_CENTRAL]);
    // Nunca o id local: ele não existe na tabela `users` do accounts.
    expect(resolved).not.toContain(UUID_LOCAL);
  });

  it('omite quem tem google_sub legado de 21 dígitos, em vez de mandar o valor cru', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: GOOGLE_SUB_LEGADO }]);

    const resolved = await resolveAccountsUserIds([UUID_LOCAL]);

    // O ingest do accounts valida `z.array(z.string().uuid())`: mandar os 21
    // dígitos derrubaria o LOTE INTEIRO com um 400 genérico — o incidente de
    // 2026-08-18 registrado no AGENTS.md.
    expect(resolved).toEqual([]);
  });

  it('preserva os válidos quando o lote mistura formatos', async () => {
    mockUsers([
      { id: UUID_LOCAL, google_id: UUID_CENTRAL },
      { id: 'b872ef2d-cd29-4bd7-8f41-814708d059f4', google_id: GOOGLE_SUB_LEGADO },
    ]);

    const resolved = await resolveAccountsUserIds([UUID_LOCAL, 'b872ef2d-cd29-4bd7-8f41-814708d059f4']);

    // Um destinatário legado não pode custar o aviso de quem está correto.
    expect(resolved).toEqual([UUID_CENTRAL]);
  });

  it('omite google_id nulo', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: null }]);
    expect(await resolveAccountsUserIds([UUID_LOCAL])).toEqual([]);
  });

  it('não consulta o banco para lista vazia', async () => {
    expect(await resolveAccountsUserIds([])).toEqual([]);
    expect(dbMocks.selectFrom).not.toHaveBeenCalled();
  });
});

describe('enqueueNotification — enfileiramento (T7.4b)', () => {
  const base = {
    eventType: 'mesas.suggestion.approved' as const,
    subjectType: 'system_suggestion',
    subjectId: 'sug-1',
    canonicalPath: '/catalogo?system=dnd',
    body: 'Seu sistema foi adicionado ao catálogo.',
    snapshot: { title: 'Sugestão aprovada' },
    recipients: [UUID_LOCAL],
  };

  it('grava no outbox com o id central, event_id próprio e JSON serializado', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: UUID_CENTRAL }]);
    const insert = mockInsert();

    const eventId = await enqueueNotification(base);

    expect(dbMocks.insertInto).toHaveBeenCalledWith('mesas_notification_outbox');
    const values = insert.values.mock.calls[0][0] as Record<string, unknown>;
    expect(values.event_id).toBe(eventId);
    expect(values.event_type).toBe('mesas.suggestion.approved');
    expect(JSON.parse(values.recipients as string)).toEqual([UUID_CENTRAL]);
    // Achado real (review PR #289, Codex, P1): o formatador do `accounts.` lê
    // `snapshot.legacy_body` para evento externo e não tem `case` para `mesas.*`
    // — sem este campo, TODO aviso do mesas mostraria o fallback técnico
    // ("Notificação: mesas.suggestion.approved") em vez do texto real.
    expect(JSON.parse(values.snapshot as string)).toEqual({
      legacy_body: 'Seu sistema foi adicionado ao catálogo.',
      title: 'Sugestão aprovada',
    });
  });

  it('o snapshot do chamador não sobrescreve legacy_body por acidente', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: UUID_CENTRAL }]);
    const insert = mockInsert();

    await enqueueNotification({
      ...base,
      body: 'texto real',
      snapshot: { legacy_body: 'texto errado', outro: 1 },
    });

    const values = insert.values.mock.calls[0][0] as Record<string, unknown>;
    const snapshot = JSON.parse(values.snapshot as string) as Record<string, unknown>;
    // O spread do chamador vem DEPOIS, então ele vence — comportamento
    // deliberado: quem passa `legacy_body` explícito sabe o que quer.
    expect(snapshot.legacy_body).toBe('texto errado');
    expect(snapshot.outro).toBe(1);
  });

  it('devolve event_id novo a cada chamada (idempotência é do produtor)', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: UUID_CENTRAL }]);
    mockInsert();

    const first = await enqueueNotification(base);
    const second = await enqueueNotification(base);

    expect(first).not.toBe(second);
  });

  it('é no-op quando nenhum destinatário resolve — não grava linha inútil', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: GOOGLE_SUB_LEGADO }]);
    mockInsert();

    expect(await enqueueNotification(base)).toBeNull();
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  it('é no-op para lista de destinatários vazia', async () => {
    mockInsert();
    expect(await enqueueNotification({ ...base, recipients: [] })).toBeNull();
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  // O CHECK da migration_163 e o do ingest recusariam estes paths. Falhar aqui
  // torna o erro visível no teste, em vez de 400 silencioso no sweep — depois de
  // a ação de mérito já ter commitado.
  it.each([
    ['path absoluto', 'https://exemplo.com/x'],
    ['barra dupla', '//exemplo.com'],
    ['barra invertida', '/gestao\\x'],
    ['vazio', ''],
  ])('recusa canonical_path inválido: %s', async (_label, path) => {
    mockUsers([{ id: UUID_LOCAL, google_id: UUID_CENTRAL }]);
    mockInsert();

    await expect(enqueueNotification({ ...base, canonicalPath: path })).rejects.toThrow();
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });

  // Achado real (review PR #289, inline): a validação de path corria DEPOIS dos
  // early returns por destinatário, então um chamador com path quebrado cujos
  // destinatários caíssem todos no formato legado saía `null` em silêncio — e o
  // defeito só aparecia quando outro usuário recebesse o mesmo aviso. Path é
  // propriedade do chamador, não do destinatário: o erro tem de ser determinístico.
  it('recusa path inválido mesmo sem destinatário nenhum', async () => {
    mockInsert();
    await expect(
      enqueueNotification({ ...base, canonicalPath: 'https://exemplo.com/x', recipients: [] }),
    ).rejects.toThrow();
  });

  it('recusa path inválido mesmo quando todos os destinatários são legados', async () => {
    mockUsers([{ id: UUID_LOCAL, google_id: GOOGLE_SUB_LEGADO }]);
    mockInsert();
    await expect(
      enqueueNotification({ ...base, canonicalPath: 'https://exemplo.com/x' }),
    ).rejects.toThrow();
  });

  it('usa o executor recebido (trx) em vez do db global', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{ id: UUID_LOCAL, google_id: UUID_CENTRAL }]),
    };
    const insertChain = { values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue(undefined) };
    const trx = {
      selectFrom: vi.fn().mockReturnValue(selectChain),
      insertInto: vi.fn().mockReturnValue(insertChain),
    };

    await enqueueNotification(base, trx as never);

    // É isto que garante que o aviso entre na MESMA transação da ação de mérito
    // — e que não seja emitido se ela for revertida.
    expect(trx.insertInto).toHaveBeenCalledWith('mesas_notification_outbox');
    expect(dbMocks.insertInto).not.toHaveBeenCalled();
  });
});
