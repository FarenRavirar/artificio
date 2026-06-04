# Guia de Migrations

**Última atualização:** 21/04/2026

---

## Referências Rápidas

| Ação | Comando |
|---|---|
| Buscar enum no backend | `grep -rn "node_type.*:" backend/src/` |
| Buscar enum no frontend | `grep -rn "node_type.*:" frontend/src/` |
| Testar TypeScript backend | `cd backend && npx tsc --noEmit` |
| Testar TypeScript frontend | `cd frontend && npx tsc --noEmit` |

---

## Regras de Ouro

1. **Idempotência:** Toda migration roda 2x sem erro.
2. **IF NOT EXISTS:** Sempre usar em ALTER/CREATE/DROP.
3. **Tipos sincronizados:** Backend + Frontend sempre alinhados.
4. **Deploy Automatizado:** O fluxo padrão é via GitHub Actions (CI). Não aplicar direto em produção como primeira tentativa.

---

## Headers Obrigatórios

Toda migration em `./database/` DEVE ter o seguinte cabeçalho nas primeiras linhas:

```sql
-- @class: online-safe | manual-risk
-- @requires-backup: true | false
-- @author: <identificador>
-- @created: YYYY-MM-DD
-- @description: <descrição em uma linha>
```

- **online-safe**: Migrations que não quebram o código atual em runtime (e.g., ADD COLUMN sem restrição estrita, CREATE TABLE).
- **manual-risk**: Migrations destrutivas (DROP TABLE, ALTER COLUMN TYPE, DELETE). Serão bloqueadas pelo CI a menos que haja flag manual ou fluxo de emergência.

**REGRA DE COERÊNCIA — bloqueada pelo CI (`scripts/deploy/lib_migrations.sh::parse_header`):**

- `@requires-backup: true` **exige** `@class: manual-risk`. Combinação inversa (`online-safe` + `requires-backup=true`) é rejeitada pelo job `validate` do Deploy Beta com "Incoerencia. requires-backup=true exige class=manual-risk".
- Migration aditiva (CHECK CONSTRAINT, ADD COLUMN com default, CREATE INDEX) → `online-safe` + `requires-backup=false`. Backup pessoal antes de aplicar é precaução opcional, **fora** do contrato.
- Migration destrutiva → `manual-risk` + `requires-backup=true`. O CI bloqueia até `ALLOW_MANUAL_MIGRATIONS=true` e exige backup formal pelo `PRE_DEPLOY_CHECKLIST.md`.

---

## Template de Migration

```sql
-- @class: online-safe
-- @requires-backup: false
-- @author: desenvolvedor
-- @created: 2026-04-21
-- @description: adiciona coluna foo

-- 1. Mudanças
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS foo TYPE DEFAULT 'value';
CREATE INDEX IF NOT EXISTS idx_name ON table_name(foo);

-- 2. Validação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_name' AND column_name = 'foo'
  ) THEN
    RAISE EXCEPTION 'Migration failed: column not created';
  END IF;
END $$;
```

---

## Fluxo Padrão (Automatizado via CI)

Não aplique migrations manualmente! O script `apply_required_migrations.sh` é orquestrado no GitHub Actions:

1. **Crie arquivo**: Adicione `migration_XXX_descricao.sql` em `./database/` (diretório canônico).
2. **Commit e Push**: Envie as alterações na sua branch e abra PR para `dev`.
3. **Validação (Preflight & Enforcer)**: 
   - O CI bloqueará arquivos criados fora do diretório oficial.
   - O CI simula o schema drift contra as branchs de destino e posta um relatório no PR principal.
4. **Merge**: Ao dar merge em `dev` (Beta) e em `main` (Produção), os workflows aplicarão a migration via shell automaticamente antes de re-subir a aplicação.

---

## Procedimento de Emergência (Intervenção Manual)

Se o deploy automatizado for bloqueado por uma migration `manual-risk` ou falhas de drift (relatório "BLOCKED" do preflight), intervenha da seguinte forma:

1. Acesse o servidor (Beta ou Prod) via SSH somente após aprovação explícita quando houver escrita ou risco operacional.
2. Siga os gates de backup, autorização e rollback em `PRE_DEPLOY_CHECKLIST.md`.
3. Aplique os desvios de migração ou reparos no banco de dados manualmente apenas quando o checklist permitir.
4. **Reconciliação obrigatória**: Execute a confirmação para que o gate registre o arquivo e libere os próximos deploys:
   ```bash
   bash scripts/deploy/reconcile_migrations.sh --mark-applied migration_XXX_descricao.sql docker-compose.prod.yml mesas-db
   ```
   Atenção: A falta desta reconciliação causará bloqueio por drift reverso (I2) no próximo deploy automatizado.

---

## Checklist Pré-Deploy

### 1. SQL (Migration)
- [ ] Nome: `migration_XXX_descricao.sql` contido APENAS em `./database/`
- [ ] Possui o header obrigatório completo com tags corretas
- [ ] Todos os comandos usam `IF NOT EXISTS` (ou equivalente)
- [ ] Bloco de validação encapsulado no final (opcional mas recomendado)
- [ ] Defaults sensatos para não quebrar inserts antigos (`DEFAULT '{}'::jsonb`, etc.)

### 2. Backend & Frontend (TypeScript)
- [ ] Atualizar arquivos de tipo
- [ ] Se alterou ENUM: usar `grep` para encontrar todas as instâncias em back e front
- [ ] Rodar `npx tsc --noEmit` nas pastas `backend/` e `frontend/`

---

## Erros Comuns

### Erro: Drift I2 / "BLOCKED" no Preflight
**Causa:** O banco de dados possui uma migration registrada em `schema_migrations` que não existe no diretório oficial `./database/` na branch atual (drift reverso), ou você inseriu um arquivo destrutivo (`manual-risk`).
**Solução:** Se for `manual-risk`, acione o deploy via `workflow_dispatch` com a flag `ALLOW_MANUAL_MIGRATIONS=true` (requer backup). Se for drift de emergência, execute a reconciliação (ver seção Procedimento de Emergência).

### Erro: "Interface 'TreeNode' incorrectly extends interface 'System'"
**Causa:** Tipos do backend mudaram após a migration (ex: alterou enum adicionando `'subsystem'`), mas interfaces do frontend (`types/systems.ts` ou componentes) continuam esperando o formato antigo.
**Solução:** Atualize as interfaces no frontend usando `grep` para encontrar todas as ocorrências.

### Erro: "Types of property 'X' are incompatible"
**Causa:** Campo obrigatório em um tipo (ex: `depth`, `aliases`), mas opcional em outro. Isso gera dezenas de erros e bloqueia o deploy.
**Solução:** Torne os campos opcionais e use optional chaining (`?.`) ou nullish coalescing (`??`) no código. Garanta que `npx tsc --noEmit` rode limpo.

### Erro: Migration falha na 2ª execução
**Causa:** Faltou a cláusula `IF NOT EXISTS` (ou análogas como `DROP ... IF EXISTS`).
**Solução:** Não reescreva a migration original que já falhou/rodou pela metade. Crie uma nova migration com a correção ou um desvio seguro.

---

## Comandos Úteis

**Listar pendências e índice transacional (Beta):**
```bash
ssh -F C:\projetos\config faren "cd /opt/mesas-beta && bash scripts/deploy/reconcile_migrations.sh --list docker-compose.beta.yml mesas-beta-db"
```

---

## Lições Aprendidas

### L01: Sincronização de Tipos (Pré-Feature 001)
- **Problema:** Migration adicionou `'subsystem'` ao enum, mas arquivos frontend (`SystemEditModal.tsx`, `types/systems.ts`, `SystemTreeSelector.tsx`) não foram atualizados.
- **Solução:** Sempre usar `grep` para encontrar TODAS as ocorrências antes do deploy.

### L02: Campos Opcionais (Pré-Feature 001)
- **Problema:** `depth`, `aliases`, `has_children`, `children` eram obrigatórios em um tipo, opcionais em outro. Isso causou 17 erros de TypeScript e deploy bloqueado.
- **Prevenção:** Sempre usar optional chaining (`?.`) e nullish coalescing (`??`).

### L03: CHECK CONSTRAINT idempotente (Migration 118 — 10/05/2026)
- **Problema:** `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` não aceita `IF NOT EXISTS` em Postgres 16. Reaplicar a migration falha com `42710 duplicate_object` se a constraint já existe.
- **Solução adotada na migration 118:** envolver o `ALTER TABLE` em bloco `DO $$ ... END $$` que consulta `pg_constraint` por `conname` + `conrelid` antes de adicionar.
  ```sql
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'meu_check' AND conrelid = 'minha_tabela'::regclass
    ) THEN
      ALTER TABLE minha_tabela ADD CONSTRAINT meu_check CHECK (...);
    END IF;
  END $$;
  ```
- **Pré-requisito antes de adicionar a constraint:** garantir que dados existentes já satisfazem a regra. Se houver linhas em violação, `ADD CONSTRAINT` falha imediatamente. Confirmar com `SELECT count(*) WHERE NOT (regra)` antes da migration.
- **Aplicado em:** invariante `status='ready' ⇒ missing_fields=[]` em `discord_import_table_drafts` (spec 016 §9 item 1, anti-regressão de E166).

### Feature 001: Gate de Migrations (21/04/2026)
- **I2 (Drift Reverso):** Hotfixes manuais aplicados via SSH bypassam `schema_migrations`, causando dessincronização entre banco e disco. **Contramedida:** este guia torna `reconcile_migrations.sh --mark-applied` obrigatório após qualquer intervenção manual. **Ignorar =** próximo deploy bloqueado por drift.
- **I3 (Validação de Header):** Desenvolvedores criavam migrations ad-hoc sem documentar tipo e autor, dificultando auditoria. **Contramedida:** validação estrita de header e template obrigatório acoplada à esteira de CI. **Ignorar =** push e deploy quebram imediatamente no preflight.
- **I5 (Classificação Divergente):** Intervenções perigosas eram realizadas por descuido em operações de rotina sob a tag `online-safe`. **Contramedida:** pipeline intercepta operações destrutivas via regex bloqueando aprovações automáticas. **Ignorar =** bloqueio formal do deploy via CI exigindo classificação explícita `manual-risk`.
- **Manual-Risk:** Riscos destrutivos passavam despercebidos sem backup prévio e explícito no ambiente. **Contramedida:** deploy classificado como manual fica bloqueado em Produção até que intervenção exija `ALLOW_MANUAL_MIGRATIONS=true` acompanhado de backup validado. **Ignorar =** bloqueio completo antes da alteração do schema de produção.

### Feature 016: Invariante de drafts Discord (01/06/2026)
- `migration_118_discord_drafts_invariant.sql` adiciona a constraint `discord_drafts_ready_requires_no_missing`.
- A constraint impede `status='ready'` quando `normalized_payload->'missing_fields'` não existe como array vazio.
- A migration usa `NOT VALID` seguido de `VALIDATE CONSTRAINT`; se o banco ainda tiver drift, a validação falha antes de liberar o deploy.
- `@requires-backup: true` porque a constraint endurece regra de escrita em tabela operacional do Discord Sync.
