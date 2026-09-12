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
  const upstream = process.env.API_UPSTREAM ?? 'mesas-api';
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
