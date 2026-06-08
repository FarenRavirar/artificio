# Prompt para Claude — próximo bloco (Spec 011 Fase 2: mídia)

Continuação direta de `C:\projetos\artificio` (**Artifício RPG**). Você é o executor; o Codex orquestra/revisa. Comunicação em português.

## Contexto obrigatório (ler nesta ordem)
1. `.specify/memory/project-state.md`
2. `docs/agents/context-capsule.md`
3. `.specify/memory/decisions.md`
4. `AGENTS.md`
5. `sessoes/26-06-06_1_site_cms-authoring.md`
6. `specs/011-site-cms-authoring/{spec.md,plan.md,tasks.md}` (foco: **T18, T19**; Apêndice A = paridade WordPress)

Não redecida arquitetura fechada. Gate C adiado; WordPress raiz e DNS raiz intocáveis.

## Estado atual (2026-06-08)
- Gates A/B fechados; **Gate D `mesas` fechado**.
- **Spec 011: Fase 1 + T16 + T17 FECHADOS e no ar no beta.** Admin (`/admin`) autora posts/páginas: CRUD, editor BlockNote (light), preview stateless, publicar→rebuild SSG, operações editoriais (publicar/despublicar/arquivar/lixeira/restaurar/apagar com confirm), filtro por status, slug+301, painel **SEO/OG estilo Yoast** (snippet Google, contadores, preview social).
- **Fix de persistência de sessão SSO** (refresh-retry no cliente, `packages/auth`) live em beta + mesas prod. `main = dev`.
- Pendente conhecido: mídia ainda depende de **URL manual** (sem upload/biblioteca).

## Objetivo deste bloco — Fase 2 mídia (T18 + T19)
1. Registrar na sessão (`26-06-06_1` ou nova sessão de fase) que retoma pela Fase 2 mídia.
2. **T18 — Biblioteca de mídia / schema + API:**
   - Migration online-safe (D039): mídia nativa com `source` (`wp|cloudinary|local`), `url`, `cloudinary_public_id`, `mime`, `size_bytes`, `width`, `height`, `alt`, `caption`, `title`, `created_by`, timestamps; preservar compat com `media`/`media_map` importados.
   - `GET /api/admin/v1/media` (busca, paginação, filtro por tipo); `POST` multipart com validação backend de MIME/extensão/tamanho (rejeitar SVG sem sanitização); `PUT /:id` (alt/legenda/título); `DELETE` com regra de referência.
   - Cloudinary **env-gated por `CLOUDINARY_URL`**: com credencial faz upload real + persiste public id/secure url; sem credencial = modo dev/local/dry-run documentado.
   - Deps prováveis backend: `multer` ou `busboy` + `file-type`. **Não** instalar `ffmpeg`/ImageMagick/Sharp na VM até necessidade concreta.
   - Testes: tipo inválido, arquivo grande, sem auth, sem admin, upload válido, update metadata. **Feito quando:** CA3 — imagem com alt aparece no corpo e no `og:image`; público serve URL após rebuild.
3. **T19 — UI de mídia + inserção no editor:**
   - Rota `Mídia` no `apps/site-admin` (grid/lista, busca, preview, metadados, upload).
   - Modal/seletor reutilizável p/ imagem destacada, OG image e blocos do editor (integra BlockNote, preserva alt/legenda no HTML sanitizado).
   - Embeds por URL com allowlist de provedores (sem `<script>` arbitrário); áudio/vídeo começam por URL/Cloudinary.
   - **Feito quando:** editor cria post com imagem inline + featured + OG usando mídia cadastrada; preview e publicação funcionam.

## Restrições
- Escopo: `apps/site` + `apps/site-admin`. Não tocar `packages/*`, `apps/accounts`, `apps/mesas`, infra, DNS, tunnel, WP ou banco prod fora do necessário sem ampliar escopo e pedir aprovação.
- Tocar `packages/*` = SDD Completo (testar mesas/accounts/site antes de mergear).
- Commit, push, deploy/dispatch, write na VM, SQL com escrita e secrets = **aprovação explícita por ação** (formato `AGENTS.md`). `CLOUDINARY_URL` (secret) = mantenedor.
- Não imprimir segredo; não inspecionar cookie/token bruto.

## Validação mínima antes de entregar
- Typecheck/build dos pacotes afetados (`@artificio/site`, `@artificio/site-admin`).
- Testes de API/repo de mídia (incl. rejeições de MIME/tamanho/SVG).
- Smoke: upload (dry-run sem Cloudinary), `GET /media` paginado, gate 401 sem sessão.
- Evidência de que o público serve a URL correta após rebuild e que `og:image` reflete a mídia.
- Registro final: sessão, `specs/011/tasks.md`, `project-state.md`, `roadmap.md`.

## Entrega para revisão do Codex
Arquivos alterados; comandos de validação + resultados; pendências; se houve commit/push/deploy; pontos para o Codex revisar primeiro (segurança do upload: MIME real vs extensão, limite de tamanho, SVG, path traversal, autorização).
