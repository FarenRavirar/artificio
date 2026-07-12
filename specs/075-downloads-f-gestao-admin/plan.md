# Plan — Spec 075 (Downloads-F)

## Fase 0 — Preparação

- Confirmar specs 072 e 074 localmente verdes.

## Fase 1 — Estrutura de gestão

- Rotas `/gestao/*` (T4.2).
- Sidebar de recursos, grupos, contagem por fila.
- Link de saída para Site/062 (sistemas/edições).

## Fase 2 — Fila de moderação

- Tela de fila com filtro por estado.
- Ações batch.
- Motivo estruturado obrigatório.

## Fase 3 — Auditoria de edição

- Tela de histórico completo por material (campo, valor antigo/novo, quem, quando).
- Histórico completo de links já usados.

## Fase 4 — Denúncias

- Fila de denúncia com prioridade P0–P3.
- Fluxo de decisão/contraditório/recurso.

## Fase 5 — Link checker

- Job agendado isolado (worker sem acesso a rede interna).
- Bloqueio explícito de IP privado/loopback/metadado de nuvem.
- Alimentação de `download_link_check` e sinalização de destino degradado.

## Fase 6 — Segurança e métricas

- Sanitização de texto livre antes de renderizar.
- Validação de magic bytes no fluxo admin.
- Métricas administrativas completas.

## Fase 7 — Validação

- lint + build + test.
- Teste de SSRF (rejeita IP privado/loopback/metadado).
- Teste de sanitização de XSS.

## Gate de saída

Admin funcional localmente libera spec 076 (deploy real).
