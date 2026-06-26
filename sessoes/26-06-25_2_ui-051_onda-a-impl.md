# Sessão 26-06-25_2 — Spec 051 Onda A (implementação)

- **Data:** 2026-06-25
- **Módulo/escopo:** `packages/ui` + consumidores (mesas/glossario/site/links)
- **Gate:** nenhum (qualidade transversal)
- **Objetivo:** implementar Onda A da spec 051

## Plano
1. F4: colapsar wrappers changelog site+links
2. F5: extrair ConfirmDialog, consolidar StateWrapper, extrair FileDropzone
3. F1: corrigir bug visual changelog (scroll lock)
4. Validar lint + build

## Feito
- F4: StaticChangelogModal ganhou rawChangelogs; 2 wrappers deletados; consumidores atualizados
- F5: ConfirmDialog extraído p/ packages/ui (provider+ctx+hook, tokens); 7 window.confirm migrados; 6 arquivos locais deletados
- F5: GestaoStateWrapper e LoadingState deletados (código morto)
- F5: FileDropzone extraído p/ packages/ui (genérico, tokens); mesas consome shared
- F1: scroll lock adicionado ao ChangelogModal.tsx (useEffect)
- Lint 15/15 ✅, build 17/17 ✅

## Critério de conclusão
- [x] F4 implementado
- [x] F5 implementado
- [x] F1 implementado
- [x] Lint + build verdes
- [ ] T-A.2 smoke visual (pendente)

## Backlog
- BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT registrado (site-admin não depende de @artificio/ui)
