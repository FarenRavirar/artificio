# Sessão 26-06-03_1 — infra: backup runbook (Fase 0)

- **Data:** 2026-06-03
- **Módulo:** infra · **Gate:** A
- **Objetivo:** produzir a spec/runbook de backup total e executá-lo até fechar o Gate A.

## Vínculos
- Spec: `specs/001-infra-backup-runbook/{spec,plan,tasks}.md`
- Decisões: D004, D008, D009, D010, D012, D017
- Constituição: §VII (backup antes de destruir)

## Plano de execução
1. ✅ Spec + plan + tasks criados.
2. ✅ **T1 inventário** — `ssh faren` verificado. Params em `docs/agents/infra-map.md`. WP=externo (Ramo B). Escopo travado: **só G1** (D021); telegram/foundry fora; tunnel novo na Fase 1 (D022).
3. ⬜ T2–T8 coleta (4 dumps PG, WP externo, 5 volumes G1, código, segredos, DNS) — `[APROVAÇÃO 1/3]`.
4. ⬜ T9 checksums origem.
5. ⬜ T10 transferir → `artificiobackup` — `[APROVAÇÃO 2]`.
6. ⬜ T11 verificar destino · T12 restore-test.
7. ⬜ T13 manifesto + **aprovação Gate A**.

## Bloqueio atual
WP é **externo** → T3 (Ramo B) precisa das credenciais do painel de hospedagem do `artificiorpg.com` (DB host/user/pass/name + acesso a `wp-content/uploads`). Mantenedor precisa fornecer ou apontar onde o WP está hospedado.

## Arquivos que serão modificados
- `specs/001-infra-backup-runbook/*` (criados)
- `.specify/memory/project-state.md` (Gate A no fim)
- `sessoes/index.md`
- Fora do repo: `C:\projetos\artificiobackup\<DATA>\*`

## Critério de conclusão
Todos os critérios de aceite do `spec.md` ✅, checksums batem, restore-test passa, mantenedor aprova Gate A. Nenhuma ação destrutiva na VM antes disso.

## Estado atual
Spec pronta. **Próximo:** mantenedor decide rodar T1 (inventário) — é read-only, sem aprovação. Precisa de acesso SSH à VM (ou eu gero comandos e tu colas).
