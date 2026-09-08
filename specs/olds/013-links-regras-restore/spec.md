# 013 — `links.artificiorpg.com`: diretório de grupos de WhatsApp + regras + submissão comunitária

> **Evolução de escopo (2026-06-20).** A spec nasceu como "restaurar `links.`/`regras.`" (página estática linktree). O mantenedor expandiu para um **diretório comunitário com moderação**: além dos grupos curados e das regras, a comunidade (usuários logados via SSO) **sugere grupos**, e o admin (SSO role `admin`) **modera** (aceita/edita/exclui/arquiva/troca link). Logos de **todos** os grupos saem do og:image e sobem no Cloudinary, igual aos outros módulos. `regras.` deixou de ser hostname separado — as regras viram seção **dentro** do app links.
>
> Isso eleva a spec a **SDD Completo** (toca SSO/`@artificio/auth`, DB, Cloudinary, `packages/ui` shared, deploy/infra). Folder mantém o nome histórico `013-links-regras-restore`.

- **Módulo/Pacote:** `apps/links` (novo, app completo) + `packages/ui` (nav `defaultNavItems`) + infra (Cloudflare Tunnel `links.`)
- **Gate:** D (módulo novo; smoke ao final)
- **Nível SDD:** **Completo**
- **Specs relacionadas:** 014 (item de nav "WhatsApps"), 035 FASE 5 (índice de execução, T-LNK)
- **Sessão:** `sessoes/26-06-20_2_links_whatsapp-013-014.md`
- **Revisões:** `review-ux-design.md` (2ª revisão independente: UX/Nielsen/ISO 9241-11/estilo/predição de bugs)

---

## Decisões do mantenedor (2026-06-20)

| # | Decisão | Detalhe |
|---|---|---|
| D-LNK-1 | **Host único `links.artificiorpg.com`** | `regras.` NÃO é hostname separado; regras entram como seção no app. |
| D-LNK-2 | **Fonte do conteúdo curado** | `https://artificiorpg.com/grupos-de-whatsapp-de-rpg-de-mesa/` (grupos + regras). |
| D-LNK-3 | **Layout = sidebar esquerda expansível** | Abre em **Grupos**; **Regras** colapsado abaixo; **Grupos de RPG** (comunitário) abaixo de Regras; **Projetos** (nav suite). |
| D-LNK-4 | **Logos via og:image → Cloudinary** | **Todos** os grupos (curados + comunitários), igual aos outros módulos (signed preset, sem hardcode de credencial). |
| D-LNK-5 | **Label do nav = "WhatsApps"** (plural) | Em `packages/ui/src/modules.ts` (`defaultNavItems`), propaga p/ `MODULES` do site. |
| D-LNK-6 | **Header SSO compartilhado + login** | Reusar `@artificio/ui` Header (login/userMenu); não duplicar shell. |
| D-LNK-7 | **Admin = SSO role `admin`** | Padrão do site (D052). Sem email hardcoded. (Mantenedor `paulohenriquercc@gmail.com` é admin no SSO.) |
| D-LNK-8 | **Seção comunitária = island React + API dinâmica** | Backend Express serve `/api/groups`; lista hidrata client-side; aprovação aparece sem rebuild. JS escopado só à ilha da lista. |
| D-LNK-9 | **Submissão por usuário logado; moderação por admin** | Sugestão chega com `status=pending`; admin aceita → `status=active`. Admin pode editar/excluir/arquivar/trocar link. |
| D-LNK-10 | **Stack = espelhar `apps/mesas`** (não `apps/site`) | spec 033 atualizou ferramentas. Backend: **Kysely ^0.29.2 + pg ^8.20 + cloudinary ^2.9 + express ^5.2.1 + express-rate-limit ^8.5.2 + zod ^4.4.3 + sanitize-html**. DB **pg-only** (sem pglite). Migrations via framework D039 (`database/migration_*.sql`). |
| D-LNK-11 | **Tags múltiplas (≤3) + vocabulário gerido pelo admin** | `groups.tags TEXT[]` (slugs); tabela `group_tags(slug imutável, label, sort_order)` com CRUD admin. Ex.: Mestres, Jogadores, DnD, Cenários. |
| D-LNK-12 | **Flag +18 por grupo** | `groups.is_adult BOOLEAN` (admin edita). |
| D-LNK-13 | **SEO + cards/slugs publicados + regras por grupo + datas** | Cada grupo ativo → página `/grupo/<slug>` indexável (sitemap/GSC/canonical/OG/JSON-LD). `groups.slug`, `groups.rules` (regras próprias além da descrição), `groups.approved_at` (+ `created_at`) exibidos. Ref: `gruposwhats.app`. |
| D-LNK-14 | **Painel CRUD admin organizado** | Rota gated no próprio `apps/links` p/ gerir TUDO: grupos (editar nome/desc/regras/tags/+18/categoria/link/slug, aceitar/arquivar/excluir) e vocabulário de tags. Lista de moderação mostra **email e nome de quem sugeriu** (`submitted_email`/`submitted_name`, denormalizados do SSO no insert). |

---

## Problema

`links.artificiorpg.com` (hub de grupos de WhatsApp, estilo linktree) saiu do ar na migração da VM; `apps/links` nunca existiu no monorepo; artefato original nunca foi versionado (D027, T6 da spec 001 não executada). Decisão: **refazer do zero** (mantenedor 2026-06-11), agora como diretório comunitário moderado.

---

## Requisitos (numerados, testáveis)

### Público
1. `https://links.artificiorpg.com` (200) serve uma página com **sidebar esquerda expansível**: **Grupos** (curados, aberto por padrão), **Regras** (colapsado), **Grupos de RPG** (comunitários, aprovados), **Projetos** (nav suite).
2. Header SSO compartilhado (`@artificio/ui`) com **login** (redireciona a `accounts.`) e userMenu quando logado.
3. Grupos curados (3 categorias: Do Artifício RPG, Temáticos, Parceiros) renderizados com logo (Cloudinary), nome, tag e descrição; cada card abre o convite WhatsApp em nova aba.
4. Seção **Regras** com o conteúdo das regras dos grupos (estático, fiel à página ref).
5. Seção **Grupos de RPG**: lista (island React) dos grupos comunitários **aprovados** (`status=active`, `source=community`), buscando `/api/groups`.

### Submissão + moderação
6. Usuário **logado** (SSO) pode **sugerir** um grupo: `POST /api/groups/suggest` com **nome, descrição e link de convite** (categoria entra fixa como `comunidade`; o admin recategoriza na moderação). Backend valida o link (`chat.whatsapp.com/*` ou `whatsapp.com/channel/*`), sanitiza o texto, grava `status=pending source=community` com `submitted_by/email/name`. og:image → Cloudinary é resolvido **na aceitação** pelo admin (não no envio, p/ não dar trabalho à superfície hostil). Anônimo recebe 401; rate-limit por IP.
7. Admin (SSO role `admin`) modera via API gated (`requireAuth`+`requireAdmin`): listar (por status), **aceitar** (→ `active`, gera slug + `approved_at` + logo og→Cloudinary), **editar** (nome/desc/**regras**/**tags ≤3**/**+18**/categoria/**link**/**slug**), **arquivar** (`archived`), **excluir**. Trocar link re-busca og:image → Cloudinary. Painel CRUD organizado (ver req. 20).
8. Anti-spam: rate-limit por IP nas submissões (reusar padrão do feedback do site); sanitizar entrada textual (HTML hostil = regra pétrea).

### Tags, +18, regras e datas (D-LNK-11/12/13)
15. Cada grupo tem **até 3 tags** (chips no card). Vocabulário em `group_tags`, **gerido pelo admin** (`/api/admin/v1/tags/*`: criar/editar label/remover; slug imutável; remover tira o slug de todos os grupos).
16. Cada grupo tem flag **+18** (`is_adult`); card exibe badge quando verdadeiro.
17. Cada grupo tem **regras próprias** (`rules`, sanitizado) exibidas na página do card, além da descrição.
18. Card/página exibe **quando foi enviado** (`created_at`) e **quando foi aprovado** (`approved_at`, set no accept).

### SEO / Google Search Console (D-LNK-13)
19. Cada grupo ativo é publicado em **`/grupo/<slug>`** indexável: sitemap (`@astrojs/sitemap`), `robots.txt`, meta `<title>/description`/**canonical**/OG/**JSON-LD**, verificação GSC (`PUBLIC_GSC_VERIFICATION`). Slug estável (não muda ao editar nome). Rebuild pós-moderação.

### Painel CRUD admin (D-LNK-14)
20. `apps/links` tem **painel admin organizado** (rota gated `requireAuth`+`requireAdmin`) para gerir todas as opções:
    - **Grupos:** fila de pendentes + lista de ativos/arquivados; editar nome, descrição, **regras**, **tags** (≤3), **+18**, categoria, **link** (re-busca og), **slug**; **aceitar / arquivar / excluir**.
    - **Tags (vocabulário):** criar / editar label / remover.
    - Cada item de moderação exibe **email + nome** de quem sugeriu, status, e datas enviado/aprovado.
21. Identidade do remetente: no `POST /api/groups/suggest`, gravar `submitted_by` (id SSO), `submitted_email`, `submitted_name` (do cookie de sessão). Exibidos só no painel admin (não no público).

### Plataforma / reuso
9. Backend = **espelha `apps/mesas`** (D-LNK-10): Express 5 + **Kysely ^0.29 / pg** + zod + sanitize-html + express-rate-limit + `@artificio/auth` (`verifyToken`/`requireAuth`, cookie `artificio_session`). **pg-only** (sem pglite). **Não** mexer em `packages/auth` (auth sagrado).
10. Cloudinary via helper copiado do padrão mesas/site (`uploadLogoFromUrl`); débito **`BL-CLOUDINARY-SHARED`** aberto (3 consumidores → promover a `packages/*`).
11. Logos otimizadas/servidas via Cloudinary; sem credencial hardcoded.
12. Nav: item **"WhatsApps"** → `links.artificiorpg.com` em `defaultNavItems` (`packages/ui`) + espelho `MODULES` (`apps/site`).
13. Deploy canônico: módulo padrão (app + db) via `_deploy-module.yml` + entrada em `deploy-manifest.json` (dispatch-only); `.env` com `JWT_SECRET` casado ao accounts (D042).
14. Tunnel `links.artificiorpg.com` → container (ação do mantenedor; token CF atual **não** tem escopo tunnel — ver Riscos).

---

## Critérios de aceite

- [ ] `links.artificiorpg.com` 200 com grupos curados + regras + seção comunitária + header SSO (mantenedor valida).
- [ ] Login SSO funciona (redirect `accounts.`, sessão lida via cookie raiz).
- [ ] Usuário logado sugere grupo → aparece como pendente; admin aceita → aparece na lista pública; logo no Cloudinary.
- [ ] Admin edita/arquiva/exclui/troca link com efeito real, **incluindo tags (≤3), +18, regras e slug**.
- [ ] **Vocabulário de tags:** admin cria/edita/remove; remover tira o slug dos grupos; card mostra labels.
- [ ] **Card/página exibe** tags, badge +18 (quando `is_adult`), regras do grupo, **enviado/aprovado**.
- [ ] **Painel admin** lista moderação com **email + nome de quem sugeriu**.
- [ ] **SEO:** `/grupo/<slug>` 200 indexável; sitemap lista os ativos; canonical/OG/JSON-LD presentes; verificação GSC.
- [ ] Build turbo verde de `@artificio/links` + consumidores do nav (`ui`/`site`/`mesas`/`glossario`/`accounts`).
- [ ] Item "WhatsApps" no nav de site/mesas/accounts/glossário (smoke), sem link morto (só após `links.` no ar — dep. spec 014 R5).
- [ ] D027 fechado em `decisions.md`; roadmap/backlog atualizados.
- [ ] Checklist Nielsen/ISO na sessão.

---

## Fora de escopo

- Redesign das regras / reescrever conteúdo curado (restaurar fiel).
- Qualquer cutover de DNS raiz (Gate C).
- Login por email/senha (Google-only, pétrea).
- Comentários/votos nos grupos (futuro, se o produto pedir).

---

## Riscos e impacto em outros módulos

- **`packages/ui` é shared (pétrea):** mudança no nav é mínima/aditiva, mas exige smoke de **todos** os consumidores.
- **Cloudflare Tunnel:** token CF atual (env do usuário) **falha 403** ao listar/criar `cfd_tunnel` (probe read-only 2026-06-20); lê DNS OK. Logo **criar/registrar o túnel é ação do mantenedor** (ou ampliar escopo do token). Não tocar ingress existente.
- **Cloudinary helper:** hoje vive em `apps/site/server/lib/media-store.ts`. Reusar sem duplicar; se copiar, registrar débito `BL-CLOUDINARY-SHARED` (promover a pacote compartilhado).
- **Zero-JS:** a página deixa de ser 100% zero-JS (island da lista comunitária). Aceito; JS escopado.
- **Entrada de comunidade = superfície hostil:** validar link de convite (allowlist de host), sanitizar texto, rate-limit. og:image vem de domínio externo → buscar server-side e subir no Cloudinary (nunca hotlinkar URL assinada que expira).
- **Auth sagrado:** zero mudança em `packages/auth`; só consumo.
