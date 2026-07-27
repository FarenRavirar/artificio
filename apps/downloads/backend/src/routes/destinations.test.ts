import request from 'supertest';
import express from 'express';

// Spec 088 — a resolucao de destino passou a REGISTRAR o acesso.
//
// Motivo: o CTA da ficha virou ancora nativa (`target="_blank"`), e o
// `onClick` do React so dispara no clique primario — botao do meio,
// `Ctrl+clique` e "Abrir em nova aba" seguem o `href` direto. Registrar so no
// handler perderia metrica nesses fluxos e deixaria o usuario autenticado
// inelegivel pra avaliar (o guard de avaliacao exige download registrado).
// Esta rota e o unico ponto que TODA abertura atravessa.

const dbMocks = vi.hoisted(() => ({
  selectFrom: vi.fn(),
}));

const registryMocks = vi.hoisted(() => ({
  registerMaterialDownload: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: null as { userId: string; role: 'user' } | null,
}));

vi.mock('../db', () => ({
  db: { selectFrom: dbMocks.selectFrom },
}));

vi.mock('../services/downloadRegistry', () => ({
  registerMaterialDownload: registryMocks.registerMaterialDownload,
}));

vi.mock('../middleware/auth', () => ({
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = authState.user ?? undefined;
    next();
  },
}));

import destinationsRoutes from './destinations';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/destinations', destinationsRoutes);
  return server;
}

function mockDestination(row: unknown) {
  dbMocks.selectFrom.mockReturnValue({
    innerJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn().mockResolvedValue(row),
  });
}

const publishedRow = {
  material_id: 'material-1',
  external_url: 'https://exemplo.test/arquivo.pdf',
  editorial_state: 'published',
};

describe('GET /destinations/:id', () => {
  beforeEach(() => {
    authState.user = null;
    registryMocks.registerMaterialDownload.mockReset().mockResolvedValue({ countedNow: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolve a URL externa de material publicado', async () => {
    mockDestination(publishedRow);

    const response = await request(app()).get('/api/v1/destinations/dest-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ external_url: 'https://exemplo.test/arquivo.pdf' });
  });

  it('registra o acesso quando ha sessao — mesmo sem passar pelo onClick', async () => {
    authState.user = { userId: 'user-1', role: 'user' };
    mockDestination(publishedRow);

    await request(app()).get('/api/v1/destinations/dest-1');

    // Este e o caso do botao do meio / "Abrir em nova aba": nenhum handler de
    // clique roda, mas o acesso e contabilizado do mesmo jeito.
    expect(registryMocks.registerMaterialDownload).toHaveBeenCalledWith('user-1', 'material-1');
  });

  it('nao registra nada para visitante sem sessao', async () => {
    mockDestination(publishedRow);

    const response = await request(app()).get('/api/v1/destinations/dest-1');

    expect(response.status).toBe(200);
    // A metrica de download e por conta (dedup em `(user_id, material_id)`),
    // entao visitante anonimo nao tem o que registrar.
    expect(registryMocks.registerMaterialDownload).not.toHaveBeenCalled();
  });

  // Fail-closed preservado: o registro entrou DEPOIS do guard, entao destino
  // que nao resolve continua 404 e nao contabiliza acesso nenhum.
  it('material nao publicado retorna 404 e nao registra', async () => {
    authState.user = { userId: 'user-1', role: 'user' };
    mockDestination({ ...publishedRow, editorial_state: 'draft' });

    const response = await request(app()).get('/api/v1/destinations/dest-1');

    expect(response.status).toBe(404);
    expect(registryMocks.registerMaterialDownload).not.toHaveBeenCalled();
  });

  it('destino inexistente retorna 404 e nao registra', async () => {
    authState.user = { userId: 'user-1', role: 'user' };
    mockDestination(undefined);

    const response = await request(app()).get('/api/v1/destinations/dest-1');

    expect(response.status).toBe(404);
    expect(registryMocks.registerMaterialDownload).not.toHaveBeenCalled();
  });

  // Fail-soft: metrica nunca pode impedir o acesso ao material.
  it('falha ao registrar nao derruba a resolucao do destino', async () => {
    authState.user = { userId: 'user-1', role: 'user' };
    mockDestination(publishedRow);
    registryMocks.registerMaterialDownload.mockRejectedValue(new Error('banco fora'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await request(app()).get('/api/v1/destinations/dest-1');

    expect(response.status).toBe(200);
    expect(response.body.external_url).toBe('https://exemplo.test/arquivo.pdf');
    expect(consoleError).toHaveBeenCalled();
  });
});
