# Spec 070 — Downloads-A: Schema, API base e ownership

## Origem

Primeira spec filha executável do produto Downloads, decomposta pela spec `061-downloads-definicao-produto` (§F7/T7.3). Toda decisão de produto/política já está fechada em `061/spec.md` e em `.specify/memory/decisions.md` (D089–D111); esta spec não reabre definição de produto, só implementa.

## Pré-requisito bloqueante

Depende da spec `062` (catálogo único de sistemas/edições) ter API central consumível. Downloads **nunca** cria CRUD ou tabela própria de sistema/edição — consome a API central exatamente como mesas/glossario/site-admin já consomem (D096–D099).

## Objetivo

Criar o schema do domínio Downloads, rotas base de API autenticadas e o modelo de ownership/roles, servindo de fundação para as specs B–F.

## Escopo

- Migrations do banco Downloads (schema isolado, próprio app — regra pétrea de isolamento por app/projeto).
- Entidades conforme `061/spec.md` §F5/T5.1: `download_material`, `download_material_version` (com histórico de edição por campo, incl. link — D111 item 7), `download_material_metadata`, `download_creator`, `download_evidence` (retenção ilimitada — D111 item 2), `download_report`, `download_favorite`, `download_collection`/`download_collection_item`, `download_link_check`, `download_metric_daily`.
- Índices mínimos: `slug` único; composto (sistema/edição central, tipo, estado editorial); (estado editorial, criado_em); busca textual trigram; `criador_id`.
- Rotas base: CRUD de material (respeitando estado editorial — ver spec 072 para máquina de estados completa), leitura pública de catálogo, autenticação via `@artificio/auth`/SSO `accounts.`.
- Ownership: publicador só edita o próprio material; moderador opera qualquer material da fila (autorização fina fica com spec 072, aqui só o modelo de roles/middleware).
- Consumo (nunca escrita local) do catálogo 062 via API central.

## Fora de escopo desta spec

- Storage de arquivo real (spec 071).
- Fluxo de submissão/moderação completo (spec 072).
- Qualquer UI pública (spec 073) ou painel (spec 074).
- Deploy/infra real (spec 076) — esta spec valida só local (lint/build/test).

## Critérios de aceite

1. `pnpm verify:api` verde, rotas novas aparecem no bundle de governança.
2. Nenhuma escrita de sistema/edição fora da API central 062 (auditável por teste/grep).
3. `download_material_version` grava histórico por campo (campo, valor antigo, valor novo, autor, timestamp) desde o primeiro commit — não é ajuste retroativo.
4. `download_evidence` sem coluna de expurgo por prazo.
5. Ownership: teste de integração prova que publicador não edita material de terceiro.
6. Lint + build + test locais verdes.

## Dependências

- Spec 062 (API central de catálogo) — bloqueante.
- Nenhuma dependência de B–F (todas dependem desta).
