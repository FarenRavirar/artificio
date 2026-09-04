import type { Mock } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import type { UserRole } from '../db/types.js';

// Spec 099 B0: o PUT /api/v1/gm/profile passa a persistir experience_years e
// average_price (antes gravados só via PATCH), para a migração do editor do
// PATCH para o PUT/POST sem regressão. Estes testes cobrem os dois campos
// novos e a normalização dos campos livres (cortes de tagline/promo_badge_text
// e filtro isSellingPoint) no caminho do PUT — não repetem a suíte completa.

vi.mock('../db/index.js', () => ({
  db: {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    transaction: vi.fn(),
  },
}));

// `filtrarIdsDoCatalogo` consulta o catálogo real de plataformas antes de
// gravar (achado de review, PR #307). Aqui o alvo é a normalização do payload,
// não a existência no banco: o mock devolve os ids como válidos, e o filtro
// de catálogo tem cobertura própria em `platformUtils.test.ts`.
const idsInexistentes = new Set<string>();
vi.mock('../utils/platformUtils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/platformUtils.js')>()),
  filtrarIdsDoCatalogo: vi.fn(
    async (_db: unknown, _catalogo: unknown, ids: readonly string[]) =>
      ids.filter((id) => !idsInexistentes.has(id)),
  ),
}));

let mockUserId = 'gm-user-1';
let mockRole: UserRole = 'gm';
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { userId: mockUserId, role: mockRole };
    next();
  },
}));

import gmPanelRoutes from './gmPanel.js';
import { db } from '../db/index.js';

function mockChain(overrides: Record<string, Mock> = {}) {
  const methods = ['select', 'where', 'executeTakeFirst', 'set', 'returning', 'execute'];
  const chain: Record<string, Mock> = {};
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return Object.assign(chain, overrides);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/gm', gmPanelRoutes);
  return app;
}

const UPDATED_ROW = {
  id: 'profile-1',
  slug: 'mestre-teste',
  nickname: 'Mestre Teste',
  bio_long: null,
  closed_group_description: null,
  experience_years: 12,
  average_price: 45,
};

function mockPutFlow(updatedRow: unknown = UPDATED_ROW) {
  const selectChain = mockChain({ executeTakeFirst: vi.fn().mockResolvedValue({ id: 'profile-1' }) });
  const updateChain = mockChain({ execute: vi.fn().mockResolvedValue([updatedRow]) });
  (db.selectFrom as Mock).mockReturnValue(selectChain);
  (db.updateTable as Mock).mockReturnValue(updateChain);
  return updateChain;
}

describe('PUT /api/v1/gm/profile — experience_years e average_price (spec 099 B0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'gm-user-1';
    mockRole = 'gm';
  });

  it('persiste valores válidos no .set() e devolve na resposta', async () => {
    const updateChain = mockPutFlow();

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ experience_years: 12, average_price: 45 });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      experience_years: 12,
      average_price: 45,
    }));
    expect(res.body.data.experience_years).toBe(12);
    expect(res.body.data.average_price).toBe(45);
  });

  it('null explícito zera os dois campos (contrato de três estados)', async () => {
    const updateChain = mockPutFlow({ ...UPDATED_ROW, experience_years: null, average_price: null });

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ experience_years: null, average_price: null });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      experience_years: null,
      average_price: null,
    }));
  });

  it('valor inválido (decimal/negativo/string) preserva o salvo (undefined no .set())', async () => {
    const updateChain = mockPutFlow();

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ experience_years: -1, average_price: 12.5 });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      experience_years: undefined,
      average_price: undefined,
    }));
  });
});

describe('PUT /api/v1/gm/profile — normalização dos campos livres (spec 099 B0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'gm-user-1';
    mockRole = 'gm';
  });

  it('corta tagline em 200 caracteres', async () => {
    const updateChain = mockPutFlow();
    const longTagline = 'a'.repeat(250);

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ tagline: longTagline });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      tagline: longTagline.slice(0, 200),
    }));
  });

  it('corta promo_badge_text em 120 caracteres', async () => {
    const updateChain = mockPutFlow();
    const longBadgeText = 'b'.repeat(150);

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ promo_badge_text: longBadgeText });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      promo_badge_text: longBadgeText.slice(0, 120),
    }));
  });

  it('selling_points válido persiste e item inválido é filtrado', async () => {
    const updateChain = mockPutFlow();

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({
        selling_points: [
          { icon: 'clock', title: 'Pontual', description: 'Comeco no horario' },
          { icon: 'x' }, // sem title/description: filtrado por isSellingPoint
          'lixo', // não-objeto: filtrado
          null,
        ],
      });

    expect(res.status).toBe(200);
    // Vai SERIALIZADO, não como array cru: `selling_points` é JSONB e o driver
    // `pg` converteria um array JS para o literal de array do Postgres
    // (`{"{...}"}`), que o banco recusa com `22P02`. A asserção anterior exigia
    // o array cru — codificava o defeito que derrubou o PUT em beta com 500 na
    // primeira gravação real (2026-09-04). Ver `db/jsonb.ts`.
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      selling_points: JSON.stringify([
        { icon: 'clock', title: 'Pontual', description: 'Comeco no horario' },
      ]),
    }));
  });

  it('recusa UUID malformado que só tem 36 caracteres permitidos', async () => {
    // A validação anterior era `/^[0-9a-fA-F-]{36}$/`, que aceita 36 hífens e
    // 36 letras sem hífen nenhum. Medido: `'---…'::uuid` faz o Postgres
    // devolver `22P02`, ou seja, a string atravessava a guarda e derrubava o
    // PUT com 500 (achado de review, PR #307).
    const updateChain = mockPutFlow();
    const valido = '4a15a911-559e-46ca-99dc-1d8c74fa1c0d';

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({
        preferred_vtt_platforms: [
          valido,
          '------------------------------------',
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          '4a15a911559e46ca99dc1d8c74fa1c0d----',
        ],
      });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      preferred_vtt_platforms: [valido],
    }));
  });

  it('descarta UUID bem formado que não existe no catálogo', async () => {
    // Sintaxe válida não basta: `UUID[]` não tem FK, então id inexistente
    // entraria como referência morta — some da página pública e não dá para
    // desmarcar, porque o catálogo não o lista. Par do guard que impede apagar
    // plataforma em uso (achado de review, PR #307).
    const updateChain = mockPutFlow();
    const existe = '4a15a911-559e-46ca-99dc-1d8c74fa1c0d';
    const naoExiste = '00000000-0000-0000-0000-000000000000';
    idsInexistentes.add(naoExiste);

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ preferred_communication_platforms: [existe, naoExiste] });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      preferred_communication_platforms: [existe],
    }));
    idsInexistentes.clear();
  });

  it('campo ausente preserva o salvo — o filtro não transforma em lista vazia', async () => {
    const updateChain = mockPutFlow();

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ badges: ['selo-a'] });

    expect(res.status).toBe(200);
    const patch = updateChain.set.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.preferred_vtt_platforms).toBeUndefined();
    expect(patch.preferred_communication_platforms).toBeUndefined();
  });

  it('badges persiste só as strings do array', async () => {
    const updateChain = mockPutFlow();

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ badges: ['selo-a', 42, 'selo-b'] });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      badges: ['selo-a', 'selo-b'],
    }));
  });

  // Nome anterior ("null zeram") descrevia mal o que a assercao prova, e os dois
  // bots de review leram como bug (PR #297). O comportamento esta CERTO:
  // `tagline` e coluna nullable, entao null vira SQL null e limpa; `badges` e
  // NOT NULL DEFAULT '{}' (migration_01:97), entao null vira `undefined` e o
  // campo sai do UPDATE — gravar SQL null ali violaria a constraint. Esvaziar
  // `badges` e mandar `[]`. O schema do cliente foi alinhado a isto.
  it('null limpa coluna nullable (tagline) e e IGNORADO em NOT NULL (badges)', async () => {
    const updateChain = mockPutFlow();

    const res = await request(makeApp())
      .put('/api/v1/gm/profile')
      .send({ tagline: null, badges: null });

    expect(res.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      tagline: null,
      badges: undefined,
    }));
  });
});
