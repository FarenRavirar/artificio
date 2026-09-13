import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = Number(process.env.PORT ?? 3000);
const BUILD_PATH = './build/server/index.js';

// Mesmo nome de env que o `nginx.conf` consumia (`${API_UPSTREAM}:3000`): prod
// manda `mesas-api`, beta manda `mesas-beta-api` (`docker-compose.*.yml:23`).
// Hardcodar `mesas-api` faria o beta proxiar para o container de produção.
const API_UPSTREAM = process.env.API_UPSTREAM ?? 'mesas-api';
const API_TARGET = `http://${API_UPSTREAM}:3000`;

const app = express();

app.disable('x-powered-by');

// O IP real do visitante chega via Cloudflare Tunnel; o backend confia no CIDR
// interno do Docker. Mesma linha dos outros 6 apps Express do monorepo.
app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || '172.18.0.0/16');

// -----------------------------------------------------------------------------
// Proxy para o container da API — ANTES do static e do handler de SSR, senão o
// catch-all do React Router responde 404 para /api e /auth.
//
// NÃO existe `express.json` aqui, de propósito: este processo só encaminha. Um
// body parser consumiria o stream e o upload multipart de banner (12 MB,
// `POST /api/v1/upload`) chegaria vazio ao backend. Quem parseia é o `mesas-api`,
// que já tem `express.json({ limit: '12mb' })`. O limite de tamanho fica no
// backend pelo mesmo motivo — aqui o corpo passa direto, sem bufferizar.
// -----------------------------------------------------------------------------
// As 6 rotas de borda que o `nginx.conf` encaminhava (linhas 41, 63, 72, 82, 91,
// 114). A 7ª (`@og_proxy`, linha 136) não migra: o HTML agora sai do SSR, igual
// para bot e para usuário — era exatamente a divergência que a spec 102 elimina.
//
// `pathFilter` em vez de `app.use('/api', ...)`: montar o middleware num prefixo
// faz o Express tirá-lo de `req.url` antes do proxy, e o backend receberia
// `/v1/health` no lugar de `/api/v1/health` — 404 em toda a API. Medido em
// 2026-09-12 com backend de eco. Montado na raiz, o path chega íntegro.
//
// Filtro em função, não em array, por duas razões medidas em `dist/path-filter.js`:
// 1. O array não aceita glob (`/api/**`) misturado com caminho plano
//    (`/auth/google`) — lança HPM_INVALID_PATH_FILTER_ARRAY_CONFIG e o proxy
//    silenciosamente não casa nada, mandando a API inteira para o SSR.
// 2. Caminho plano casa por prefixo (`indexOf(...) === 0`), então `/auth/google`
//    pegaria `/auth/googlezinho`. O nginx usava `location =` (igualdade exata)
//    em 5 das 6 rotas; só `/api/` era prefixo. A função reproduz os dois.
const EXACT_ROUTES = new Set([
  '/auth/google',
  '/auth/google/callback',
  '/auth/discord/connect',
  '/auth/discord/callback',
  '/sitemap.xml',
]);

const apiProxy = createProxyMiddleware({
  pathFilter: (pathname) =>
    pathname === '/api' || pathname.startsWith('/api/') || EXACT_ROUTES.has(pathname),
  target: API_TARGET,
  changeOrigin: false, // preserva o Host original (era `proxy_set_header Host $host`)
  xfwd: true, // emite X-Forwarded-For/-Proto, como o nginx fazia
  proxyTimeout: 60_000, // equivalente ao `proxy_read_timeout 60s`
  timeout: 60_000,
});

app.use(apiProxy);

// Assets com hash no nome podem ser imutáveis; o resto do client leva cache curto.
app.use(
  '/assets',
  express.static('build/client/assets', { immutable: true, maxAge: '1y' }),
);
app.use(express.static('build/client', { maxAge: '1h' }));

app.use(
  createRequestHandler({
    build: () => import(BUILD_PATH),
    mode: process.env.NODE_ENV,
  }),
);

app.listen(PORT, () => {
  console.log(`[mesas-frontend] SSR ouvindo em :${PORT} — API em ${API_TARGET}`);
});
