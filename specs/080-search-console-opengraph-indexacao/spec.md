# 080 — Search Console + Open Graph + indexação (site, mesas, glossario)

- **Módulo/Pacote:** apps/site, apps/mesas, apps/glossario
- **Gate relacionado:** D (qualidade transversal, pós-Gate C)

## Problema

Google Search Console não está configurado/funcionando pra nenhum dos três domínios públicos. Open Graph (preview em WhatsApp/Discord/Telegram/Slack) não funciona em nenhum app. Cada mesa individual (rota `mesas.artificiorpg.com/mesa/:slug` ou equivalente) precisa ser indexável e ter OG próprio — hoje não há garantia disso.

Achados de investigação (2026-07-17):

1. **sitemap.xml ausente em runtime, mesmo com `robots.txt` apontando pra ele:**
   - `apps/mesas/frontend/public/robots.txt` e `apps/glossario/frontend/public/robots.txt` citam `Sitemap: https://<app>.artificiorpg.com/sitemap.xml`.
   - Nenhuma rota backend/frontend serve `/sitemap.xml` em mesas nem glossario — grep em `apps/mesas/backend` e `apps/glossario/backend` por "sitemap": zero arquivos.
   - `packages/content/src/sitemap.ts` (`sitemapXml()`) já existe, comentado como "p/ módulos não-Astro (mesas/glossário)" — função pronta, nunca consumida.
   - `apps/site` usa `@astrojs/sitemap` (geração automática) — mas `BL-SITE-PRINCIPAL-GAPS` já registrou `/sitemap.xml` 404 (só `/sitemap-index.xml` 200) como gap aberto — precisa reconfirmar estado atual, pode já ter mudado desde o registro do backlog.

2. **Verificação de propriedade Google Search Console: nenhuma evidência de configuração** (meta tag `google-site-verification`, arquivo HTML de verificação, ou registro DNS TXT documentado) pra nenhum dos três domínios/subdomínios. Sem propriedade verificada, sitemap não pode ser submetido manualmente nem status de indexação é visível.

3. **Open Graph:**
   - `apps/mesas/backend/src/routes/og.ts` existe e monta `/og/:type/:slug` com SSR de meta tags (title/description/image/canonical) — mas não está confirmado se o frontend real usa essa rota (ex.: bots leem `/og/mesa/:slug` em vez do SPA puro?) nem se preview funciona de fato hoje (Discord/WhatsApp).
   - `apps/glossario`: zero infraestrutura de OG encontrada (nenhum arquivo com `og:image`/`og:title`/`open graph`).
   - `apps/site`: usa Astro, tem OG parcial (`db/migrations/003_authoring.sql` sugere campos de metadata, não confirma tags renderizadas) — precisa auditoria de página real.

4. **Indexação por mesa:** cada mesa publicada precisa ter URL própria crawleável e presente no sitemap dinâmico (gerado a partir do banco, não estático), com OG específico (imagem/título/descrição da mesa).

## Requisitos (numerados, testáveis)

1. `GET https://mesas.artificiorpg.com/sitemap.xml` retorna XML válido (200, `Content-Type: application/xml`), listando home + todas as mesas publicadas ativas (URL canônica de cada mesa).
2. `GET https://glossario.artificiorpg.com/sitemap.xml` retorna XML válido, listando home + todos os verbetes publicados.
3. `GET https://artificiorpg.com/sitemap.xml` (ou `/sitemap-index.xml`, o que for o real do Astro) responde 200 e é o mesmo referenciado no `robots.txt` do site — sem 404 (reconfirmar/fechar `BL-SITE-PRINCIPAL-GAPS` item D se já resolvido, ou corrigir se ainda quebrado).
4. Propriedade Google Search Console verificada para os 3 domínios/subdomínios (método a definir: meta tag ou DNS TXT — mantenedor decide, GSC dashboard é ação fora do repo).
5. Sitemaps dos 3 domínios submetidos no GSC após verificação (ação do mantenedor, spec só entrega o sitemap funcional + instrução).
6. Compartilhar link de uma mesa específica (mesas), verbete específico (glossario) e página específica (site) em WhatsApp/Discord/Telegram gera preview com título, descrição e imagem corretos — validado manualmente (smoke real, não é dry-run).
7. Rota de mesa individual responde conteúdo indexável a crawler (SSR ou meta tags server-rendered via `og.ts`-like, não só SPA client-render vazio pra bot).
8. `robots.txt` dos 3 apps continua sem bloquear crawler (`Allow: /`) — não regressar.

## Critérios de aceite

- Sitemap real (não 404) nos 3 domínios, gerado dinamicamente a partir do banco onde aplicável (mesas/glossario), contendo todas as entidades publicadas no momento da geração.
- Preview OG funcional comprovado com screenshot/captura real de WhatsApp ou Discord ou debugger oficial (Facebook Sharing Debugger / Twitter Card Validator) pros 3 apps.
- GSC configurado — verificação de propriedade confirmada pro mantenedor conseguir ver status de indexação no dashboard (ação fora do repo, mas a spec entrega o artefato técnico necessário: meta tag/arquivo).
- Nenhuma regressão em `robots.txt` existente.
- `specs/backlog.md` atualizado: fecha/ajusta `BL-SITE-PRINCIPAL-GAPS` item D e `BL-SITE-CUTOVER-029` T10 se cobertos por esta spec; registra o que ficar pendente.

## Fora de escopo

- Lighthouse/performance (já coberto por `BL-QA-MESAS-PERF`, spec própria futura).
- Verificação de propriedade em si dentro do dashboard GSC (ação manual do mantenedor, fora do repo) — spec entrega só o artefato técnico (meta tag/arquivo/DNS a configurar).
- Redesenho de OG image (arte/template visual) além do necessário pra preview funcionar — usar imagem/fallback simples se não houver arte pronta.
- `apps/downloads`, `apps/esferas`, `apps/srd`, `apps/links` (specs próprias quando esses projetos existirem/forem ao ar).

## Riscos e impacto em outros módulos

- Sitemap de mesas/glossario expõe URLs de conteúdo — checar se algum registro (mesa/verbete) não deveria ser público antes de listar (ex.: mesa não publicada, rascunho).
- Rota SSR de OG (`og.ts`) já existe em mesas — reaproveitar em vez de duplicar; qualquer mudança ali é só extensão, não reescrita.
- `packages/content/src/sitemap.ts` é pacote compartilhado — qualquer mudança nele é SDD Completo e exige checar todos os consumidores (hoje só teoricamente mesas/glossario, mas confirmar se `site` também referencia antes de mexer).
- Meta tag/verificação GSC errada pode falhar silenciosamente — validar com ferramenta oficial do Google antes de considerar fechado.
- **Escopo ampliado durante implementação (2026-07-17):** pra `apps/glossario/backend` (CommonJS) conseguir importar `@artificio/content` (hoje ESM-only), a spec passou a tocar também `packages/content` (build dual ESM+CJS) e possivelmente `packages/config` (campos `main`/`types` legados, pra resolução CJS funcionar) — ambos pacotes compartilhados, escopo SDD Completo, checar todos os 16 consumidores de `@artificio/config` antes de alterar. Detalhe da investigação e decisões em `tasks.md` Fase 1a.
