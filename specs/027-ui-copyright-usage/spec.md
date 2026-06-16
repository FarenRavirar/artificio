# 027 — Página de uso e direitos autorais
- **Módulo/Pacote:** packages/ui + apps/site
- **Gate relacionado:** nenhum

## Problema
O Artifício RPG precisa publicar uma página canônica com regras de uso e direitos autorais, baseada no modelo aprovado em Markdown, e expor no rodapé universal uma versão curta com link para a página completa.

## Requisitos
1. Criar página pública em `apps/site` com o texto de `Termos de uso e direitos autorais.md`.
2. Incluir no rodapé compartilhado a versão curta informada pelo mantenedor.
3. O resumo do rodapé deve apontar para a página completa.
4. Manter o WordPress raiz intocado e não executar deploy.
5. Validar build de `packages/ui` e `apps/site`.

## Critérios de aceite
- `/termos-de-uso-e-direitos-autorais/` existe no build do site.
- `Footer` de `packages/ui` renderiza o resumo e link.
- `SiteFooter.astro` espelha o mesmo resumo no site público.
- Builds locais relevantes passam.

## Fora de escopo
- Alterar contratos de privacidade, SSO, banco, WordPress, DNS, deploy ou produção.
- Substituir a página legada de termos de serviço importada do WordPress.

## Riscos e impacto em outros módulos
`packages/ui` é compartilhado por glossário e mesas. A mudança é visual/textual no rodapé, sem lógica de auth ou API. Consumidores React recebem o resumo no próximo build/deploy.
