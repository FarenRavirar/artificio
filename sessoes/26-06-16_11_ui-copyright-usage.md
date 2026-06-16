# Sessão 26-06-16_11 — UI / direitos autorais

## Objetivo
Criar página pública de termos de uso e direitos autorais a partir do Markdown do mantenedor e adicionar resumo com link no rodapé universal dos projetos.

## Vínculos
- Spec: `specs/027-ui-copyright-usage/`
- Backlog relacionado: `BL-SHELL-B13` / shell e footer compartilhado
- Modelo de origem: `C:\Users\paulo\Desktop\Termos de uso e direitos autorais.md`

## Escopo
- `packages/ui` rodapé React compartilhado.
- `apps/site` página pública e espelho Astro do rodapé.
- Sem commit, push, deploy, VM, DNS, banco ou WordPress.

## Plano
- [x] Ler T0 obrigatório.
- [x] Ler T1 pertinente a specs/backlog/sessões e SDD.
- [x] Ler modelo Markdown.
- [x] Criar página Astro completa.
- [x] Atualizar rodapés.
- [x] Rodar builds locais.
- [x] Atualizar backlog/project-state conforme status.

## Arquivos a modificar
- `packages/ui/src/Footer.tsx`
- `packages/ui/src/styles.css`
- `apps/site/src/components/SiteFooter.astro`
- `apps/site/src/pages/termos-de-uso-e-direitos-autorais.astro`
- `specs/027-ui-copyright-usage/*`
- `specs/backlog.md`
- `.specify/memory/project-state.md`
- `sessoes/index.md`

## Critério de conclusão
Builds locais de UI e site verdes; sessão registra evidência; backlog/project-state indicam status local sem afirmar deploy.

## Evidência
- Criada rota `apps/site/src/pages/termos-de-uso-e-direitos-autorais.astro` com texto do modelo do mantenedor.
- `packages/ui/src/Footer.tsx` e `apps/site/src/components/SiteFooter.astro` exibem o resumo curto com link para `/termos-de-uso-e-direitos-autorais/`.
- `pnpm --filter @artificio/ui build` passou.
- `pnpm --filter @artificio/site build` passou e gerou `/termos-de-uso-e-direitos-autorais/index.html`.
- `rg` no `apps/site/dist` confirmou resumo e link no HTML gerado, inclusive na home e na página nova.
- `specs/backlog.md`: aberto `BL-UI-COPYRIGHT-027` com status `local`.
- `project-state.md`: registrado status local, sem deploy.

## Fechamento
Implementado localmente. Falta commit/push/deploy se o mantenedor quiser publicar.
