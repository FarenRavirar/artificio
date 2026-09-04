# Migrations — `apps/mesas`

> **O procedimento vive em `docs/agents/deploy-flow.md` §3, e só lá.**
>
> Header obrigatório, template, checklist antes de commitar, idempotência
> (incluindo `CHECK CONSTRAINT`), fluxo padrão, guard `MAX_AUTO_PENDING`,
> procedimento de emergência, drift e reconciliação: tudo está naquela seção,
> que é autossuficiente.
>
> Este arquivo era o guia canônico e foi consolidado em 2026-09-03. Ficar
> pulando entre arquivos para escrever uma migration era o problema; a regra
> agora está num lugar só. Aqui permanece apenas o **histórico específico do
> mesas** — casos que ilustram a regra, não a definem.

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
