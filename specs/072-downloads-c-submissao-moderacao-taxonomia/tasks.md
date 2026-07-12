# Tasks — Spec 072 (Downloads-C)

## F0 — Preparação

- [ ] T0.1 — Reler T3.1–T3.4/T4.4 de `061/spec.md` como contrato.

## F1 — Taxonomia

- [ ] T1.1 — Campos obrigatórios de publicação.
- [ ] T1.2 — Campos condicionais.
- [ ] T1.3 — Campos opcionais/privados.
- [ ] T1.4 — Validação cruzada (edição exige sistema, etc.).

## F2 — Submissão

- [ ] T2.1 — Rota de escolha de origem (link externo/upload).
- [ ] T2.2 — Rota de metadados.
- [ ] T2.3 — Rota de prova (D100).
- [ ] T2.4 — Rota de revisão/confirmação.
- [ ] T2.5 — Persistência de rascunho de submissão.

## F3 — Prova

- [ ] T3.1 — `download_evidence`: URL, captura, licença/base jurídica.
- [ ] T3.2 — Sem expurgo automático por prazo.

## F4 — Moderação

- [ ] T4.1 — Máquina de estados editoriais.
- [ ] T4.2 — Fila com motivo estruturado obrigatório em reprovação.
- [ ] T4.3 — Ações batch (aprovar/reprovar/arquivar múltiplos).
- [ ] T4.4 — Reenvio após reprovação preservando dados + motivo.
- [ ] T4.5 — Flag de auto-publicação existente, desligada por kill switch (sem critério de liberação).

## F5 — Denúncia

- [ ] T5.1 — Canais e categorias.
- [ ] T5.2 — Prioridade P0–P3 e contenção proporcional.
- [ ] T5.3 — Contraditório e recurso.
- [ ] T5.4 — Abuso, retirada voluntária, abandono/reivindicação.

## F6 — Comentário e avaliação

- [ ] T6.1 — Comentário exige conta `accounts.`; retirada só por denúncia.
- [ ] T6.2 — Guard de avaliação: bloqueia conta sem download prévio do material.

## F7 — Validação

- [ ] T7.1 — lint + build + test locais.
- [ ] T7.2 — Teste completo da máquina de estados (transições válidas/inválidas).
