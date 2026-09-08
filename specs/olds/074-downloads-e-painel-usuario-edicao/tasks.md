# Tasks — Spec 074 (Downloads-E)

## F0 — Preparação

- [x] T0.1 — Confirmado spec 073 localmente verde (50 testes backend + 6 frontend, lint/build ok) antes de iniciar 074.

## F1 — Painel base

- [x] T1.1 — Rota Visão geral (`/painel`, `VisaoGeralPage.tsx`).
- [x] T1.2 — Rota Meus materiais (`/painel/materiais`, todos os estados editoriais via `GET /materials/mine`, novo).
- [x] T1.3 — Rota Favoritos (`/painel/favoritos`).
- [x] T1.4 — Rota Coleções (`/painel/colecoes`).
- [x] T1.5 — Rota Perfil (`/painel/perfil`, só-leitura via SSO).
- [x] T1.6 — Rota Organizações (`/painel/organizacoes`) — escopo mínimo funcional autorizado nominalmente (2026-07-12), sem spec prévia detalhando o domínio.
- [x] T1.7 — Rota Notificações (`/painel/notificacoes`) — escopo mínimo funcional autorizado nominalmente (2026-07-12), feed interno só-leitura, sem emissão automática de eventos ainda (ver débito).
- [x] T1.8 — Rota Denúncias (minhas denúncias) — `GET /reports/mine` implementada (DEB-074-02 fechado, 2026-07-12).
- [x] T1.9 — Rota Configurações (`/painel/configuracoes`, logout).
- [x] T1.10 — Sidebar de conta (`PainelShell.tsx`): desktop fixo + drawer mobile.

## F2 — Edição de material

- [x] T2.1 — Tela de edição (`EditarMaterialPage.tsx`) reaproveitando o PATCH existente (spec 070).
- [x] T2.2 — Edição de link de destino (`external_url` já editável desde 070; incluso no formulário).
- [x] T2.3 — Gravação de histórico por campo a cada salvar (já existia em `materials.ts` PATCH desde 070; nova rota `GET /materials/:id/history` para exibir).

## F3 — Métrica de download

- [x] T3.1 — CTA instrumentado: `useRegisterDownload` chamado antes do redirect quando logado.
- [x] T3.2 — Dedup por (conta, material) via nova tabela `download_user_material_download` (migration_015) + rota `POST /downloads`.

## F4 — Avaliação e comentário

- [x] T4.1 — Guard de UI: `RatingSection` mostra explicação visível (`role="alert"`) quando backend recusa (403, sem download prévio).
- [x] T4.2 — UI de comentário exigindo sessão (`CommentSection`, oculta formulário sem `user`).
- [x] T4.3 — Retirada de comentário já só via denúncia/moderação desde spec 072 (`DELETE /comments/:id` com `requireRole`); sem UI de autoexclusão nesta tela (conforme regra).

## F5 — Favoritos e coleções

- [x] T5.1 — CRUD de favorito (`favorites.ts` backend + botão na ficha + `FavoritosPage`).
- [x] T5.2 — CRUD de coleção e itens (`collections.ts` backend + `ColecoesPage`); UI de "adicionar à coleção" na ficha pública implementada (`AddToCollectionButton.tsx`, DEB-074-03 fechado, 2026-07-12).

## F6 — Validação

- [x] T6.1 — lint + build + test verdes: backend 56/56 testes, frontend 6/6 testes, `tsc --noEmit`/`tsc -b` limpos, `eslint` limpo nos dois, `vite build` ok, `pnpm verify:api` exit 0 (downloads breaking=0 non-breaking=17, 2026-07-12).
- [x] T6.2 — Teste de dedup de contador de download: `routes/downloads.test.ts` (3 casos — primeira vez incrementa, segunda vez não, 404 material inválido).
- [x] T6.3 — Teste de histórico campo a campo: `routes/materials.history.test.ts` (3 casos — sem entrada espúria quando valor não muda, leitura por dono, 403 para não-dono/não-moderador).
