/**
 * Allowlist de origens do CSRF (achado CodeQL, PR #273).
 *
 * Módulo separado de propósito: `index.ts` chama `app.listen` no topo, então
 * importá-lo a partir de um teste subiria um servidor real. A política precisa
 * ser importável para que a suíte prove a CONFIGURAÇÃO deste app, e não apenas
 * a implementação do pacote — teste que fabrica a própria lista mede a si mesmo.
 *
 * `ALLOWED_ORIGINS` sozinha NÃO serve: medido na VM (2026-08-18), ela está
 * VAZIA em beta e em produção, porque o front fala com a API por proxy
 * same-origin do nginx (`location /api/`). Lista vazia faria todo POST com
 * cookie cair em 403 — o cliente (`frontend/src/services/api.ts`) usa cookie SSO
 * sem Bearer e não manda `X-XSRF-TOKEN`. Por isso as origens públicas do próprio
 * glossário entram por padrão, no mesmo formato de `links/server/server.ts:45`.
 *
 * Hostnames conferidos em `apps/glossario/README.md` (mapa de tunnel).
 */
const HOSTS_PUBLICOS = [
  'https://glossario.artificiorpg.com',
  'https://glossariobeta.artificiorpg.com',
];

/**
 * Em desenvolvimento o front roda no Vite e chama a API cross-origin
 * (`api.ts:6`, `http://localhost:3000/api`), então o `Origin` é o do Vite e não
 * um host público — sem isto, todo POST local viraria 403 e o CSRF só seria
 * descoberto ao quebrar a máquina de quem desenvolve. O CORS deste app já
 * libera `localhost` pelo mesmo motivo (`index.ts`).
 *
 * Fora de `NODE_ENV=production` apenas: medido na VM, beta e prod rodam com
 * `NODE_ENV=production`, então nenhum ambiente servido ao público herda esta
 * abertura.
 */
const HOSTS_DEV = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

export function resolveCsrfAllowedOrigins(extras: readonly string[] = []): string[] {
  const dev = process.env.NODE_ENV === 'production' ? [] : HOSTS_DEV;
  return Array.from(new Set([...extras, ...HOSTS_PUBLICOS, ...dev]));
}
