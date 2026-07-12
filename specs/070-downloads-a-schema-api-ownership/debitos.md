# Débitos — Spec 070 (Downloads-A)

Achados internos de investigação, lint, build ou auditoria. Vazio por definição no momento da abertura — débito só o que surgir na implementação.

## DEB-070-01 — Frontend do app downloads não existe ainda

Escopo desta spec era só backend (schema/API/ownership). `apps/downloads/backend` criado; `apps/downloads/frontend` fica para a spec que precisar dele primeiro (073, descoberta pública). Sem ação agora.

## DEB-070-02 — Rotas de leitura pública ainda não filtram por catálogo/taxonomia

T2.1 entregou só `GET /api/v1/materials/:slug` (ficha individual). Listagem/busca/filtro por sistema-edição/taxonomia é escopo da spec 073 (descoberta pública), não desta.

## DEB-070-03 — Máquina de estados editorial completa não implementada

`editorial_state` nasce sempre `draft` via API; transições draft→in_review→published/rejected/withdrawn e fila de moderação ficam na spec 072, conforme já delimitado em "Fora de escopo" do `070/spec.md`.

