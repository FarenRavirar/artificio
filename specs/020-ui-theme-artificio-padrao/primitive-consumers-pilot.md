# Piloto de consumidores das primitives — Spec 020

Status: **spec/fatia pronta para executar**. Nao altera runtime nesta revisao.

## Objetivo

Migrar o primeiro consumidor real para as primitives compartilhadas de `@artificio/ui`, validando que B4 reduz drift sem criar acoplamento de dominio.

Backlog: `BL-UI-PRIMITIVES-CONSUMERS`.

## Investigacao feita

Arquivos lidos:

- `apps/site-admin/package.json`
- `apps/site-admin/src/styles.css`
- `apps/site-admin/src/App.tsx`
- `apps/site-admin/src/pages/PostsList.tsx`
- `apps/site-admin/src/pages/PagesList.tsx`
- `apps/site-admin/src/pages/PostEditor.tsx`
- `apps/site-admin/src/pages/PageEditor.tsx`
- `apps/site-admin/src/pages/FeedbackPage.tsx`
- `apps/site-admin/src/media/MediaLibrary.tsx`
- `packages/ui/src/primitives.tsx`
- `packages/ui/src/primitives.test.tsx`
- `specs/020-ui-theme-artificio-padrao/rollout-pilots.md`

Validacao de base:

- `pnpm --filter @artificio/site-admin typecheck` — OK.
- `pnpm --filter @artificio/site-admin build` — OK; aviso existente de chunk >500 kB por BlockNote/bundle admin.

## Diagnostico

`apps/site-admin` e um bom primeiro consumidor porque:

- e React isolado, servido em `/admin`, sem risco de quebrar o shell publico Astro zero-JS;
- duplica padrões agora existentes em `@artificio/ui`: `.btn`, `.badge`, `.card`, inputs, selects, textareas, modal, error/loading/empty;
- tem baixo acoplamento visual com `mesas`/`glossario`;
- tem validações locais baratas (`typecheck` e `build`).

Duplicacoes encontradas:

| Area | Arquivos | Duplicacao | Primitive alvo |
|---|---|---|---|
| Listas de posts/paginas | `PostsList.tsx`, `PagesList.tsx` | `.btn`, `.badge`, loading/empty, `.err-box`, toolbar com busca/filtro | `Button`, `Badge`, `Toolbar`, `TextInput`, `Select`, `ErrorState`, `LoadingState`, `EmptyState` |
| Editores | `PostEditor.tsx`, `PageEditor.tsx`, `SeoPanel.tsx` | `.card`, inputs, selects, textareas, badges, warnings | `Panel`, `Field`, `TextInput`, `Select`, `Textarea`, `Badge` |
| Midia | `MediaLibrary.tsx`, `MediaPicker.tsx` | botoes, inputs, select, modal local, detail card | `Button`, `TextInput`, `Select`, `Panel`, `Modal` |
| Feedback | `FeedbackPage.tsx` | cards inline, toolbar/filtros, badge, textarea, buttons, states | `Panel`, `Toolbar`, `Badge`, `Select`, `Textarea`, `Button`, states |
| CSS local | `styles.css` | tokens locais espelhados (`--navy`, `--orange`, `--line`, `.btn`, `.badge`, `.card`) | consumir `@artificio/ui/styles.css` e remover classes migradas por fase |

## Decisao de piloto

Comecar por **listas de posts/paginas**.

Motivo:

- sao telas menores que editor/midia;
- cobrem botoes, badges, toolbar, controles e estados;
- nao tocam BlockNote, preview, upload, modal ou fluxo editorial complexo;
- rollback e simples: voltar JSX/classes locais.

Nao comecar por:

- `PostEditor`/`PageEditor`: maior superficie, SEO panel, BlockNote, picker;
- `MediaLibrary`: upload + picker/modal;
- `FeedbackPage`: usa dados/estado operacional e cards inline, melhor depois que padrao das listas estiver validado.

## Escopo da fatia 1

Tocar somente:

- `apps/site-admin/src/pages/PostsList.tsx`
- `apps/site-admin/src/pages/PagesList.tsx`
- `apps/site-admin/src/styles.css`

Opcional se necessario:

- `apps/site-admin/src/components/*` para helper local de mapeamento status -> variant, se evitar repeticao.

Nao tocar:

- `apps/site/server`
- `apps/site` publico Astro
- `packages/ui` runtime, salvo bug real descoberto nas primitives
- auth, preview, rebuild, upload, BlockNote
- deploy/VM/prod

## Mapeamento tecnico

| Local atual | Troca |
|---|---|
| `<Link className="btn primary">` | `<Button href="/admin/posts/new" variant="primary">` ou manter `Link` se a navegacao SPA exigir `react-router`; nesse caso preservar Link ate existir adapter aprovado |
| `<button className="btn">` | `<Button>` |
| `<button className="btn tiny">` | `<Button size="sm">` |
| `.danger` | `variant="danger"` |
| `<span className={\`badge ${status}\`}>` | `<Badge variant={statusToBadgeVariant(status)}>` |
| `<input type="text">` | `<TextInput>` |
| `<select>` | `<Select>` |
| loading `<p className="muted">Carregando...</p>` | `LoadingState variant="inline"` ou `variant="panel"` |
| empty row | manter table row nesta fatia ou trocar para `EmptyState` fora da tabela se layout permitir sem regressao |
| `.err-box` | `ErrorState variant="panel"` |
| filtro row | `Toolbar` com `leading`/`trailing` |

Nota: `Button href` renderiza `<a>`. Para rotas internas do `react-router`, avaliar se o full navigation e aceitavel. Preferencia conservadora: manter `Link` quando preservar SPA for importante; usar primitives primeiro em `<button>` e controls.

## Critérios de aceite

- `PostsList` e `PagesList` usam primitives para botoes de acao, badges, filtros e estados onde nao prejudicar SPA routing.
- CSS local remove ou reduz classes migradas apenas quando nenhum uso restante existir.
- Sem import de dominio dentro de `@artificio/ui`.
- Sem mudanca em endpoints, payloads, status lifecycle, rebuild ou auth.
- UX equivalente: buscar, filtrar, publicar/despublicar/arquivar/lixeira/apagar, links de editar/ver continuam.
- `site-admin` continua isolado do site publico; build do `site` nao ganha React island novo.

## Validacao obrigatoria da fatia 1

- `pnpm --filter @artificio/site-admin typecheck`
- `pnpm --filter @artificio/site-admin build`
- `pnpm --filter @artificio/site build`
- `pnpm --filter @artificio/ui test`
- `pnpm --filter @artificio/ui build`
- `rg "className=\"btn|className=\\{`btn|className=\"badge|err-box" apps/site-admin/src/pages/{PostsList.tsx,PagesList.tsx}` equivalente em PowerShell
- `git diff --check`

Validação manual recomendada quando houver ambiente:

- `/admin/` lista posts: loading, vazio, erro, filtro status, busca, ações por status.
- `/admin/pages` lista paginas: filtro status, ações por status.
- mobile estreito: toolbar nao quebra texto/botoes.
- contraste AA de badge/status e botao danger.

## Rollback

- Reverter somente `PostsList.tsx`, `PagesList.tsx` e CSS removido.
- Se `Button href` quebrar SPA routing, voltar links internos para `Link className="btn..."` e manter primitives nos controles/botoes comuns.
- Se contraste/spacing regredir, manter JSX migrado e ajustar tokens/classes em `packages/ui` somente com nova aprovacao se o bug for da primitive.

## Fases seguintes

2. `MediaPicker`/`MediaLibrary`: migrar modal, botoes, filtros, card de detalhe.
3. `PostEditor`/`PageEditor`: migrar panels e fields, preservando BlockNote.
4. `SeoPanel`: avaliar se `Panel`/`Field` reduzem drift sem perder preview de busca/social.
5. `FeedbackPage`: migrar cards/status depois de validar listas.

Cada fase deve ter sessao propria, build, smoke e backlog atualizado.

