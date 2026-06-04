# Database Migrations

Este diretório (`./database/`) é a **fonte única** ("canonical directory") para todas as schemas migrations do projeto Artifício RPG.
Somente arquivos localizados neste diretório serão detectados e executados pelo pipeline de CI/CD.

## Convenção de Nomenclatura

Os arquivos devem rigorosamente seguir o padrão:
`migration_NNN_descricao_snake_case.sql`

Onde `NNN` é um número sequencial e a descrição não deve conter espaços. Exemplo: `migration_114_add_user_preferences.sql`.

## Cabeçalho Obrigatório

Toda migration (sem exceção) deve declarar as primeiras linhas com o seguinte esquema de metadados:

```sql
-- @class: online-safe | manual-risk
-- @requires-backup: true | false
-- @author: identificador_do_autor
-- @created: YYYY-MM-DD
-- @description: Resumo breve e claro da alteração
```

### Explicação dos Metadados

- `@class`: Define a janela e o risco de operação. 
  - `online-safe`: Pode ser aplicada em hot deploy durante o tráfego regular.
  - `manual-risk`: Contém sentenças potencialmente bloqueantes ou destrutivas. Paralisará o deploy automatizado para exigência de revisão manual e janelas restritas.
- `@requires-backup`: Caso seja `true`, o fluxo automatizado em Prod bloqueará sem que o `ALLOW_MANUAL_MIGRATIONS` e um backup atestável seja disponibilizado. 

> NOTA: O script rejeitará declarações `@requires-backup: true` marcadas como `online-safe`. A combinação exigirá classificação `manual-risk`. Da mesma forma, comandos como DROP, TRUNCATE, ALTER DROP falharão a validação se marcados como `online-safe`.

## Política Forward-Only

O ecossistema utiliza modelo **forward-only**. Não implementamos migrations "up/down". 
Se um erro for introduzido em produção, deve-se criar uma **nova migration** com a correção correspondente e enviá-la seguindo o pipeline à frente. Alterações retroativas ou tentativas de down-migration corrompem a evolução unidirecional do sistema.

## Intervenções de Emergência (Reconciliação)

As ferramentas do projeto estão estritamente controladas para não gerar "drifts" (defasagem) entre a tabela `schema_migrations` e os arquivos no canônico.
Em um *incidente ou emergência*, havendo aplicação cirúrgica e manual das querys, a reconciliação precisa intervir no mesmo momento.
Se você executar uma query via console DB, **antes de se desconectar**, deve obrigatóriamente executar:

```bash
bash scripts/deploy/reconcile_migrations.sh --mark-applied <numero_aqui> docker-compose.prod.yml mesas-db
```

Essa ação marca a migration no banco como processada evitando a quebra natural ou travamento do pipeline nos deploys sequenciais.

## Exemplos

**Online Safe (Regular)**
```sql
-- migration_115_add_is_active_column.sql
-- @class: online-safe
-- @requires-backup: false
-- @author: bruno
-- @created: 2026-04-20
-- @description: Adiciona boolean is_active

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
```

**Manual Risk (Destrutivo)**
```sql
-- migration_116_drop_legacy_system.sql
-- @class: manual-risk
-- @requires-backup: true
-- @author: rita
-- @created: 2026-04-21
-- @description: Remove a tabela depreciada config_legacy

DROP TABLE IF EXISTS config_legacy;
```
