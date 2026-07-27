# 26-07-27_1 — downloads — Spec 089: bugs de parser e ingest achados na Fase 2 da 088

- **Módulo:** apps/downloads (+ apps/site, por dependência de deploy)
- **Spec:** `specs/089-downloads-parser-bugs/`
- **Branch:** `fix/089-downloads-parser-bugs` (de `origin/dev` em `049fea9`)
- **Estado:** aberta — spec redigida, nenhuma correção implementada

## O que aconteceu antes desta spec

Sessão começou como deploy da spec 088 (cutover de downloads para produção) e virou abertura
de spec nova quando a medição da Fase 2 reprovou.

1. **PR #219 mergeada** (`049fea9`) — remoção do importador WP + `check_migration_drift.sh` +
   gate de deps de Dockerfile.
2. **Deploy beta do downloads** (run `30281530506`, verde, 5m42s). Migrations 030/031
   aplicadas (29 → 31). O `check_migration_drift.sh` rodou em deploy real pela primeira vez e
   passou: `[drift] downloads-beta-db/downloads: disco e banco batem (31 migrations)`.
3. **Baseline T2.1 capturada** — 148 materiais, divergente dos 103 registrados na spec 088
   (medição de 2026-07-26). Recalibrou T2.11 de ~99 para ~144 esperados.
4. **Acervo de beta limpo** (T2.10b), com `pg_dump` prévio validado em
   `~/backups/downloads_beta_20260727_161016.sql` (310 KB, 29 blocos `COPY`).
5. **Primeiro disparo do scraper falhou** com `catalog_material_type_not_found: nao-classificado`
   em 10ms. Diagnóstico completo abaixo.
6. **Deploy beta do site** (run `30284942948`, verde, 5m4s) para corrigir a causa. Primeira
   execução do `docker-entrypoint.sh` reescrito e do drift check com parametrização do site
   (`version`/`*.sql`/strip-extension) — ambos passaram, 16 migrations.
7. **Recoleta das 3 fontes acessíveis** — 141 materiais, 3 runs `completed`.
8. **Medição reprovou.** 2 critérios passaram, 3 falharam.

## Diagnóstico do `catalog_material_type_not_found`

Cadeia causal, verificada ponta a ponta:

1. Downloads chama `GET /api/catalog/v1/material-types` no site beta → **404**
2. `catalogClient.ts:239` captura `catalog_404` e cai em `MATERIAL_TYPES_ROLLOUT_FALLBACK`
3. O fallback tem **uma entrada só**: `aventura`
4. `scraperIngest.ts:389` procura `nao-classificado`, não acha, aborta a run inteira

Causa do 404: o site é `auto_deploy_on_push: false`. A `migration_016` estava aplicada no
banco, mas o **código** que serve a rota nunca foi deployado — container de 2026-07-20.

O comentário do próprio `catalogClient.ts` previa o cenário ("Se Downloads subir primeiro, a
versão anterior do Site responde 404 nesta rota"). O que não acompanhou foi o fallback: a
spec 088 passou a depender de um tipo que ele não contém.

**Resolvido** pelo deploy do site beta. Rota respondendo 200 com os 7 tipos.

## Resultado da medição (T2.10/T2.11 da spec 088)

| Métrica | Baseline | Esperado | Real | |
|---|---|---|---|---|
| `total` | 148 | ~144 | 141 | ok |
| `com_credito` | 0 | ~119+ | 90 | ✅ |
| `com_publicante` | 119 | ~10 | 23 | ✅ |
| `com_sistema` | 0 | > 0 | **0** | ❌ |
| `hint_bruto` | 0 | > 0 | **0** | ❌ |
| `material_type` distintos | 1 | várias | **1** | ❌ |

Por fonte: `opera_rpg` 118, `itch_io` 14, `grimorios_e_dados` 9.

**Passou:** a correção do requisito 40a entrou. O autor deixou de ser gravado como editora.

**Não passou:** a extração de sistema, razão de ser da Fase 2. E `material_type` trocou "tudo
é Aventura" por "tudo é Não classificado" — mesma linha única, outro rótulo.

## Seis defeitos achados

1. **Nenhum parser produz `systemHint`** — busca nas 3 fontes retorna zero ocorrências.
   `hint_bruto`=0 é a prova: parser que tentasse e falhasse teria preenchido o hint bruto.
2. **Nenhum parser produz `materialTypeHint`** — mesma raiz, outro campo. 141 de 141 no default.
3. **`itch_io` não barra não-português** — 0 de 14, contra 14/132 e 5/14 nas outras. Agravante:
   `language: 'pt'` hardcoded em `scraperIngest.ts:323`.
4. **Entidade HTML crua em vários campos** — título (3), `summary`/`description` (6),
   `publisher_name`. `D&amp;D` deveria ser `D&D`, que é o nome de sistema que o casamento
   precisa acertar — a entidade **sabota a correção do defeito 1**. E o título contamina o
   slug, que é URL permanente.
5. **Editora, autor e sistema não são clicáveis no card** — `<p>` puro, sem `<a>`. Editora e
   autor nem filtro têm na API; tornar clicável exige construir a busca antes.
6. **Rótulo "Em português" em 100% dos cards, inclusive nos em inglês** — manifestação visível
   do defeito 3. O site afirma algo falso ao usuário. No mesmo elemento: `Editora Grimórios &
   Dados Editora` duplica "Editora".

Os defeitos 1 e 2 foram achados pela medição; **os defeitos 3 a 6 foram apontados pelo
mantenedor** ao inspecionar o acervo e o catálogo em beta.

## Decisões do mantenedor (2026-07-27)

Levantadas via `AskUserQuestion` antes de redigir e ampliar a spec, conforme a skill `new-spec`:

- **Sistema:** extrair nas 3 fontes (não só `opera_rpg`).
- **Idioma:** corrigir o detector (não endurecer o default).
- **Tipo:** extrair nas fontes; o default neutro **permanece** como rede de segurança.
- **Entidades:** sanear **todo campo textual** do parser por padrão, não lista enumerada de
  campos. Foi enumerando que `summary` e `publisher_name` escaparam.
- **Facetas:** construir filtro de editora e autor na API + catálogo, e ligar as três facetas
  (escopo maior escolhido deliberadamente sobre "só sistema agora").
- **Modelagem de editora:** normalizar o texto na gravação (trim, decode, colapso de espaço) —
  **não** promover editora a entidade/tabela.
- **Rótulo de idioma:** remover do card. O acervo é em português por premissa; carimbar em todo
  card é ruído. O filtro garante, a interface não anuncia.

Contexto de duas delas: o mantenedor considera `nao-classificado` "coisa preguiçosa", já que na
prática todo material é classificável — a correção ataca a ausência de extração que tornou o
default o caminho único, não o default em si. E sobre as entidades, foi explícito que a opção
de enumerar campos era inadequada: entidade crua é lixo visível ao usuário final.

## Artefatos

- `specs/089-downloads-parser-bugs/{spec.md,plan.md,tasks.md}` — criados
- `specs/backlog.md` — DEB-088-03 marcado como absorvido (escopo era maior do que supunha);
  DEB-089-01 a 05 criados
- Branch `fix/089-downloads-parser-bugs` — criada de `origin/dev`, **sem commit**

## Bloqueios

- **Promoção da 088 para prod travada** até a 089 fechar. O parser estrearia em produção sem
  extrair sistema nem tipo, e com slug contaminado.
- **Ordem de deploy em prod: site antes de downloads** — mesma armadilha do 404 acima.
- **DriveThruRPG e DMs Guild em 403** (DEB-088-02), fora do escopo da 089.

## Incidente lateral

Ao inspecionar variáveis do container de downloads beta, o `CATALOG_INTERNAL_TOKEN` de **beta**
apareceu na saída — o filtro de segredos usado (`grep -i catalog`) não cobria o padrão `*TOKEN*`.
Reportado ao mantenedor na hora. Token de beta, não de produção; rotação recomendada quando
conveniente.
