# Plano — 027

## Arquitetura da solução
Adicionar uma rota Astro estática para a página completa no site e inserir o resumo legal no componente compartilhado de rodapé. Como o site ainda usa um espelho Astro do rodapé, atualizar também `SiteFooter.astro`.

## Arquivos afetados
- `packages/ui/src/Footer.tsx`
- `packages/ui/src/styles.css`
- `apps/site/src/components/SiteFooter.astro`
- `apps/site/src/pages/termos-de-uso-e-direitos-autorais.astro`
- `specs/027-ui-copyright-usage/*`
- `sessoes/26-06-16_11_ui-copyright-usage.md`

## Contratos/interfaces tocados
Sem auth, banco, DNS, API pública ou migration. Toca apenas conteúdo público e rodapé compartilhado.

## Impacto em consumidores
Glossário e mesas herdam a alteração via `Footer` React quando atualizarem para o build com esta mudança. Site herda via `SiteFooter.astro` nesta mesma fatia.

## Rollback
Remover a página Astro e reverter os blocos adicionados ao rodapé React/Astro e CSS.

## Validação
Executar:
- `pnpm --filter @artificio/ui build`
- `pnpm --filter @artificio/site build`

Sem deploy nesta tarefa.
