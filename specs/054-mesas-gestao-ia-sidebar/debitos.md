# 054 — Débitos

> Começa vazio. Débito = só o que surgir na investigação/implementação real. Decisões em aberto vivem no `spec.md` §Decisões em aberto até serem fechadas pelo mantenedor.

## Dependências/coordenação registradas

- **054 = GATE DE BLOQUEIO (mantenedor 2026-06-27).** Specs que tocam as superfícies da 054 (`/gestao` do mesas, primitivas de nav em `packages/ui`, backend onde o rename tocar contrato) ficam **bloqueadas até a 054 fechar**. Ordem de prioridade: **054 → 053 → 052**.
- **053 Frente A** (a11y/UI da revisão de gestão) — mesma tela → **BLOQUEADA pela 054**. Roda depois, sobre a estrutura nova. Demais frentes da 053 (B/C/D/E) seguem livres.

## Novos (surgidos na 054)

(vazio)
