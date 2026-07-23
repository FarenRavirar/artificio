# Plano — Spec 082

## Fase 0 — inventário e segurança

- Ler estado de deploy vigente e listar containers/volumes/labels Downloads Beta/Prod read-only.
- Comparar os dois volumes Beta por `pg_restore`, contagens, schema e presença das 19 migrations; nunca remover volume antes de backup e decisão.
- Criar backup off-VM e restore-test isolado.
- Decidir, por evidência, se o volume legado contém schema/dados a preservar. A inspeção exata exige container/restore temporário e autorização nominal de write na VM.

## Fase 1 — runtime Beta

- Preservar o projeto Compose canônico `downloads-beta`; o volume legado foi criado sob projeto `downloads`, provavelmente por execução manual/pré-canônica.
- Definir bootstrap seguro das 19 migrations `online-safe`: limite por módulo/primeiro deploy ou operação controlada, sem elevar globalmente `MAX_AUTO_PENDING=5`.
- Corrigir o comportamento de falha/rollback de primeiro deploy para não deixar o serviço apontando a banco vazio.
- Aplicar migrations no volume correto pelo runner canônico e registrar tracking exatamente uma vez.
- Recriar/reconciliar Beta somente com autorização nominal quando houver write de VM/container.

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

- Risco principal: escolher volume vazio e perder dados/estado Beta. Mitigação: dumps, hashes, restore-test e retenção dos volumes.
- Rollback: restaurar dump/volume validado, reverter branch por PR e usar rollback da esteira; não apagar dados sem aprovação.
