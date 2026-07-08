# 060 — Gestão de mesas importadas (sem gm_id) fica invisível no admin

- **Módulo/Pacote:** apps/mesas (backend + frontend)
- **Gate relacionado:** D (mesas)

## Problema

Mesa criada pelo sync de draft Discord (`syncHelpers.buildTableData`) entra
sempre com `status: 'draft'` e `gm_id: null` (origin: 'imported'). Nenhuma
tela da aplicação consegue listar, ler ou editar essa mesa depois que o
draft de origem sai do radar:

1. `GET /api/v1/tables` (usada por `ConteudoSection.tsx`, aba "Mesas
   publicadas") filtra `status = 'active'` — mesa em draft nunca aparece.
2. `GET /gm/tables` e `GET /gm/tables/:id` (painel do mestre) filtram
   `gm_id = gmProfile.id` do usuário logado — mesa com `gm_id: null` nunca
   bate com ninguém.
3. `adminTables.ts` não tem nenhuma rota `GET` — só `PUT`/`POST batch`/
   `DELETE`, todas exigindo já saber o `id` de antemão.
4. `ConteudoSection.handleToggleTableStatus` bloqueia explicitamente
   qualquer status fora de `active`/`cancelled` — mesmo se a mesa fosse
   encontrada, o toggle recusaria publicar um draft.

Resultado: mesa sincronizada só é "publicável" enquanto o operador lembra
do ID durante a sessão de revisão do draft. Depois disso, fica presa em
`draft` para sempre, sem via de descoberta nem de ação.

Achado consolidado a partir de reviews reais do CodeRabbit e Codex na PR
#137 (2026-07-08) — os fixes pontuais propostos ali (botão em componente
errado, link para rota gm-scoped) foram revertidos por não resolverem a
causa raiz; ver `debitos.md`.

## Requisitos

1. Admin deve poder listar mesas de qualquer `status` (incluindo `draft`),
   com filtro opcional por status.
2. Admin deve poder ler o detalhe de uma mesa por ID sem exigir `gm_id`
   correspondente ao usuário logado.
3. Admin deve poder publicar (`draft` → `active`) uma mesa importada pela
   mesma tela de gestão onde ela aparece listada.
4. Fluxo deve funcionar tanto para mesas importadas (`gm_id: null`) quanto
   para mesas normais de GM — sem regressão no fluxo GM existente.

## Critérios de aceite

- Mesa sincronizada via Discord aparece na listagem admin de mesas
  (`ConteudoSection.tsx` ou tela equivalente) mesmo em `status: 'draft'`,
  sem precisar do modal de draft original.
- Botão de publicar funciona a partir dessa listagem e transiciona
  `draft` → `active` via `PUT /admin/tables/:id`.
- `pnpm run lint` + `pnpm run build` verdes (backend + frontend mesas).
- Smoke manual: sincronizar 1 draft novo, fechar o modal, achar a mesa na
  tela de gestão admin, publicar por lá, confirmar que fica visível no
  catálogo público (`GET /api/v1/tables`).

## Fora de escopo

- Atribuir `gm_id` retroativo a mesas importadas (mesa "sem dono" é
  comportamento intencional do fluxo de import).
- Mudar o formato/validação do sync em si (já coberto pelas specs 058/PR
  #135/#136).
- Botão "Ver mesa"/"Publicar mesa" dentro do modal de draft — resolvido
  por esta spec ao dar visibilidade permanente, não pontual.

## Riscos e impacto em outros módulos

- Novo endpoint `GET /admin/tables` expõe listagem ampla — restringir a
  `role === 'admin'` (mesmo padrão já usado em `PUT /admin/tables/:id`).
- `TableRepository` ganha método novo (`findById` sem gm scope) — cuidado
  para não reusar por engano em rota gm-scoped.
