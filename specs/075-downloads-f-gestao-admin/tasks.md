# Tasks — Spec 075 (Downloads-F)

## F0 — Preparação

- [ ] T0.1 — Confirmar specs 072 e 074 localmente verdes.

## F1 — Estrutura de gestão

- [ ] T1.1 — Rotas `/gestao/*` (Visão geral, Moderação, Materiais, Denúncias, Links, Arquivos, Mídias, Publicadores, Taxonomias, Métricas, Auditoria, Configurações).
- [ ] T1.2 — Sidebar de recursos, grupos, contagem por fila, P0 com indicador não-só-cor.
- [ ] T1.3 — Link de saída "Sistemas e edições" para Site/062.

## F2 — Fila de moderação

- [ ] T2.1 — Tela de fila filtrável por estado.
- [ ] T2.2 — Ações batch (aprovar/reprovar/arquivar).
- [ ] T2.3 — Motivo estruturado obrigatório em reprovação.

## F3 — Auditoria de edição

- [ ] T3.1 — Tela de histórico completo por material.
- [ ] T3.2 — Histórico completo de links já usados (não só o atual).

## F4 — Denúncias

- [ ] T4.1 — Fila de denúncia com prioridade P0–P3.
- [ ] T4.2 — Fluxo de decisão/contraditório/recurso.

## F5 — Link checker

- [ ] T5.1 — Job agendado isolado.
- [ ] T5.2 — Bloqueio de IP privado/loopback/metadado de nuvem (SSRF).
- [ ] T5.3 — Alimentação de `download_link_check` + sinalização de destino degradado.

## F6 — Segurança e métricas

- [ ] T6.1 — Sanitização de campo de texto livre antes de renderizar.
- [ ] T6.2 — Validação de magic bytes no fluxo admin.
- [ ] T6.3 — Métricas administrativas completas (país/dispositivo/horário).

## F7 — Validação

- [ ] T7.1 — lint + build + test.
- [ ] T7.2 — Teste de SSRF (link checker rejeita IP privado/loopback/metadado).
- [ ] T7.3 — Teste de sanitização XSS.
