# Tasks — Spec 073 (Downloads-D)

## F0 — Preparação

- [ ] T0.1 — Confirmar specs 070/071/072 localmente verdes.

## F1 — Rotas e navegação

- [ ] T1.1 — Rotas públicas de T4.1.
- [ ] T1.2 — Header global + submenu Downloads (T4.2).
- [ ] T1.3 — Sidebar contextual por rota.
- [ ] T1.4 — Drawer mobile de filtros/exploração.

## F2 — Busca/filtro/ordenação/paginação

- [ ] T2.1 — Campo de busca com debounce.
- [ ] T2.2 — Facetas do MVP (sistema/edição, tipo, gênero, idioma, formato, origem, gratuito/PWYW, licença, barreiras).
- [ ] T2.3 — Ordenação (relevância/recentes/populares/nome).
- [ ] T2.4 — Paginação como parâmetro de URL.
- [ ] T2.5 — Estado combinado compartilhável na URL.

## F3 — Card e ficha

- [ ] T3.1 — Componente de card (capa/placeholder, badges, contagem pública).
- [ ] T3.2 — Página de ficha (ordem de seções fixada em T4.4).
- [ ] T3.3 — CTA de acesso disparando evento de funil.
- [ ] T3.4 — Aviso de destino degradado no lugar do CTA.
- [ ] T3.5 — Exibição de "última atualização" pública.

## F4 — Perfil de criador

- [ ] T4.1 — `/criadores/:slug`, aceitando criador sem conta.

## F5 — AA/responsivo

- [ ] T5.1 — Contraste AA em todos os estados interativos.
- [ ] T5.2 — Alvo mínimo 44×44.
- [ ] T5.3 — Zoom 200%/reflow 320px sem quebra.
- [ ] T5.4 — `prefers-reduced-motion` respeitado.

## F6 — Validação

- [ ] T6.1 — lint + build + test.
- [ ] T6.2 — Teste de componente (card/ficha/filtros).
- [ ] T6.3 — E2e leve busca→filtro→ficha→CTA.
