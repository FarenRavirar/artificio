# Sessao 26-06-12_5 — Spec 020: Theme Artificio padrao

- **Data:** 2026-06-12
- **Tipo:** SDD Completo (spec preparatoria; sem implementacao)
- **Modulo/Pacote:** `packages/ui` + consumidores futuros em `apps/*`
- **Gate relacionado:** nenhum. Gate C/WP raiz/DNS/VM/deploy/producao fora de escopo.
- **Spec vinculada:** `specs/020-ui-theme-artificio-padrao/`
- **Estado:** concluida (spec montada; sem implementacao)

## Objetivo
Montar a Spec 020 como evolucao da Spec 019/D-INFRA2: criar um **Theme Artificio padrao** para unificar somente o que e comum entre projetos, sem forcar todos os apps a terem o mesmo layout ou a mesma personalidade.

## Escopo
- Criar `spec.md`, `plan.md`, `tasks.md`.
- Registrar fronteiras: o theme centraliza tokens, dark/light, primitives e padroes de shell; dominio, copy contextual, dados e layouts especificos ficam nos apps.
- Usar bases definidas pelo mantenedor: glossario como base visual/nav; mesas como referencia para notificacao/changelog e variante escura operacional.

## Fora de escopo
- Implementar runtime.
- Alterar `packages/ui`, `apps/*`, CSS, auth, deploy, VM, DNS, WP ou producao.
- Commit/push/merge.

## Evidencias / insumos
- Spec 019: `specs/019-infra-fonte-unica-auditoria/plan.md`.
- Achados principais incorporados: FSU-001, FSU-007, FSU-015, FSU-016, FSU-017, FSU-018, FSU-019, FSU-020, FSU-021.
- Bases visuais: glossario `index.css` e `GlossarioHeader`; mesas `HeaderActions`, `NotificationBell`, `ChangelogModal`, `index.css`, `AppShell`.

## Resultado
- Spec 020 criada em `specs/020-ui-theme-artificio-padrao/`.
- Spec 019 ajustada para apontar para o novo nome/conceito.
- Revisao posterior: Spec 019 ficou como auditoria/roteador; Spec 020 absorveu os achados visuais/comuns para evitar sobreposicao. Backlog `26-06-12_2_debitos_ux-marca.md` agora marca D-UX2 e D-MARCA2 como pertencentes a Spec 020, e D-INFRA2 como auditado pela Spec 019.
- `sessoes/index.md` e `.specify/memory/project-state.md` atualizados.
- Nenhuma mudanca funcional em codigo.

## Proximo passo recomendado
Executar a Spec 020 em fases: primeiro decisao formal de marca/tokens, depois gerar fonte unica em `packages/ui`, depois migrar consumidores em pilotos pequenos (`accounts` tema, `glossario` light, `mesas` dark/header actions).
