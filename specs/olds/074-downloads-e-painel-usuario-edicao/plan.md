# Plan — Spec 074 (Downloads-E)

## Fase 0 — Preparação

- Confirmar spec 073 localmente verde (reaproveita card/ficha).

## Fase 1 — Painel base

- Rotas `/painel/*` (Visão geral, Meus materiais, Favoritos, Coleções, Perfil, Organizações, Notificações, Denúncias, Configurações).
- Sidebar de conta substituindo sidebar pública (T4.2).

## Fase 2 — Edição de material

- Tela de edição reaproveitando formulário de submissão (spec 072) em modo edição.
- Edição de link/arquivo de destino incluída.
- Gravação de histórico por campo a cada salvar.

## Fase 3 — Métrica de download

- Instrumentar clique no CTA de acesso (spec 073) como evento de download.
- Dedup por (conta, material) no backend (spec 070/072), consumido aqui.

## Fase 4 — Avaliação e comentário

- Guard de UI: avaliação só disponível com download prévio.
- Comentário exige sessão; UI de retirada só aciona denúncia.

## Fase 5 — Favoritos e coleções

- CRUD de favorito.
- CRUD de coleção e itens de coleção.

## Fase 6 — Validação

- lint + build + test.
- Teste de dedup de contador.
- Teste de histórico campo a campo.

## Gate de saída

Painel funcional localmente libera spec 075 (gestão/admin consome os mesmos dados de edição/histórico).
