# 053 — Débitos

Consolidação dos débitos remanescentes das specs 047–051. Cada item abaixo foi **transferido** da spec de origem (que fica encerrada apontando p/ cá).

## Transferidos (acionáveis nesta spec)

| ID 053 | Origem | Frente | Severidade | Status |
|---|---|---|---|---|
| DEB-053-01 | 049/D06 (P1-1..P1-8) | A | 🔴 a11y WCAG Critical/Serious + UX | aberto — **BLOQUEADO pela spec 054** (mesma tela; roda depois da reorg) |
| DEB-053-02 | DEB-048-38 | B | 🟡 UX (tema accounts) | aberto |
| DEB-053-03 | DEB-048-37 | C | 🟠 gap CI (causou crash DEB-048-36) | aberto |
| DEB-053-04 | REV-051-RABBIT-06 | D | 🟢 doc-only (falso-positivo já analisado) | aberto |
| DEB-053-05 | 048 Fase E (T-E1..E6) | E | 🟡 automação operacional VM | aberto (final da spec) |

## Detalhe

### DEB-053-01 — a11y + UI da revisão de gestão (mesas) [ex-049/D06]
8 issues P1 da auditoria 049 (`specs/049/auditorias-consolidadas.md`): P1-1 modal sem Escape/trap/role, P1-2 checkbox sem label, P1-3 sem focus visível, P1-4 dirty-state perdido, P1-5 `window.confirm` inconsistente (verificar se já resolvido por 051), P1-6 navegação automática entre abas, P1-7 zero design system (verificar cobertura 049/051), P1-8 erro não anunciado a leitor de tela. SDD Completo (toca `packages/ui`).

### DEB-053-02 — accounts preso em tema light [ex-DEB-048-38]
Ao entrar no `accounts.`, tema persistente light; não respeita preferência/toggle. SDD Lite `apps/accounts/frontend` (não toca auth/SSO).

### DEB-053-03 — gap CI: resolução `require()` CJS de pacotes shared [ex-DEB-048-37]
Nenhum check exercita `require()` CJS do `dist` respeitando `exports`. Causou crash-loop `mesas-beta-api` (DEB-048-36: `@artificio/config` sem condição `require`). tsc+vitest não pegam. Adicionar smoke de resolução CJS no CI.

### DEB-053-04 — promover doc REV-051-RABBIT-06 [ex-051]
§13 da 051 (descarte do falso-positivo Stylelint) não-commitado. Promover em PR doc-only/carona. Sem código.

### DEB-053-05 — ingestão diária na VM [ex-048 Fase E, FINAL DA SPEC]
T-E1..E6: diretórios fora do git, comando DiscordChatExporter pinado, job diário, importador de pasta monitorada idempotente, logs/retenção, métrica (+migration `discord_import_runs` online-safe). Automação operacional pura, sem IA. Aprovação nominal por ação na VM; trava de não-auto-publicação (048) em vigor. **Coordenar com 052 Bloco A — não duplicar.**

> **Nota:** as melhorias **opcionais de parser** da 048 (T-C4/C5/C7/C8/C9 + T-B5) **NÃO** estão na 053 — foram para o **Bloco C da spec 052** (decisão do mantenedor, 2026-06-27).

## Novos (surgidos na 053)

(vazio — preencher conforme implementação)
