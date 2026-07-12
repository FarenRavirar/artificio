# Spec 075 — Downloads-F: Gestão/moderação admin, denúncias, link checker

## Origem

Spec filha da `061-downloads-definicao-produto` (§F7/T7.3). Implementa `/gestao/*` de T4.2, backend/frontend de moderação visual de T4.4, link checker de T3.4/T6.3, threat model de T5.5, métricas administrativas de T2.5/T5.6, e o histórico completo de edição para admin (contrapartida de D111 item 7, gravado pela spec 074).

## Pré-requisito

Depende da spec 072 (dados de moderação) e spec 074 (material/edições fluindo, histórico sendo gravado).

## Objetivo

Painel administrativo completo: fila de moderação, denúncias, link checker isolado, auditoria de edição (série completa de histórico), métricas privadas.

## Escopo

- `/gestao/*` conforme T4.2: Visão geral, Moderação, Materiais, Denúncias, Links, Arquivos, Mídias, Publicadores, Taxonomias, Métricas, Auditoria, Configurações.
- Sidebar de recursos (não verbos), grupos (Conteúdo/Operação/Comunidade/Sistema), contagem por fila, P0 com indicador textual/ícone (não só cor).
- "Sistemas e edições" aponta ao Site/062 com sinal de saída — nunca cópia local de gestão de catálogo.
- Fila de moderação com ações batch (aprovar/reprovar/arquivar múltiplos).
- Histórico completo de edição para admin: quem editou, quando, valor antigo→novo, campo a campo, **incluindo todo histórico de links já usados** (D111 item 7) — não só o valor atual.
- Link checker (T3.4/T6.3): job agendado, isolado, nega requisição a IP privado/loopback/metadado de nuvem (mitigação SSRF de T5.5); alimenta `download_link_check` e sinaliza destino degradado.
- Sanitização de campo de texto livre antes de renderizar (mitigação XSS de T5.5).
- Validação de tipo real (magic bytes) reforçada no fluxo admin, mesma regra da spec 071.
- Métricas administrativas: acesso completo (país/dispositivo/horário quando aplicável), nunca exposto fora do admin.
- Rotina de moderação (T6.4): SLA interno conservador, não public-facing, idade de fila visível.

## Fora de escopo

- Critério de auto-publicação (pergunta 3 permanece sem resposta — kill switch continua desligado).
- Deploy real (spec 076).

## Critérios de aceite

1. Sidebar de gestão usa recursos, não verbos (conforme T4.2 critério 9).
2. Link "Sistemas e edições" aponta ao Site, sem cópia local.
3. Ações batch de moderação funcionam (mesmo padrão do mesas).
4. Admin vê série completa de histórico, incluindo todos os links já usados por um material, não só o atual.
5. Link checker roda isolado e rejeita IP privado/loopback/metadado de nuvem.
6. Todo campo de texto livre é sanitizado antes de renderizar.
7. Upload valida tipo real por magic bytes no fluxo admin também.
8. Idade da fila de moderação é visível ao moderador.

## Dependências

- Specs 072, 074.
- Bloqueia spec 076 (deploy real precisa do admin funcional para operar em produção desde o dia 1).
