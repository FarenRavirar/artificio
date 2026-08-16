import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authorize, refuse, type CommentSubjectGuard } from '@artificio/comments';

/**
 * `requireAuth` do pacote é substituído por um duplo que respeita o MESMO
 * contrato: `401` sem sessão, `req.session` preenchida com ela.
 *
 * A alternativa seria assinar um JWT real, mas `jsonwebtoken` não é dependência
 * declarada do `site` (é transitiva de `@artificio/auth`), e adicionar pacote
 * novo para viabilizar um teste é decisão do mantenedor, não efeito colateral.
 * O que está sob teste aqui é a fachada — que a escrita exige sessão continua
 * provado, porque a rota sem cookie recebe `401` deste mesmo duplo.
 */
vi.mock('@artificio/auth', async (original) => ({
  ...(await original<typeof import('@artificio/auth')>()),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = (req as { cookies?: Record<string, string> }).cookies?.artificio_session;
    if (token !== SESSAO_VALIDA) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as { session?: unknown }).session = {
      user: { id: 'user-1', email: 'u@example.com', name: 'Usuária', role: 'user' },
      exp: Math.floor(Date.now() / 1000) + 300,
    };
    next();
  },
}));

const SESSAO_VALIDA = 'cookie-de-sessao-valido';

import { communityApi, readCorrelationId } from './community-api';
import { createPostSubjectGuard, postCanonicalPath, SITE_SUBJECT_TYPE } from './community/postSubjectGuard';

const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];

async function call(router: express.Router, path: string, init?: RequestInit) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(router);
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test_server_address_missing');
  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

/**
 * Intercepta só o que vai para o `accounts.`, deixando o `fetch` do próprio
 * teste (contra o servidor efêmero) passar direto. Sem esta separação, qualquer
 * `mockResolvedValueOnce` é consumido pela requisição do teste e a fachada
 * acaba falando com a rede de verdade.
 */
/**
 * Host comparado por `URL.hostname`, e **não** por `startsWith` (achado CodeQL,
 * PR #264). `'https://accounts.example'` como prefixo casaria também com
 * `https://accounts.example.evil.com` — o host real seria `evil.com`, e o
 * intercept devolveria a resposta falsa para um destino que não é o esperado.
 *
 * Aqui o efeito seria só um teste passando por engano, mas o padrão é o mesmo
 * que em produção vira SSRF/bypass de allowlist, e vale corrigir onde ele
 * aparece para não virar molde copiado adiante.
 */
function ehAccounts(url: unknown): boolean {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === 'https:' && parsed.hostname === 'accounts.example';
  } catch {
    // URL relativa (a do servidor efêmero do próprio teste) não parseia sozinha
    // e não é o destino procurado.
    return false;
  }
}

function interceptaAccounts(resposta: Response) {
  const real = globalThis.fetch;
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (ehAccounts(input)) return Promise.resolve(resposta);
    return real(input as RequestInfo, init);
  });
}

/** Guard que sempre autoriza — isola o que está sob teste na fachada. */
const guardOk: CommentSubjectGuard = async () =>
  authorize({
    exists: true,
    visible: true,
    commentable: true,
    ownerUserId: null,
    canonicalPath: '/blog/post-teste/',
  });

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))));
});

describe('guard de post publicado', () => {
  /** Duplo do `Db` do site: só `query` é exercido pelo guard. */
  const dbCom = (rows: Array<{ slug: string; status: string }>) =>
    () => Promise.resolve({ query: async () => ({ rows }) } as never);

  it('autoriza post publicado com canonical_path de barra final', async () => {
    const guard = createPostSubjectGuard(dbCom([{ slug: 'meu-post', status: 'publish' }]));

    const result = await guard({ subjectType: SITE_SUBJECT_TYPE, subjectId: '42' }, 'user-1');

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      // A barra final não é cosmética: `trailingSlash: "always"` faz `/blog/x`
      // e `/blog/x/` serem páginas distintas, e só a segunda existe.
      expect(result.authorization.canonicalPath).toBe('/blog/meu-post/');
      // Sempre nulo: `posts` não tem coluna de autor (blog importado do WP).
      expect(result.authorization.ownerUserId).toBeNull();
    }
  });

  it('recusa status que não seja publish', async () => {
    const guard = createPostSubjectGuard(dbCom([{ slug: 'rascunho', status: 'draft' }]));

    const result = await guard({ subjectType: SITE_SUBJECT_TYPE, subjectId: '42' }, 'user-1');

    expect(result.authorized).toBe(false);
  });

  it('recusa post inexistente e subject_type alheio', async () => {
    const vazio = createPostSubjectGuard(dbCom([]));
    expect((await vazio({ subjectType: SITE_SUBJECT_TYPE, subjectId: '42' }, 'u')).authorized).toBe(false);

    // `downloads.material` aqui não é "post que não achei": é o app perguntando
    // a coisa errada, e o guard não pode fingir ter consultado outro domínio.
    const alheio = createPostSubjectGuard(dbCom([{ slug: 'x', status: 'publish' }]));
    expect((await alheio({ subjectType: 'downloads.material', subjectId: '42' }, 'u')).authorized).toBe(false);
  });

  /**
   * `posts.id` é `BIGINT`. Sem a guarda textual, um `subject_id` não-numérico
   * chegaria ao Postgres e morreria com `invalid input syntax for type bigint`
   * — `500` onde o correto é `404`. O teste falha se a validação sair.
   */
  it('recusa subject_id não numérico antes de tocar o banco', async () => {
    const query = vi.fn();
    const guard = createPostSubjectGuard(() => Promise.resolve({ query } as never));

    const result = await guard({ subjectType: SITE_SUBJECT_TYPE, subjectId: "1; DROP TABLE posts" }, 'u');

    expect(result.authorized).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('escapa slug no canonical_path', () => {
    expect(postCanonicalPath('pós & cia')).toBe('/blog/p%C3%B3s%20%26%20cia/');
  });
});

describe('fachada da conversa', () => {
  beforeEach(() => {
    vi.stubEnv('ACCOUNTS_URL', 'https://accounts.example');
    vi.stubEnv('SERVICE_CREDENTIAL', 'token-de-servico');
  });

  it('exige subject_id na leitura', async () => {
    const response = await call(communityApi(guardOk), '/');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_query' });
  });

  it('degrada com 503 quando falta configuração do accounts.', async () => {
    vi.stubEnv('ACCOUNTS_URL', '');

    const response = await call(communityApi(guardOk), '/?subject_id=42');

    // `503` e não `500`: o serviço existe, está indisponível, e o
    // `CommentsResource` do pacote degrada para `stale`/`unavailable` com isso.
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'community_comments_unavailable' });
  });

  it('repassa árvore do accounts. e propaga subject_type do site', async () => {
    // O mock precisa distinguir a chamada da FACHADA (para o `accounts.`) da
    // chamada do próprio teste (para o servidor efêmero): as duas passam pelo
    // mesmo `globalThis.fetch`, e um `mockResolvedValueOnce` seria consumido
    // pela primeira que acontecer — que é a do teste.
    const spy = interceptaAccounts(
      new Response(JSON.stringify({ comments: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await call(communityApi(guardOk), '/?subject_id=42&sort=best');

    expect(response.status).toBe(200);
    // Casa pelo host parseado + path, nunca por substring da URL inteira.
    const chamada = spy.mock.calls.find(([url]) => ehAccounts(url) && String(url).includes('/internal/v1/comments'));
    expect(String(chamada?.[0])).toContain(`subject_type=${encodeURIComponent(SITE_SUBJECT_TYPE)}`);
    // A credencial de serviço vive só na fachada — nunca no navegador (req. 6a).
    expect((chamada?.[1]?.headers as Record<string, string>)['X-Service-Token']).toBe('token-de-servico');
  });

  it('vira 502 quando o accounts. responde algo que não é JSON', async () => {
    interceptaAccounts(new Response('<html>bad gateway</html>', { status: 200 }));

    const response = await call(communityApi(guardOk), '/?subject_id=42');

    // HTML de página de erro nunca é repassado cru: o schema do cliente tentaria
    // interpretá-lo e o erro apareceria como "contrato incompatível".
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: 'invalid_accounts_response' });
  });

  it('recusa escrita sem sessão', async () => {
    const response = await call(communityApi(guardOk), '/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject_id: '42', body_markdown: 'olá' }),
    });

    expect(response.status).toBe(401);
  });

  it('devolve 404 uniforme quando o guard recusa o assunto', async () => {
    const guardRecusa: CommentSubjectGuard = async () => refuse('not_visible');
    // Token REAL, assinado com o mesmo `JWT_SECRET` que `requireAuth` verifica.
    // Injetar `req.session` por middleware pularia justamente o caminho de
    // autenticação que a rota de escrita exige — o teste passaria mesmo se o
    // `requireAuth` saísse da rota.
    const spy = interceptaAccounts(new Response('{}', { status: 200 }));

    const response = await call(communityApi(guardRecusa), '/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `artificio_session=${SESSAO_VALIDA}`,
      },
      body: JSON.stringify({ subject_id: '42', body_markdown: 'olá' }),
    });

    // O `404` protege contra oráculo de existência sobre rascunho — e nada pode
    // ter vazado para o `accounts.` antes da recusa. O spy também vê a chamada
    // do próprio teste ao servidor efêmero, então a asserção é sobre o destino,
    // não sobre a contagem total.
    expect(response.status).toBe(404);
    expect(spy.mock.calls.filter(([url]) => ehAccounts(url))).toHaveLength(0);
  });
});

describe('rate limit da fachada', () => {
  it('declara orçamentos separados para leitura e escrita nas 6 rotas', () => {
    const fonte = readFileSync(
      fileURLToPath(new URL('./community-api.ts', import.meta.url)),
      'utf8',
    );

    // Achado CodeQL (PR #264): o `globalLimiter` do servidor conta TODAS as
    // rotas do `site` num balde só, então rajada de escrita de comentário
    // consome o orçamento da navegação do blog — e escrita ficaria com o mesmo
    // teto da leitura, apesar do custo e do risco de abuso maiores.
    //
    // A asserção é sobre o FONTE porque exercitar o limiter de verdade exigiria
    // 300 requisições por teste; o que precisa ser garantido é que nenhuma rota
    // fique descoberta quando alguém adicionar a próxima.
    const rotas = fonte.match(/^ {2}r\.(get|post|patch|delete|put)\(/gm) ?? [];
    expect(rotas).toHaveLength(6);

    const comLimiter = fonte.match(/^ {2}r\.\w+\("[^"]*",\s*(read|write)RateLimiter,/gm) ?? [];
    expect(comLimiter).toHaveLength(6);

    // Leitura e escrita em baldes distintos, com o teto da escrita menor.
    expect(fonte).toMatch(/readRateLimiter = rateLimit\(\{[\s\S]*?limit: 300/);
    expect(fonte).toMatch(/writeRateLimiter = rateLimit\(\{[\s\S]*?limit: 60/);
  });
});

describe('correlation id', () => {
  it('aceita ASCII imprimível e recusa o resto', () => {
    expect(readCorrelationId('req-123')).toBe('req-123');
    expect(readCorrelationId(undefined)).toBeNull();
    expect(readCorrelationId('')).toBeNull();
    // Caractere de controle: log e response splitting é o risco clássico.
    expect(readCorrelationId('req\n123')).toBeNull();
    expect(readCorrelationId('x'.repeat(129))).toBeNull();
  });
});
