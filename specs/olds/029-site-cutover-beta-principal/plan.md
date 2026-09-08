# Plano — 029 Cutover beta → principal

## Arquitetura

Cutover em 2 frentes coordenadas:

- **Frente A (mantenedor, infra):** Cloudflare — adicionar public hostname do Tunnel `artificiorpg.com` (+ `www`) → service do container do site (o mesmo de `beta.`); ajustar DNS da raiz (sai do Hostinger/WP, entra no Tunnel). Agente não executa; só verifica read-only depois.

### Frente A — passo a passo Cloudflare (mantenedor)

> Valores verificados read-only 2026-06-17: a rota `beta.artificiorpg.com` aponta para `originService=http://site-beta-app:4322` no mesmo Tunnel (container `cloudflared`, token-based, gerido no painel Zero Trust — NÃO em config.yml local). Replicar para a raiz.

1. **Zero Trust → Networks → Tunnels → (tunnel do Artifício) → aba Public Hostnames → Add a public hostname:**
   - **Subdomain:** (vazio = apex) · **Domain:** `artificiorpg.com` · **Path:** (vazio)
   - **Service → Type:** `HTTP` · **URL:** `site-beta-app:4322`
   - (idêntico ao destino do `beta.`, que já é `http://site-beta-app:4322`)
2. **Repetir para `www`:** Subdomain `www`, Domain `artificiorpg.com`, mesmo Service `HTTP site-beta-app:4322` — OU criar regra de redirect `www → apex` (preferir canônico único na raiz).
3. **DNS (aba DNS do domínio):** adicionar public hostname no Zero Trust cria/atualiza automaticamente um **CNAME proxied no apex** apontando para `<tunnel-uuid>.cfargotunnel.com` (flattening de apex do Cloudflare). **Conflito a resolver:** o apex hoje aponta para o **Hostinger/WP** (registro A/CNAME existente). Remover/substituir esse registro do apex (e o `www`) pelo do Tunnel — senão a raiz continua no WP. Manter **proxied (nuvem laranja)**.
4. **Resultado:** `artificiorpg.com` passa a servir o container do site via Tunnel; o WP/Hostinger fica fora do caminho do domínio (pode sair do ar no EOL ~06-20).

### Verificação (agente, read-only após T1)
`curl https://artificiorpg.com/healthz` = 200; home/post/page 200; HTML sem `wp-content`/Elementor/Site Kit; `www` resolve para a raiz.

> Observação: nos logs do `cloudflared` há erros intermitentes `Unable to reach origin ... lookup site-beta-app ... server misbehaving` (resolver DNS interno da Oracle, workaround `resolvectl` no infra-map). O beta responde 200 hoje; se a raiz falhar com esse erro, aplicar/persistir o workaround de DNS da VM antes de concluir o cutover.
- **Frente B (agente, código via PR):** trocar o domínio base `beta.` → raiz nos pontos mapeados; rebuild/redeploy do site + consumidores da UI.

Base centralizada: `astro.config.mjs` `site` dirige canonical/sitemap/RSS/robots. UI compartilhada (`packages/ui`) dirige os links de Footer/Header/Portal de todos os módulos.

## Arquivos afetados

- `apps/site/astro.config.mjs` (`site`).
- `apps/site/src/pages/robots.txt.ts`, `rss.xml.ts` (fallbacks).
- `packages/ui/src/Footer.tsx`, `Header.tsx`, `modules.ts` (hrefs) — **compartilhado**.
- `apps/accounts/frontend/src/main.tsx` (`PORTAL_URL`).
- `apps/site-admin/src/pages/PageEditor.tsx`, `PostEditor.tsx` (preview).
- `.env`/compose do site: avaliar `SITE_IMPORT_ON_START=false` pós-EOL.

## Contratos/interfaces

- **DNS/Tunnel:** mantenedor (raiz → container do site).
- **SEO:** canonical/sitemap/RSS migram p/ raiz; 301 dos slugs preservado (redirect-cache); decidir `noindex`/redirect do `beta.` p/ não duplicar índice.
- **Auth:** sem mudança (cookie `.artificiorpg.com` já cobre raiz).

## Impacto em consumidores

- `packages/ui` → rebuild+redeploy PROD de `glossario`, `mesas`, `accounts` + `site`. Smoke por módulo.
- Posts/SSG: rebuild com `site=raiz` regenera canonical/sitemap/RSS.

## Rollback

- Reverter o PR de código (volta a beta). DNS revert = mantenedor.
- Como `beta.` continua servindo o mesmo container, um problema na raiz não derruba o beta.

## Validação

- Read-only após DNS: `artificiorpg.com/healthz` 200, home/post/page 200, `wp-content` ausente.
- Pós-flip+deploy: canonical/OG/sitemap/RSS na raiz; grep `wp-content/uploads` dist/live=0; deploys prod dos consumidores verdes; URLs antigas do blog resolvem.
