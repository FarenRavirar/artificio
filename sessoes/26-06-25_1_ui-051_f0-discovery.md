# Sessão 26-06-25_1 — Spec 051 Onda 0 (F0 discovery)

- **Data:** 2026-06-25
- **Módulo/escopo:** `packages/ui` + `packages/content` + consumidores (mesas/glossario/site/site-admin/links) — varredura de duplicação pré-extração
- **Gate:** nenhum (qualidade transversal)
- **Objetivo:** executar F0 (discovery) da spec 051 — mapear duplicação REAL antes de extrair, fechar escopo final de F4/F5/F6. Sem código de produção.
- **Implementação posterior:** DeepSeek (ondas A-D), sob autorização nominal.
- **Vínculos:** `specs/051-ui-changelog-nav-active/{spec,plan,tasks}.md`, `specs/051-.../f0-discovery.md` (entregável)

## Plano
1. Inventariar wrappers changelog (F4), primitivas admin mesas (F5), schemas Zod (F6).
2. Verificar consumidores reais (2+) por candidato.
3. Classificar: extrair agora / consolidar com shared existente / manter local / nulo.
4. Escrever mapa em `f0-discovery.md`; refinar escopo F4/F5/F6 em spec/tasks.
5. Achados fora de escopo → backlog.

## Feito
- Varredura executada (`rg`/leitura direta). Mapa completo em `f0-discovery.md`.
- **Vereditos:** F6 = **nulo** (nenhum schema cross-app; `packages/content` não tocado). F4 = pequeno (pesado já na spec 041). F5 = redimensionado: ConfirmDialog (extrair, 3-app) + StateWrapper (consolidar c/ `primitives.tsx` existente) + FileDropzone (extrair, 2-app) + ImportResultGrid/StatCard (manter local, domínio mesas).
- Spec/tasks atualizados com escopo fechado.

## Critério de conclusão
- [x] F0 rodado, mapa classificado escrito.
- [x] Escopo F4/F5/F6 fechado nos artefatos.
- [ ] Achados fora de escopo → backlog (ver f0-discovery §6).
- [ ] project-state/backlog reconciliados (T0.6 fica para fechamento da spec).

## Backlog
- F6 nulo registrado como veredito (não vira débito — é decisão de não-mover).
- Débito novo possível: `site-admin` não depende de `@artificio/ui` (custo p/ rollout ConfirmDialog) — registrar em backlog se F5 avançar. Ver f0-discovery §6.
