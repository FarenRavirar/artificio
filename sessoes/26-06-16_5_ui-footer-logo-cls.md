# Sessao 26-06-16_5 — UI footer logo CLS

- **Data:** 2026-06-16
- **Objetivo:** promover a reserva de dimensao do logo do footer para `packages/ui` e shell Astro, removendo workaround local do glossario se a validacao passar.
- **Escopo:** `packages/ui` shell/footer compartilhado, `apps/site` Astro footer, `apps/glossario` override local.
- **Gate:** SDD Completo por tocar pacote compartilhado. Sem deploy/commit/push sem aprovacao nominal.
- **Criterio de conclusao:** achado real documentado; regra aplicada na fonte compartilhada; builds/tests proporcionais; Lighthouse/smoke local onde aplicavel; backlog/tasks/project-state atualizados.

## Achados iniciais
- Baseline Spec 025 marcou `footer.artificio-footer` e `img.artificio-footer-logo` em `glossariobeta`.
- Correção local em `apps/glossario/frontend/src/index.css` (`width:102px;height:34px`) validou CLS remoto 0.000353 em beta.
- `packages/ui/src/styles.css` ainda define `.artificio-footer-logo { height: 34px; width: auto; }`.
- `packages/ui/src/Footer.tsx` passa `width={300}` e `height={100}`, mas o CSS compartilhado ainda deixa a largura de layout como `auto`.
- `apps/site/src/components/SiteFooter.astro` renderiza dois logos com classe comum e sem `width`/`height`; herda o CSS compartilhado.

## Plano
- [x] Aplicar reserva de largura/altura/aspect-ratio em `.artificio-footer-logo` no CSS compartilhado.
- [x] Adicionar `width`/`height` no footer Astro do site usando dimensoes canonicas 300x100.
- [x] Remover override local do glossario.
- [x] Validar `@artificio/ui`, site, glossario e mesas.
- [x] Registrar resultado em Spec 025/backlog/project-state.

## Execucao
- `packages/ui/src/styles.css`: `.artificio-footer-logo` agora define `aspect-ratio: 3 / 1`, `height: 34px`, `width: 102px`; antes era `width: auto`.
- `apps/site/src/components/SiteFooter.astro`: os dois logos do footer recebem `width="300"` e `height="100"`, alinhados aos metadados canonicos em `packages/ui/src/brand.ts`.
- `apps/glossario/frontend/src/index.css`: removido override local da fatia anterior; a reserva agora vem de `@artificio/ui/styles.css`.

## Validacao
- `pnpm --filter @artificio/ui test` OK: 8/8.
- `pnpm --filter @artificio/ui build` OK.
- `pnpm --filter @artificio/glossario-frontend build` OK.
- `pnpm --filter @artificio/mesas-frontend build` OK.
- `pnpm --filter @artificio/site build` OK.
- Servidor estatico local `apps/glossario/frontend/dist` em `127.0.0.1:4176` respondeu 200 e foi encerrado.
- `pnpm quality:lighthouse --url http://127.0.0.1:4176/ --profile mobile --runs 1 --out artifacts/lighthouse/glossario-footer-shared-cls-local` OK.
- Resumo Lighthouse local: performance 0.59; accessibility 0.90; best-practices 0.96; SEO 0.92; CLS 0.000204.
- Auditorias do report: `unsized-images` score 1; `image-aspect-ratio` score 1; `layout-shifts` score 1 com residual pequeno apenas em `div.artificio-session`.

## Resultado
- Regra do footer/logo foi promovida para `packages/ui` e shell Astro localmente.
- `BL-QA-SHELL-CLS` nao fecha ainda: falta publicar/validar beta da fonte compartilhada e decidir se o residual `div.artificio-session` merece fatia separada.
