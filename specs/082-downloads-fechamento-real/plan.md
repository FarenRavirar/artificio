# Plano — Spec 082

## Fase 0 — inventário e segurança

- Ler estado de deploy vigente e listar containers/volumes/labels Downloads Beta/Prod read-only.
- Comparar os dois volumes Beta por `pg_restore`, contagens, schema e presença das 19 migrations; nunca remover volume antes de backup e decisão.
- Criar backup off-VM e restore-test isolado.
- Decisão concluída: Beta/dev usa `downloads-beta_pgdata_downloads_beta`; Produção usará `downloads_pgdata_downloads_prod`; legado `downloads_pgdata_downloads_beta` fica fora de runtime e retido por auditoria/rollback até os smokes.

## Fase 1 — runtime Beta

- Preservar o projeto Compose canônico `downloads-beta`; o volume legado foi criado sob projeto `downloads`, provavelmente por execução manual/pré-canônica.
- Definir bootstrap seguro das 19 migrations `online-safe`: banco vazio/projeto novo pode executar lote inicial controlado seguindo o precedente já documentado em `E012` (`.specify/memory/errors.md`) — `MAX_AUTO_PENDING=<N>` pontual só nessa rodada, via mesmo script oficial; banco existente mantém `MAX_AUTO_PENDING=5`. Guard funciona como projetado (proteção deliberada); não é bug a corrigir, não elevar limite globalmente.
- Preservar guard histórico: allowlist de DDL idempotente, tokenizer de comentários/strings, fail-closed e `CLASS` validada. Preservar tracking idempotente com `ON CONFLICT`.
- Aplicar o bootstrap inicial (rodada única `MAX_AUTO_PENDING=19`) antes/fora do fluxo de deploy padrão, para que o próximo `deploy.yml` normal encontre banco já em conformidade e não acione o guard nem o rollback de snapshot vazio.
- Aplicar migrations no volume correto pelo runner canônico e registrar tracking exatamente uma vez.
- Recriar/reconciliar Beta somente com autorização nominal quando houver write de VM/container.
- Usar volumes por ambiente: `downloads-beta_pgdata_downloads_beta` em Beta/dev e `downloads_pgdata_downloads_prod` em Produção. Não reutilizar o legado `downloads_pgdata_downloads_beta` como runtime.
- Não criar banco/projeção local de sistemas RPG. Validar Downloads→Site central via `@artificio/catalog-client`, `CATALOG_API_URL` e `CATALOG_INTERNAL_TOKEN`.
- Executar matriz de compatibilidade dos pacotes compartilhados consumidos por Downloads contra Mesas, Glossário e Links.

## Fase 2 — fechamento funcional

- Implementar UI de criação e submissão do rascunho.
- Decidir e implementar storage gerenciado real ou consolidar MVP somente com link externo.
- Fazer upload de evidência persistir binário quando esse contrato for mantido.
- Substituir o placeholder `/obter/:fileId` pela entrega/redirecionamento contratado.
- Migrar todas as telas/estados aos tokens semânticos de tema.
- Implementar ou reclassificar gestão de mídias, gestão de publicadores e link checker agendado.

## Fase 3 — smoke Beta

- Health, rotas públicas/protegidas/404.
- Submissão, moderação, publicação e download reais.
- Validar storage, checksum/redirect, rate limits, auditoria e rollback.

## Fase 4 — entrega Prod

- Checks locais e `verify:api` antes de commit.
- Branch/PR contra `dev`; só após aprovação explícita commit/push/merge.
- Promote e deploy Prod manual separado, com aprovação nominal.
- Smoke Prod e evidência final.

## Riscos/rollback

- Risco principal atual: bootstrap incompleto deixar API apontando para banco vazio. Não há dados de domínio a perder nos volumes comparados; mitigação é dump off-VM validado, restore-test e bootstrap controlado no volume por ambiente.
- Rollback: restaurar dump/volume validado, reverter branch por PR e usar rollback da esteira; não apagar dados sem aprovação.
