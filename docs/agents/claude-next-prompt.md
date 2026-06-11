# Prompt para Claude — próximo bloco (Spec 011 T20: CRUD de taxonomias)

Continuação direta de `C:\projetos\artificio` (**Artifício RPG**). Você é o executor; o Codex orquestra/revisa. Comunicação em português.

## Contexto obrigatório (ler nesta ordem)
1. `.specify/memory/project-state.md`
2. `docs/agents/context-capsule.md`
3. `.specify/memory/decisions.md`
4. `AGENTS.md`
5. `sessoes/26-06-06_1_site_cms-authoring.md`
6. `specs/011-site-cms-authoring/{spec.md,plan.md,tasks.md}` (foco: **T20**)

Não redecida arquitetura fechada. Gate C adiado; WordPress raiz e DNS raiz intocáveis.

## Estado atual (atualizado 2026-06-11)
- Gates A/B fechados; Gate D `mesas` fechado.
- **Spec 011 no ar no beta:** Fase 1 + T16 + T17 (operações editoriais + publicação honesta) + refino UX (editor BlockNote light + SEO/OG Yoast-like) + **Fase 2 mídia (T18 backend + T19 UI)**.
- **Glossário:** `apps/glossario` está em `dev`; bootstrap BETA pronto (`glossariobeta.` + `.env.beta` + volume legado), aguardando dispatch. `dev` está à frente de `main`; não fazer prod glossário até `main` conter o módulo.
- **Mídia:** biblioteca nativa (`media` estendida pela migration 004), API `/api/admin/v1/media`, upload Cloudinary (gated; **migração em massa WP→Cloudinary é opt-in `SITE_MIGRATE_MEDIA=true`** — fora do boot), UI Mídia + `MediaPicker` (featured/OG/inserir no editor).
- **Fix de sessão SSO** (refresh-retry, `packages/auth`) live em beta + mesas prod.
- Pendência de validação: E2E autenticado de mídia no beta (mantenedor).

## Objetivo deste bloco — T20: CRUD de taxonomias completo (R22/R24)
1. Registrar na sessão que retoma pela T20.
2. **Backend** (`apps/site`): API de taxonomias além do atual (hoje só `GET /taxonomies` + `POST` criar):
   - editar nome/slug/descrição/parent de categoria; `PUT /taxonomies/:id`; `DELETE /taxonomies/:id`.
   - validação de **slug único por kind**; **prevenção de ciclo** em parent de categoria.
   - exclusão: bloquear se em uso, OU reatribuir, OU remover associação com aviso explícito (decidir e documentar).
   - recalcular/atualizar `count` após edição/publicação/rebuild.
3. **Frontend** (`apps/site-admin`): tela `Categorias/Tags` (criar/editar/apagar, parent de categoria, contagem); filtros de posts por categoria/tag usam estes dados.
4. **SSG:** páginas de arquivo (categoria/tag) refletem alterações após rebuild.

**Feito quando:** CA4 passa; páginas de arquivo refletem alterações após rebuild; sem quebrar vínculos `post_taxonomies` existentes.

## Restrições
- Escopo: `apps/site` + `apps/site-admin`. Não tocar `packages/*`, `apps/accounts`, `apps/mesas`, infra, DNS, tunnel, WP ou banco prod fora do necessário sem ampliar escopo e pedir aprovação.
- Tocar `packages/*` = SDD Completo (testar mesas/accounts/site antes de mergear).
- Commit, push, deploy/dispatch, write na VM, SQL com escrita e secrets = **aprovação explícita por ação** (formato `AGENTS.md`).
- **Migrations online-safe** (D039, `ADD COLUMN IF NOT EXISTS`); diretório `apps/site/db/migrations/` (allowlist do gate já cobre).
- **Deploy do site:** o import-on-start é dry-run rápido por padrão; não reative bulk media no boot. Healthcheck do `site-beta-app` é sensível a boot longo.
- Não imprimir segredo; não inspecionar cookie/token bruto.

## Validação mínima antes de entregar
- Typecheck/build (`@artificio/site`, `@artificio/site-admin`).
- Testes de repo/API de taxonomias (slug único, ciclo de parent, exclusão em uso).
- Smoke: gate 401 sem sessão; CRUD via API; recálculo de count.
- Registro final: sessão, `tasks.md`, `project-state.md`, `roadmap.md`.

## Entrega para revisão do Codex
Arquivos alterados; comandos de validação + resultados; pendências; se houve commit/push/deploy; pontos para o Codex revisar primeiro (integridade de `post_taxonomies`, prevenção de ciclo, semântica de exclusão).

## Pendências conhecidas (fora deste bloco)
- E2E autenticado de mídia no beta (mantenedor): upload no `/admin` → confirmar URL Cloudinary; inserir imagem/featured/OG; publicar.
- Migração das mídias WP antigas p/ Cloudinary: rodar import com `SITE_MIGRATE_MEDIA=true` (tarefa à parte, fora do boot).
- `secrets.7z` do backup deu erro de senha/corrupção — verificar à parte.
- Embeds de provedores (oEmbed) no editor — refino futuro (T32).
