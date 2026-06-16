# Sessao 26-06-16_3 — Spec 025 BL-QA-SHELL-CLS

- **Data:** 2026-06-16
- **Objetivo:** reduzir CLS do `glossariobeta`, começando por shell/footer/logo/session apontados pelo Lighthouse limpo.
- **Escopo:** preferir `apps/glossario`; tocar `packages/ui` so se causa estiver no footer compartilhado e com validacao proporcional.
- **Gate:** Gate C/WP raiz intocaveis. Sem VM write, sem deploy.
- **Restricoes:** sem Chrome do mantenedor; sem commit/push. Lighthouse local limpo permitido.

## Plano
- [x] Reproduzir/confirmar elemento causador por artefatos Lighthouse/DOM local.
- [x] Inspecionar `packages/ui` Footer/Header e consumidor glossario.
- [x] Corrigir reserva de dimensao/espaco com menor blast radius.
- [x] Validar build/test e Lighthouse limpo 1x em alvo aplicavel.
- [x] Atualizar `tasks.md`, `backlog.md`, `project-state.md`.

## Contexto lido
- T0 ja carregado neste chat.
- T1 lido: Spec 025 baseline/achados/tasks, `specs/backlog.md` linhas QA, `context-capsule`, `decisions`.
- Evidencia: `glossariobeta` baseline limpo CLS 0.647 mobile / 0.251 desktop; anexos apontam `footer.artificio-footer`, `img.artificio-footer-logo`, `div.artificio-session`.

## Arquivos provaveis
- `packages/ui/src/Footer.tsx`
- `packages/ui/src/styles.css`
- `apps/glossario/frontend/src/**`
- `specs/025-quality-lighthouse-program/*`
- `specs/backlog.md`

## Execucao
- Mantido escopo em `apps/glossario`; nao toquei `packages/ui` porque codigo compartilhado exige aprovacao + SDD Completo.
- `apps/glossario/frontend/src/App.tsx`: badge "presente" e `LandingSection` renderizam mesmo durante loading. Causa: esconder ambos ate `/api/terms` resolver fazia o shell crescer e empurrar footer/section.
- `apps/glossario/frontend/src/index.css`: `.artificio-footer-logo` com `width:102px`, `height:34px`, `aspect-ratio:3/1`; Lighthouse marcava o logo como media sem tamanho explicito porque o CSS compartilhado usa `width:auto`.
- `scripts/quality/static-dist-server.mjs`: servidor estatico simples para validar `dist/` local com Lighthouse quando `vite preview` falhou no Windows.

## Evidencia
- Baseline limpo vivo: `glossariobeta` mobile CLS 0.647; desktop 0.251.
- Artefato baseline apontou `footer.artificio-footer` e subitem `img.artificio-footer-logo`.
- Primeira tentativa local so com logo: CLS ainda alto; causa adicional era crescimento do shell apos loading.
- Lighthouse local final (`artifacts/lighthouse/glossario-cls-local-after-no-minheight`) com build corrigido: CLS 0.0002046875; item residual so `div.artificio-session` score 0.000204.

## Validacao
- `pnpm --filter @artificio/glossario-frontend build` OK.
- `pnpm quality:lighthouse --url http://127.0.0.1:4175/ --profile mobile --runs 1 --out artifacts/lighthouse/glossario-cls-local-after-no-minheight` OK.
- Processos auxiliares locais encerrados.

## Backlog/project-state
- `BL-QA-SHELL-CLS` mudou de `aberto` para `local`.
- `tasks.md` T4 anotado como parcial local, nao fechado.
- `project-state.md` atualizado.

## Falta
- Deploy/validacao em `glossariobeta` para confirmar CLS real no host.
- Se confirmar, abrir/promover subfatia para `packages/ui` (Footer logo) com SDD Completo/aprovacao, porque o problema e contrato compartilhado.
