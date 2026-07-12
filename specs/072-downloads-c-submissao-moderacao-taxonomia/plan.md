# Plan — Spec 072 (Downloads-C)

## Fase 0 — Preparação

- Reler T3.1–T3.4 e T4.4 de `061/spec.md` como fonte de contrato; não redecidir produto aqui.

## Fase 1 — Taxonomia

- Implementar campos obrigatórios/condicionais/opcionais de T3.1.
- Validação cruzada (ex.: edição só com sistema).

## Fase 2 — Submissão

- Rotas por etapa (origem, metadados, prova, revisão, confirmação).
- Persistência de rascunho de submissão.

## Fase 3 — Prova (D100)

- `download_evidence`: URL, captura, licença/base jurídica.
- Sem expurgo por prazo.

## Fase 4 — Moderação

- Máquina de estados (T3.3).
- Fila com motivo estruturado.
- Ações batch (aprovar/reprovar/arquivar).
- Reenvio após reprovação preservando dados.

## Fase 5 — Denúncia (T3.4)

- Canais, categorias, prioridade P0–P3.
- Contenção proporcional, contraditório, recurso.
- Abuso, retirada voluntária, abandono/reivindicação.

## Fase 6 — Comentário e avaliação (regras de backend)

- Comentário: exige conta, retirada só por denúncia.
- Avaliação: bloqueio no backend para conta sem download prévio (integração fina com métrica fica em spec 074, aqui é o guard).

## Fase 7 — Validação

- lint + build + test locais.
- Teste de máquina de estados completo.

## Gate de saída

Fluxo de submissão→moderação→publicação funcional localmente libera spec 073 (só material aprovado aparece no catálogo público).
