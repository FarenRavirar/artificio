import type { Mock } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';

/**
 * F6.3c/F6.3f (spec 100) — os sistemas gravados pelo mestre chegam ao visitante.
 *
 * Medido em 2026-09-05: `GET /api/v1/gm/perfis/farenravirar` devolvia 37 chaves
 * e **nenhuma** vinha de `user_systems`. O editor gravava desde sempre
 * (`UserSystemsSelector type="gm"`), a rota pública nunca consultava a tabela —
 * grava e some da vista, o que o mestre lê como "não salva".
 *
 * A ida e volta completa: o que está em `user_systems type='gm'` sai em
 * `data.gm_systems`, com o nome composto pela cadeia inteira e não pela folha.
 */
vi.mock('../db/index.js', () => ({
  db: { selectFrom: vi.fn() },
}));

vi.mock('../middleware/auth.js', () => ({
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/rateLimit.js', () => ({
  publicRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  authRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// `vi.hoisted` porque `vi.mock` é ICADO acima destas declarações: a fábrica
// referenciar um `const` do escopo do módulo só não estoura em TDZ por acidente
// (a fábrica é `async` e o acesso acontece dentro do arrow, depois da
// inicialização). Robustez por desenho, não por ordem de avaliação.
const { catalogo, loadFlat } = vi.hoisted(() => {
  const nodes = [
    { id: 'dd', name: 'Dungeons & Dragons', parent_id: null },
    { id: 'dd5e', name: '5e', parent_id: 'dd' },
    { id: 'dd5e2024', name: '2024', parent_id: 'dd5e' },
    { id: 'pf2e', name: 'Pathfinder 2e', parent_id: null },
  ];
  return { catalogo: nodes, loadFlat: vi.fn(async () => nodes) };
});

vi.mock('../services/systemCatalogProvider.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/systemCatalogProvider.js')>()),
  getSystemCatalogProvider: () => ({ loadFlat }),
  hydrateTableSystemFields: vi.fn(async (rows: unknown[]) => rows),
}));

import gmRoutes from './gm.js';
import { db } from '../db/index.js';

const PERFIL = {
  id: 'gm-1',
  user_id: 'user-1',
  slug: 'mestre-teste',
  display_name: 'Mestre Teste',
  bio_long: null,
  tagline: null,
  avatar_url: null,
  banner_url: null,
  languages: [],
  specialties: [],
  badges: [],
  selling_points: [],
  contact_methods: [],
  preferred_vtt_platforms: [],
  preferred_communication_platforms: [],
  closed_group_enabled: false,
  closed_group_systems: [],
  closed_group_description: null,
  closed_group_min_price_cents: null,
};

/**
 * A rota encadeia consultas a várias tabelas; o mock responde por NOME da
 * tabela, e não por ordem de chamada, para o teste não quebrar quando outra
 * consulta for acrescentada ou reordenada.
 */
function mockDb(systemRows: Array<{ system_id: string }>) {
  (db.selectFrom as Mock).mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const metodo of ['innerJoin', 'leftJoin', 'select', 'where', 'orderBy', 'set', 'updateTable']) {
      chain[metodo] = vi.fn().mockReturnValue(chain);
    }
    chain.executeTakeFirst = vi.fn().mockResolvedValue(table.startsWith('gm_profiles') ? PERFIL : undefined);
    chain.execute = vi.fn().mockResolvedValue(table === 'user_systems' ? systemRows : []);
    return chain;
  });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/gm', gmRoutes);
  return app;
}

describe('GET /api/v1/gm/perfis/:slug — sistemas do mestre (spec 100 F6.3c/F6.3f)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFlat.mockResolvedValue(catalogo);
  });

  it('devolve os sistemas gravados em user_systems', async () => {
    mockDb([{ system_id: 'dd5e2024' }, { system_id: 'pf2e' }]);

    const res = await request(makeApp()).get('/api/v1/gm/perfis/mestre-teste');

    expect(res.status).toBe(200);
    // Cadeia inteira, não a folha: "2024" sozinho não identifica sistema algum
    // — é o mesmo nome que a mesa já exibe (`hydrateTableSystemFields`).
    expect(res.body.data.gm_systems).toEqual([
      { id: 'dd5e2024', name: 'Dungeons & Dragons 5e 2024' },
      { id: 'pf2e', name: 'Pathfinder 2e' },
    ]);
  });

  it('devolve lista vazia para mestre sem sistema, sem quebrar o perfil', async () => {
    mockDb([]);

    const res = await request(makeApp()).get('/api/v1/gm/perfis/mestre-teste');

    expect(res.status).toBe(200);
    expect(res.body.data.gm_systems).toEqual([]);
  });

  it('descarta id que não existe mais no catálogo em vez de devolver nome nulo', async () => {
    mockDb([{ system_id: 'pf2e' }, { system_id: 'no-fantasma' }]);

    const res = await request(makeApp()).get('/api/v1/gm/perfis/mestre-teste');

    expect(res.body.data.gm_systems).toEqual([{ id: 'pf2e', name: 'Pathfinder 2e' }]);
  });

  it('catálogo indisponível não derruba o perfil inteiro', async () => {
    // Mesma escolha de `hydrateTableSystemFields`: o resto da ficha é útil sem
    // a lista de sistemas, e 500 aqui apagaria o perfil por uma dependência
    // secundária.
    mockDb([{ system_id: 'pf2e' }]);
    loadFlat.mockRejectedValueOnce(new Error('catálogo fora do ar'));

    const res = await request(makeApp()).get('/api/v1/gm/perfis/mestre-teste');

    expect(res.status).toBe(200);
    expect(res.body.data.gm_systems).toEqual([]);
  });
});
