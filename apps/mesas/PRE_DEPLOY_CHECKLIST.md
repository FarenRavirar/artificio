# PRE-DEPLOY CHECKLIST

> [!CAUTION]
> **CHECKLIST OBRIGATÓRIO ANTES DE QUALQUER DEPLOY EM PRODUÇÃO**
>
> Este checklist constitui a principal barreira de defesa contra corrupção do banco de dados e downtime da Produção. A Produção é a Única Fonte de Dados Reais do sistema. Qualquer agente que subverter essa lista será responsabilizado por perda de dados críticos.
>
> **Documentos relacionados:**
> - `AGENTS.md` — regras pétreas, aprovações explícitas e protocolo de sessão
> - `docs/sdd/BRANCH_POLICY.md` — política de branches e merge via PR
> - `.specify/memory/project-state.md` — estado atual e próxima ação
> - `migrations_guide.md` — regras de migration, drift e reconciliação

---

## 🛑 FASE 1: VALIDAÇÃO DE ESTADO (LOCAL E BETA)

Antes sequer de cogitar enviar código novo para produção, o agente DEVE garantir que a versão "Release Candidate" rodou perfeitamente no Beta.

- [ ] **Mergulho pré-deploy:** Ler `AGENTS.md`, `.specify/memory/project-state.md`, `docs/sdd/BRANCH_POLICY.md`, `migrations_guide.md` e consultar este checklist.
- [ ] **Paridade Testada no Beta:** O código que vai para produção já foi submetido via push/merge para a branch `dev` e os containers do `mesas-beta` iniciaram com sucesso?
- [ ] **Migrations Foram Executadas no Beta:** Se houve nova Migration `.sql`, ela subiu pro banco Beta sem quebrar os dados preexistentes?
- [ ] **Relatório do Preflight (`preflight_prod`):** O PR de promoção apresenta o comentário automático do preflight? O status do drift detectado é `GO` (seguro) ou exige `ATTENTION` (bloqueios pendentes/risco)?
- [ ] **Classificação Automática pelo Header:** Toda migration nova contém o cabeçalho obrigatório (`-- @class: online-safe` ou `manual-risk`) para que o Gate a valide corretamente?
- [ ] **Teste de Ponta-a-Ponta no Beta:** Interfaces impactadas foram checadas manualmente (seja pelo usuário ou log do agente via `curl`/terminal)? Todo deploy pressupõe a aprovação unânime do comportamento em `mesasbeta.artificiorpg.com`.

## 🛑 FASE 2: PREVENÇÃO DE DESASTRE DE SCHEMA

O maior risco para a aplicação reside na incompatibilidade entre o backend (código) de Produção e a estrutura das colunas/tabelas no Banco da Produção.

> [!CAUTION]
> **A Regra Primária de Falhas de Deploy:** Se você atualizar o backend em Produção e a aplicação cair porque o banco responde com `column does not exist` ou `relation does not exist`, **NUNCA TENTE CONSERTAR A PRODUÇÃO COM `ALTER TABLE` A VULSO.** Você DEVE reverter (Rollback) o código para a versão imediatamente anterior que funcionava com o banco, investigar a Migration em ambiente Beta e só então submeter a automação corrigida.

- [ ] **Auditoria de Migrations Destrutivas:** O preflight acusou a presença de migrations classificadas como `manual-risk`? (ex: arquivos que contêm `TRUNCATE`, `DELETE FROM`, `DROP TABLE` ou `DROP COLUMN`).
  - Se positivo, **O DEPLOY SERÁ BLOQUEADO AUTOMATICAMENTE** pelo gate.
  - Para seguir, você precisará acionar o deploy passando a variável `ALLOW_MANUAL_MIGRATIONS=true` explicitamente.
  - A esteira de Produção **exigirá** a confirmação de backup para aceitar a flag manual.

## 🛑 FASE 3: BACKUP DA PRODUÇÃO (MANDATÓRIO)

Você está mudando a infraestrutura que os clientes pagam e/ou usam diariamente.

- [ ] Execute e **confirme via filesize** o backup diário ou imediato do banco de dados completo na VM. **Nenhuma migration `manual-risk` passará no gate sem a variável `PROD_BACKUP_FILE` apontar para o dump abaixo validado.**
```bash
ssh -F C:\projetos\config faren \
  "docker exec mesas-db pg_dump -U admin -d mesas_rpg > /tmp/backup_$(date +%Y%m%d_%H%M%S)_pre_deploy.sql"
```
- [ ] Se houver modificação nos diretórios estáticos montados localmente, realize o backup de arquivos visados.

## 🛑 FASE 4: PROCEDIMENTO DE DEPLOY NA VM

> [!CAUTION]
> **REGRA CRÍTICA — NUNCA USAR `git checkout` ENTRE BRANCHES**
>
> **Proibido durante deploy:**
> - ❌ `git checkout main` (deleta arquivos temporariamente)
> - ❌ `git merge dev` (causa locks no Windows)
> - ❌ Qualquer operação local de merge
>
> **Método obrigatório:**
> - ✅ Criar PR via GitHub CLI: `gh pr create --base main --head dev`
> - ✅ Fazer merge via GitHub: `gh pr merge <número> --merge`
>
> **Motivo:** `git checkout` entre branches remove temporariamente arquivos que existem em uma branch mas não em outra, causando pânico no usuário. Ver `.specify/memory/errors.md` E143.
>
> **Regra adicional de isolamento (E144):** Workflow de produção NUNCA pode remover containers do beta.
> - ❌ Proibido usar limpeza global: `docker ps -a --filter "name=mesas-" | ... | docker rm -f`
> - ✅ Obrigatório usar escopo compose: `docker compose -f docker-compose.prod.yml down --remove-orphans`
> - ✅ Obrigatório validar pós-deploy: `mesasbeta.artificiorpg.com` deve continuar retornando 200

A Produção (`mesas.artificiorpg.com`) reflete os arquivos em `/opt/mesas/` servindo pela branch `main`.

**Fluxo correto de promoção:**

1. **Criar PR via GitHub CLI:**
   ```bash
   gh pr create --base main --head dev --title "chore: merge dev to main - descrição" --body "Detalhes do deploy"
   ```

2. **Fazer merge via GitHub:**
   ```bash
   gh pr merge <número> --merge --delete-branch=false
   ```

3. **Aguardar workflow automático:** O GitHub Actions executará `deploy-prod.yml` automaticamente após o merge.

4. **Verificação de Healthcheck (em menos de 1 min):** Utilize validações silentes em vez de interações manuais excludentes. 
   - [ ] Confirmar Logs: `docker logs mesas-api --since 1m` ou `tail` nas linhas mais recentes em busca explícita por erros (`grep -i 'error\|exception\|fatal'`).
   - [ ] Ping na Rota: `wget -qO- http://localhost:3000/api/v1/health`
5. **Verificação Visual do Healthcheck Completo:**
   - [ ] Testou se a API retornou um Code `200` com `{ status: 'ok' }` e `db: 'connected'`?
6. **Verificação obrigatória do gate de migration (apply_required_migrations.sh):**
   - [ ] Run do workflow contém log `[migrations] schema em conformidade para runtime.`
   - [ ] Se houve migration classificada como `manual-risk` em produção:
     - [ ] Deploy acionado com `ALLOW_MANUAL_MIGRATIONS=true`
     - [ ] Variável `REQUIRE_PROD_BACKUP_FOR_MANUAL=true` e caminho de backup confirmado no servidor
     - [ ] Log atesta evidência da aplicação da migration restrita
7. **Verificação obrigatória de isolamento Beta (E144):**
   - [ ] `curl -s -o /dev/null -w "%{http_code}" https://mesasbeta.artificiorpg.com` retorna `200`
   - [ ] `curl -s https://mesasbeta.artificiorpg.com/api/v1/health` retorna `{"status":"ok","environment":"beta","db":"connected"...}`
   - [ ] `docker ps --filter name=mesas-beta` mostra `mesas-beta-frontend`, `mesas-beta-api`, `mesas-beta-db` ativos
8. **Verificação obrigatória de saúde real do frontend (E145):**
   - [ ] `docker inspect mesas-app --format '{{.State.Health.Status}}'` retorna `healthy`
   - [ ] `docker inspect mesas-beta-frontend --format '{{.State.Health.Status}}'` retorna `healthy`
   - [ ] Se algum frontend estiver `unhealthy`, deploy deve ser tratado como falho mesmo com HTTP 200 externo
9. **Verificação anti-corrida de deploy beta (E146):**
   - [ ] Confirmar no GitHub Actions que não há dois runs `Deploy Beta` ativos ao mesmo tempo para `dev`
   - [ ] `deploy-beta.yml` deve conter `concurrency` com `cancel-in-progress: false`
   - [ ] Script remoto do deploy beta deve adquirir lock exclusivo (`flock /tmp/mesas-beta-deploy.lock`)
10. **Verificação obrigatória de rotas críticas + auto-recuperação (E150):**
   - [ ] Beta: `GET /api/v1/tables?limit=1` deve retornar `200`
   - [ ] Beta: `GET /api/v1/systems?view=tree` deve retornar `200`
   - [ ] Beta: `GET /auth/google?frontend_redirect=...` deve retornar `302` com header `Location` apontando para `https://accounts.google.com/o/oauth2/v2/auth`
   - [ ] Produção: `GET /api/v1/tables?limit=1` deve retornar `200`
   - [ ] Produção: `GET /api/v1/systems?view=tree` deve retornar `200`
   - [ ] Produção: `GET /auth/google?frontend_redirect=...` deve retornar `302` com header `Location` válido do Google OAuth
   - [ ] Se alguma rota crítica falhar após containers estarem `healthy`, o deploy deve executar `docker restart` no frontend do ambiente, aguardar health `healthy` e revalidar uma vez
   - [ ] Se a segunda validação falhar, o deploy deve ser marcado como falho

## 🚨 PROTOCOLO GERAL DE EMERGÊNCIA (ROLLBACK)

Se a bateria 4 falhar e os logs mostrarem um crash backend em Produção no minuto do deploy:

**NÃO INVISTA HORAS CORRIGINDO PELA LINHA DE COMANDO:**
1. Abaixe a versão ofensiva (`docker compose down`).
2. Desfaça a branch no diretório local da VM apontando pro hash do commit anterior e faça checkout seguro (`git revert` ou `git checkout <hash_antigo>`).
3. Rode `docker compose up -d` para restaurar.
4. Se o esquema do banco foi tocado e quebrou o App revertido, restaure o SQL via comando baseut de restabelecimento. `docker exec mesas-db psql ... < /tmp/backup_...sql`
5. Diagnostique os deltas de schema **No ambiente Beta** ou **em ambiente isolado**, NÃO usando o banco de produção de playground. Crie relatório em `.specify/memory/errors.md` documentando o rollback, em base na evidência guardada pela investigação pré-reversão.

---

> *"Para alterar a Produção sem temor, é necessário agir no Beta com rigor absoluto. E quando for tocar a Produção, que seja metódico."*
