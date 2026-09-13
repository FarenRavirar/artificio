/**
 * Base de URL da API para código que roda no SERVIDOR (spec 102 T4.2).
 *
 * O arquivo é **isomórfico** e por isso NÃO usa o sufixo `.server`: essa
 * convenção do React Router marca módulo que o bundle do cliente não pode
 * alcançar, e o build falha com "Server-only module referenced by client" —
 * medido. `catalogService.ts` importa daqui e roda nos dois lados; a separação
 * correta é em tempo de execução (`typeof document`), não em tempo de build.
 *
 * O `fetch` do navegador resolve `/api/v1/...` contra a origem da página, e o
 * nginx faz o proxy para o container da API. No servidor não existe origem: um
 * `fetch('/api/v1/tables/x')` dentro do `loader` lança `Failed to parse URL`.
 *
 * O endereço interno é o MESMO que o nginx já usa (`proxy_pass
 * http://${API_UPSTREAM}:3000` em `nginx.conf:49`), e `API_UPSTREAM=mesas-api`
 * já existe no `docker-compose.prod.yml:23`. Reusar a variável em vez de criar
 * outra evita que frontend e nginx passem a apontar para lugares diferentes
 * depois de uma renomeação de serviço.
 *
 * Chamar a API por dentro da rede Docker (e não por
 * `https://mesas.artificiorpg.com`) mantém o SSR funcionando mesmo se o
 * Cloudflare estiver com problema, e evita um salto de rede por request.
 */
export function getServerApiBase(): string {
  // Em DESENVOLVIMENTO o alvo é `localhost`, não `mesas-api`: o nome do
  // container só resolve dentro da rede Docker, e no `react-router dev` o
  // `loader` roda no processo SSR local — `mesas-api:3000` falha no DNS e as três
  // rotas com loader (`/`, `/mesas/:slug`, `/mestre/:slug`) respondem 500,
  // enquanto o catálogo degrada para vazio. Achado do Codex (P2) na PR #319.
  //
  // `import.meta.env.DEV` e não `NODE_ENV`: é o Vite quem define o modo, e o
  // `server.js` de produção roda o build, onde `DEV` é `false`.
  const padrao = import.meta.env.DEV ? 'localhost' : 'mesas-api';
  const upstream = process.env.API_UPSTREAM ?? padrao;
  const port = process.env.API_UPSTREAM_PORT ?? '3000';
  return `http://${upstream}:${port}`;
}

/**
 * Resolve o caminho `/api/v1/...` para URL absoluta quando estamos no servidor
 * e o mantém relativo no navegador.
 *
 * O mesmo `loader` roda nos dois lados: no SSR do primeiro request e de novo no
 * cliente a cada navegação do usuário. Uma função só, e não duas, é o que
 * garante que servidor e cliente busquem exatamente o mesmo recurso — divergir
 * aqui reintroduziria a diferença entre o que o crawler vê e o que o usuário vê,
 * que é justamente o que esta spec elimina.
 */
export function apiUrl(path: string): string {
  if (typeof document !== 'undefined') return path;
  return `${getServerApiBase()}${path}`;
}

/**
 * Teto de espera do `fetch` dentro de `loader` (spec 102 T4.2).
 *
 * `request.signal` sozinho não protege o SSR: ele aborta quando o VISITANTE
 * desiste, mas backend que aceita a conexão e nunca responde segura o render
 * indefinidamente — o processo fica preso com o crawler esperando, e o Googlebot
 * desiste antes, registrando a URL como lenta ou inacessível.
 *
 * 8s é folgado para uma chamada dentro da rede Docker (o `p99` medido do
 * catálogo é da ordem de centenas de ms) e curto o bastante para o crawler não
 * desistir primeiro. Combinar com `AbortSignal.any` preserva o cancelamento do
 * visitante — usar só o timeout tornaria o render insensível a quem fechou a aba.
 *
 * Achado do CodeRabbit na PR #319.
 */
export const LOADER_TIMEOUT_MS = 8_000;
