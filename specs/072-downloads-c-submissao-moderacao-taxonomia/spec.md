# Spec 072 — Downloads-C: Submissão, moderação e taxonomia (backend)

## Origem

Spec filha da `061-downloads-definicao-produto` (§F7/T7.3). Implementa T3.1 (taxonomia), T3.2/T3.2a (autoria/licença/prova D100), T3.3 (estados editoriais/moderação), T3.4 (denúncia/remoção/recurso), T4.4 (backend de submissão/gestão).

## Pré-requisito

Depende da spec 070 (Downloads-A): schema e ownership.

## Objetivo

Fluxo completo de submissão em etapas, fila de moderação com máquina de estados, taxonomia/metadados obrigatórios/condicionais/opcionais, prova de gratuidade (D100, retenção ilimitada — D111 item 2), denúncias e recurso.

## Escopo

- Rotas de submissão em etapas (origem → metadados → prova → revisão → confirmação), conforme T4.4.
- Taxonomia completa de T3.1: sistema/edição (via 062), tipo, gênero, idioma, formato (restrito a documento — D111 item 10), plataforma, condição/barreiras, licença (classes A1–A10, T3.2), créditos, público, classificação etária, tags.
- `download_evidence`: prova obrigatória (D100), sem expurgo por prazo.
- Estados editoriais e máquina de transição (T3.3): versão imutável, publicação atual, fila de moderação, motivo estruturado obrigatório em reprovação.
- Auto-publicação: campo/estrutura existe, **desligada por padrão e kill switch** (T3.3/D111 item 3) — nenhum critério de liberação implementado nesta spec.
- Denúncia (T3.4): canais, categorias, prioridade P0–P3, contenção proporcional, contraditório, recurso, abuso, retirada voluntária, abandono/reivindicação.
- Reenvio após reprovação preserva dados e mostra motivo.
- Ações batch de moderação (aprovar/reprovar/arquivar múltiplos), reaproveitando o padrão já testado em `apps/mesas` (`PATCH .../batch`).
- Comentário: exige conta `accounts.` (sem anônimo), retirada só por denúncia, sem moderação prévia/posterior de rotina (D111 item 6).
- Avaliação: só permitida para conta que já tem download registrado do mesmo material (D111 item 5) — a checagem em si depende de spec 074 (métrica de download), aqui só a regra de bloqueio no backend.

## Fora de escopo

- UI de submissão (spec 073/074).
- Storage de arquivo em si (spec 071 — esta spec só orquestra o fluxo, delega upload ao adapter).
- Critério concreto de liberação de auto-publicação (pergunta 3 permanece aberta; spec futura dedicada).

## Critérios de aceite

1. Máquina de estados rejeita transição inválida (teste unitário).
2. Reprovação sempre grava motivo estruturado, nunca só texto livre solto.
3. Reenvio após reprovação preserva dados anteriores.
4. Prova (`download_evidence`) nunca é aceita automaticamente — sempre passa por revisão humana.
5. Denúncia sem conta é aceita, mas decisão de mérito exige role autenticada (moderador/admin).
6. Comentário exige conta `accounts.`; sem fluxo de comentário anônimo.
7. Ações batch de moderação seguem o mesmo contrato de API já usado no mesas.
8. Auto-publicação existe como campo/flag, nunca ativa por si (kill switch confirmado desligado).

## Dependências

- Spec 070 (schema/ownership).
- Pode rodar em paralelo com spec 071.
- Bloqueia spec 073 (descoberta pública só mostra material aprovado por este fluxo).
