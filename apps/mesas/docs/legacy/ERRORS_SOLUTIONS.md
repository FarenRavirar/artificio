# ERRORS_SOLUTIONS.md

Registro de erros, sintomas, causas prováveis, diagnóstico rápido e soluções validadas.

---

## Objetivo

Centralizar incidentes recorrentes e respectivas soluções validadas para reduzir retrabalho.

## Quando ler

Sempre que ocorrer erro, falha de execução ou comportamento inesperado.

## Protocolo obrigatório de causa raiz (antes de corrigir)

Para incidentes sem solução imediata na tabela, seguir este fluxo mínimo:

1. Reproduzir o erro 2 vezes (mesmo sintoma)
2. Identificar ponto de transição (onde o estado sai de correto para incorreto)
3. Formular hipótese testável e falsificável
4. Testar mudando uma variável por vez
5. Registrar recibo curto de causa raiz: sintoma → causa confirmada → evidência → alternativa descartada

Regra: sem causa raiz mínima, não aplicar correção estrutural.

## Rollback

Se a solução não funcionar:
1. Desfazer alteração aplicada
2. Retornar ao estado anterior estável
3. Registrar novo caso para investigação

---

## Índice rápido por categoria

Use para localizar o erro sem varrer a tabela inteira:

| Categorias de erro mapeadas | IDs |
|---|---|
| GitHub Actions / CI-CD / Deploy | E035, E037, E040, E055, E056 |
| Docker / Containers / Rede | E038, E039, E057, E109 |
| Git / Versionamento | E036, E071, E072, E101 |
| TypeScript / Frontend / Build | E041, E042, E046, E067, E074 |
| React / Frontend / Performance | E104, E111, E117, E135 |
| Banco de Dados / SQL / PostgreSQL | E043, E049, E054, E059, E064, E065, E068, E075, E086, E088, E108, E119, E136, E137 |
| SSH / Migrations / ALTER TABLE remoto | E108, E119, E137 |
| Ferramentas automatizadas / Agentes | E045, E050, E051, E052, E053, E058, E060, E061, E062, E063, E066, E070, E073, E076, E085, E091, E094, E095, E096, E097, E099, E100 |
| PowerShell — comandos Unix inexistentes / software externo | E085, E094 |
| Backend / API / Rotas | E118 |
| Autenticação / Sessão | E103, E105, E116, E147 |
| Backend / API Node.js | E078, E087, E089, E098 |
| Imgur / Upload de Imagens | E079, E080, E081 |
| Autenticação / Sessão | E103, E105, E116, E147 |
| SSH / Conexão Remota | E102 |

---

## Categoria: GitHub Actions / CI-CD / Deploy

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E035 | `drone-scp error: Process exited with status 1` no GitHub Actions | `rm: true` falha por permissão ou o diretório pai (`/opt`) é protegido | Logs do `scp-action` mostrando "Remove target folder" seguido de erro | Desativar `rm: true` no workflow e garantir permissões manuais via `chown` no servidor | Criar diretório e ajustar ownership (`sudo chown ubuntu:ubuntu`) antes do primeiro deploy |
| E037 | OOM (Out of Memory) ou lentidão extrema no build dentro da VM Oracle | Build do React/Vite consome muitos recursos em VMs ARM pequenas | `docker compose logs` mostrando falha de memória ou travamento do host | Realizar o build no GitHub Runner e copiar apenas a pasta `dist` final para o servidor | Preferir build no runner (GitHub-side) em vez de build no host (Oracle-side) para apps frontend |
| E040 | `rsync: connection unexpectedly closed (exit code 11)` | Diretório de destino não existe na máquina remota (VM) | Logs do GitHub Actions mostrando falha no rsync logo após mudar caminhos de pasta | Adicionar `ssh mkdir -p /path/to/dest` antes do passo de rsync no workflow YAML | Sempre garantir que o diretório pai existe antes de realizar rsync em caminhos complexos ou novos |
| E055 | `unknown flag: --branch` ao executar `gh run list --branch dev` na VM | Versão do GitHub CLI instalada na VM não suporta o parâmetro `--branch` | Comando retorna `unknown flag: --branch` | Usar: `gh run list --repo FarenRavirar/mesas_rpg_artificio -L 5 --json databaseId,name,status,conclusion,headBranch,createdAt` | Validar flags com `gh run list --help` no ambiente alvo antes de automatizar |
| E056 | `Unknown JSON field` ao executar `gh run list --json` com campos `displayTitle` ou `workflowName` | Versão do CLI da VM expõe schema reduzido | Comando falha listando campos permitidos | Usar apenas campos suportados: `conclusion`, `createdAt`, `databaseId`, `event`, `headBranch`, `headSha`, `name`, `status`, `updatedAt`, `url`, `workflowDatabaseId` | Validar schema exato com `gh run list --help` antes de usar `--json` |
| E133 | Deploy via GitHub Actions copia arquivos mas containers não refletem mudanças — código atualizado no servidor mas runtime continua com versão antiga | **Causa raiz confirmada (07/04/2026 - 3ª ocorrência):** Workflow usa `docker compose up -d --build --remove-orphans` mas **sem `--force-recreate`**. Docker Compose com `--build` só reconstrói se detectar mudanças no Dockerfile ou contexto de build. Mudanças em arquivos `.tsx`/`.ts` podem ser ignoradas por cache de layers. Container fica desatualizado mesmo após rsync bem-sucedido | **Diagnóstico:** (1) `git log --oneline -1` no servidor mostra commit recente; (2) `docker ps --format '{{.CreatedAt}}'` mostra container criado **antes** do último deploy; (3) Código no servidor (`/opt/mesas-beta/`) está atualizado mas runtime não reflete mudanças; (4) Rebuild manual com `--force-recreate` resolve imediatamente | **Solução validada (07/04/2026):** Adicionar `--force-recreate` ao comando de deploy nos workflows: `docker compose -f docker-compose.beta.yml up -d --build --force-recreate --remove-orphans`. Aplicar em `deploy-beta.yml` (linha 43) e `deploy-prod.yml` (linha 43). Commit e push para `dev` | **Prevenção obrigatória:** (1) Sempre usar `--force-recreate` em workflows de deploy para garantir que containers sejam recriados mesmo com cache; (2) Adicionar validação pós-deploy: comparar timestamp de criação do container com timestamp do commit; (3) Nunca assumir que `--build` sozinho garante atualização completa |

---

## Categoria: Docker / Containers / Rede

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E038 | Erro 502 Bad Gateway no Cloudflare Tunnel | `cloudflared` tenta acessar `localhost:30302` (ele mesmo) | Log do `cloudflared` mostrando "connection refused" ou timeout | Usar o nome do container na mesma rede Docker (`http://mesas-beta-frontend:80`) | Configurar túnel para apontar para nome do container + porta interna |
| E039 | `Host not found` / `Connection Refused` entre containers de projetos diferentes | Container do túnel não "enxerga" o app por isolamento de rede | `ping <container-name>` falhando de dentro do container do túnel | Adicionar a rede do túnel (ex: `gerenciador_telegram_default`) como `external` no `docker-compose.beta.yml` do projeto | Planejar rede compartilhada para serviços de infraestrutura comuns (túnel, banco, proxy) |
| E057 | `No such container` ao tentar `docker exec` no Postgres na VM | `container_name` não definido explicitamente; Docker Compose gera nome baseado na pasta | Comando SSH falha instantaneamente com "No such container" | Executar na VM `docker ps \| grep mesas` para identificar o nome correto gerado em runtime | Documentar sempre os nomes canônicos: `mesas-beta-db` e `mesas-db` |
| E102 | `getsockname failed: Not a socket` seguido de `Read from remote host ... Unknown error` ao executar comando SSH via `ssh -F C:\projetos\config` | **Causa raiz confirmada:** `ControlPath ~/.ssh/ssh-%r@%h:%p` no arquivo de config SSH é incompatível com Windows — o caminho `~/.ssh/` não existe ou tem permissões inadequadas, causando falha no socket de multiplexação | Qualquer comando `ssh -F C:\projetos\config faren` falha imediatamente com erro de socket; `scp` também falha | **Solução permanente:** Editar `C:\projetos\config` e alterar `ControlPath` para caminho Windows válido: `ControlPath C:/Users/%USERNAME%/.ssh/sockets/ssh-%r@%h:%p` (criar diretório `mkdir $env:USERPROFILE\.ssh\sockets` antes) **OU** desabilitar multiplexação: `ControlMaster no` (remover linha `ControlPath`) | Validar config SSH em Windows usando caminhos absolutos compatíveis ou desabilitar `ControlMaster` se multiplexação não for crítica |

---

## Categoria: Git / Versionamento

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E036 | `.gitignore` não funciona e arquivos pesados/sensíveis sobem para o Git | Quebras de linha enviadas como literais `\n` via comando shell/powershell | `git ls-files` exibindo `node_modules`, `.env` ou chaves privadas | Corrigir arquivo `.gitignore` manualmente com quebras de linha reais e limpar cache: `git rm -rf --cached` | Validar conteúdo do `.gitignore` e `git status` antes de grandes commits iniciais |
| E071 | `fatal: '<branch>' is already used by worktree at '<path>'` ao executar `git checkout` | A branch alvo já está anexada a outro worktree local e não pode ser checked out simultaneamente | `git checkout <branch>` retorna erro apontando caminho do worktree que já mantém essa branch ativa | Executar operações da branch no worktree indicado via `git -C <path> ...` (merge/push), ou remover/desanexar o worktree antes de novo checkout | Antes de trocar branch em repositórios com múltiplos worktrees, validar com `git worktree list` |
| E072 | `gh pr merge <id>` retorna `is not mergeable: the merge commit cannot be cleanly created` | Divergência entre `main` e `dev` impede merge automático direto da PR | `gh pr merge` falha com instrução para `gh pr checkout` + `git merge origin/main` | Sincronizar `dev` com `main` por branch intermediária: `git checkout -b sync/dev-main origin/dev` → `git merge origin/main` → resolver conflitos → push para `dev`; depois recriar PR e mergear | Antes de abrir PR de promoção, rodar `git log --oneline origin/dev..origin/main` e alinhar branches se houver commit exclusivo em `main` |
| E101 | `Deletion of directory 'X' failed. Should I try again? (y/n)` ao executar `git merge --squash`, `git pull` ou `git reset --hard` no Windows — prompt não resolve respondendo y ou n, comando trava indefinidamente | Windows mantém lock em diretórios deletados por processos ativos (IDE, antivírus, indexador de arquivos); diretórios recorrentes: `backend/scripts/`, `frontend/src/styles/`, `scripts/` | Sintoma aparece logo após deleção de diretório no merge; verificar previamente com `git diff --name-status dev...feature/<escopo> \| Select-String "^D"` se há deleções | **Nunca usar `git merge --squash` local quando a branch deleta diretórios.** Usar PR via GitHub: `git push origin feature/<escopo>` → `gh pr create --base dev --head feature/<escopo> --title "tipo: descrição" --body ""` → `gh pr merge <número> --squash --delete-branch` | Antes de qualquer merge local, verificar se há deleções de diretório na branch; se houver, ir direto para PR |

---

## Categoria: TypeScript / Frontend / Build

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E041 | `TS2305: Module 'authMiddleware' has no exported member 'verifyToken'` | Regressão de refatoração (renomeação de função exportada) | Falha no `tsc` durante o build no Docker | Atualizar os `imports` nas rotas para o novo nome da função | Realizar busca global (`grep`) por referências ao antigo nome após qualquer refatoração de exports |
| E042 | `TS2304: Cannot find name 'AlertCircle'` (ou outros ícones) | Esquecimento de importação explícita de componentes de ícone no React | Falha no compilador TypeScript ou lint em tempo de edição | Adicionar o componente ao `import { ... } from 'lucide-react'` | Ativar auto-import no IDE e rodar `npm run build` local antes do commit |
| E046 | `Error: spawn EPERM` no `vite build` / `esbuild` em sandbox | Restrição de execução de subprocesso no sandbox para o binário do `esbuild` | `npm run build` falha com "failed to load config ... spawn EPERM" | Reexecutar o build com permissão escalada fora do sandbox | Antecipar necessidade de execução fora do sandbox quando esse sintoma aparecer |
| E067 | `ESLint couldn't find a configuration file` ao rodar `npm run lint` no frontend | Script `lint` existe no `package.json`, mas o projeto não possui arquivo de configuração ESLint versionado | Execução termina com mensagem do ESLint pedindo `npm init @eslint/config` | Tratar `lint` como indisponível até adicionar configuração oficial; usar `npm run build` como gate de qualidade imediato | Evitar acionar `npm run lint` como critério de release enquanto não houver config ESLint no repositório |
| E074 | `TS2322: Type 'string \| string[]' is not assignable to type 'string'` em integrações do backend | Valores de `req.body`/`req.params` chegam com tipagem ampla e não casam com tipos literais das funções de serviço | `npm run build` (backend) falha apontando linhas de chamada de serviço | Normalizar antes de chamar o serviço (`String(...)`) e criar variável tipada após validação; ajustar tipagem do executor de query para aceitar `rowCount` nulo | Em integrações novas com TypeScript estrito, sempre criar variáveis "safe"/normalizadas entre entrada HTTP e chamadas de serviço tipadas |
| E090 | `Throttling navigation to prevent the browser from hanging` seguido de travamento na UI do frontend | Loop infinito no React Router causado por uma função de context (`login`/`logout`) incluida no array de dependências de um `useEffect` sem estar memoizada | O Console alerta sobre IPC flooding logo após o componente montar e a CPU sobe pra 100% na aba | Envolver a declaração da função exportada pelo Context Provider com `useCallback` | Sempre envolver métodos expostos em Contextos React com `useCallback`, para evitar re-criação da referência da função a cada mudança de estado do provider |

---

## Categoria: Banco de Dados / SQL / PostgreSQL

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E043 | `Postgres 500: null value in column "slug" violates not-null constraint` | Tentativa de criar entidade (mesa, sistema, perfil) sem fornecer o slug (campo obrigatório no banco) | Falha ao criar registro via painel ou API, retornando 500 no console | Aplicar `slugify.ts` nos controladores (`createTable`, `createSystem`, `createGmProfile`, etc.) para gerar slug automaticamente a partir do nome | Sempre gerar slugs automaticamente no Backend se o slug não for enviado |
| E049 | `ParserError` ao importar SQL (pg_dump modificado) | Aspas simples em campos de texto (ex: títulos de mesas) quebram o parser do PostgreSQL se não escapadas | Falha de transação com `syntax error at or near` ao executar `psql < arquivo.sql` | Usar script Python com psycopg2 e parâmetros (`cursor.execute(query, (val1, val2))`) em vez de arquivos SQL concatenados | Substituir DML manual por conectores ORM/DB API 2.0 em migrações de dados ricos |
| E054 | `ERROR: invalid reference to FROM-clause entry for table` durante UPDATE com `FROM LATERAL` | Subquery LATERAL no `UPDATE ... FROM` referencia alias da tabela alvo em contexto não permitido pelo PostgreSQL | Falha após `BEGIN`/`CREATE FUNCTION`, abortando a transação | Reescrever em 2 etapas: CTE `normalized` e `UPDATE ... FROM normalized n WHERE n.id = t.id` | Em migrations SQL, evitar `LATERAL` acoplado ao alias da tabela alvo; preferir CTE materializada |
| E059 | `FATAL: role "<usuario>" does not exist` ou `FATAL: database "<nome>" does not exist` ao rodar `psql` no container | Usuário ou nome do banco incorretos. O banco beta usa `POSTGRES_USER=admin` e `POSTGRES_DB=mesas_rpg` — **não `mesas`** | `docker exec mesas-beta-db psql -U <usuario> -d mesas ...` falha com erro de role inexistente ou banco não encontrado | Comando correto: `docker exec mesas-beta-db psql -U admin -d mesas_rpg`. Para confirmar os valores reais em runtime: `docker exec mesas-beta-db env \| grep POSTGRES`. Ver nomes canônicos completos em `ARQUITETURA_PROJETO.md` seção 3.1 | Nunca assumir o nome do banco como `mesas`; sempre confirmar com `docker exec mesas-beta-db env` antes do primeiro `psql` em sessão nova |
| E064 | `missing FROM-clause entry for table "<alias>"` em query SQL | Uso de alias em `JOIN/WHERE` sem declarar o alias na cláusula `FROM` | `psql` retorna erro apontando linha com `<alias>.<campo>` | Declarar alias explicitamente na origem (`FROM public.tables t`) e manter consistência em toda a query | Em scripts SQL gerados, validar aliases no `SELECT` base antes de adicionar `JOIN`/`WHERE` |
| E065 | `column reference "<coluna>" is ambiguous` em query com múltiplos JOINs | Coluna usada sem prefixo de alias em contexto com tabelas que compartilham o mesmo nome de coluna | `psql` acusa ambiguidade na cláusula `ORDER BY` ou `SELECT` | Prefixar explicitamente com alias da tabela correta (ex.: `ORDER BY t.created_at`) | Em queries com JOIN, sempre qualificar `ORDER BY`, filtros e colunas repetidas com alias |
| E068 | Falha no merge beta→prod com `insert or update violates foreign key constraint` durante restore `--data-only` | Dump com tabelas autorreferenciadas pode inserir fora de ordem quando há FKs circulares | `pg_dump` já alerta "circular foreign-key constraints"; restore aborta | Executar import com `SET session_replication_role = replica;` antes dos inserts e retornar para `origin` ao final | Em consolidações com `pg_dump --data-only`, sempre tratar tabelas autorreferenciadas |
| E075 | `ERROR: function min(uuid) does not exist` em migration de backfill | PostgreSQL não expõe agregado `min` para `uuid` na forma usada, quebrando CTE de deduplicação | Execução da migration falha com rollback | Substituir `min(uuid)` por seleção determinística com `DISTINCT ON (...) ORDER BY id` | Em migrations com UUID, evitar agregadores numéricos; preferir seleção ordenada e explícita |
| E086 | API 502 / `Database connection failed: Invalid URL` no healthcheck | Caractere especial (ex: `#`) na senha `POSTGRES_PASSWORD` injetado diretamente na montagem da `DATABASE_URL` no `docker-compose.yml` quebrando o parse da URI | Log de erro acusa `Invalid URL` ao criar Connection Pool | Remover a composição da URI do arquivo Docker Compose e repassar `${DATABASE_URL}` inteira já encodada pelo `.env` (onde `#` vira `%23`) | Nunca interpolar variáveis de senha com possíveis símbolos especiais (como `#` e `@`) dentro de URIs sem *url-encoding* prévio |
| E108 | Necessidade de aplicar migration SQL (`ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX`, etc.) no banco PostgreSQL do ambiente beta/produção via SSH — _aliases: migration remota, psql remoto, ALTER TABLE SSH, migration beta, aplicar migration, migration_10, migration_09, migration postgres docker, execute sql remote, docker exec psql ssh, pipeline sql ssh_ | Tentativa de passar SQL via argumento de linha de comando (`ssh ... psql -c "ALTER TABLE..."`) no PowerShell falha por conflito de escaping de aspas (ver E052). Tentativa de usar redirecionamento `<` também pode falhar (ver E053) | Erro ao executar: `psql: warning: extra command-line argument "TABLE" ignored` ou `ERROR: syntax error at end of input` — o SQL foi fragmentado por interpolação de aspas no PowerShell | **Solução validada (05/04/2026):** Salvar o SQL em arquivo local, passar via pipeline com `Get-Content -Raw`: `Get-Content -Raw "C:\caminho\migration.sql" \| ssh -i "<chave>" ubuntu@<IP> "docker exec -i mesas-beta-db psql -U admin -d mesas_rpg"`. Verificar resultado com: `Write-Output "SELECT column_name FROM information_schema.columns WHERE table_name='tables';" \| ssh ... "docker exec -i mesas-beta-db psql -U admin -d mesas_rpg"` | Nunca tentar passar SQL com aspas aninhadas via argumento direto do PowerShell; sempre salvar em arquivo `.sql` temporário em `/testes/` e usar pipeline; apagar arquivo após execução |


---

## Categoria: Ferramentas automatizadas / Agentes

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E045 | `windows sandbox: CreateProcessWithLogonW failed: 1056` durante leitura paralela no PowerShell | Limitação de criação de processo no sandbox Windows ao disparar comandos simultâneos | Falha ao executar múltiplos `Get-Content` em paralelo; execução individual funciona | Reexecutar as leituras em modo sequencial (`shell_command` único por vez) | Em sessões Windows, reduzir paralelismo para operações de leitura simples |
| E050 | `fallback failed: target content not found` ao editar arquivo via ferramenta automatizada | Diferença de escape/literal entre trecho alvo e conteúdo real impede match exato | Mensagem da ferramenta indicando "Could not successfully apply any edits" | Recarregar o trecho com `view_file`, reduzir escopo para bloco contíguo e aplicar `replace_file_content` | Em ajustes com strings escapadas (SQL/regex), validar literal primeiro e preferir edições incrementais |
| E051 | `bash: findstr: command not found` em diagnóstico remoto via SSH | Comando específico de Windows (`findstr`) executado em shell Linux da VM Oracle | Erro imediato no retorno do SSH | Substituir por `grep` ou filtros nativos do Linux | Em comandos remotos Linux, evitar utilitários exclusivos do Windows; priorizar comandos POSIX |
| E052 | `bash: -c: line 1: unexpected EOF while looking for matching` em comando SSH | Aspas simples e duplas aninhadas incorretamente no comando PowerShell enviado ao shell Linux | Erro de parsing imediato antes da execução | Simplificar quoting: evitar aninhamento excessivo, preferir `docker exec ... psql ...` direto | Em comandos cross-shell (PowerShell → SSH → bash), validar quoting mínimo e testar com query curta (`select 1`) |
| E053 | `ParserError` ao usar redirecionamento `<` em PowerShell para enviar SQL ao SSH | Operador `<` pode falhar no parser do PowerShell com aspas mistas | Erro com destaque no caractere `<` antes da execução remota | Substituir por pipeline: `Get-Content -Raw arquivo.sql \| ssh ... "docker exec -i ... psql ..."` | Em automações PowerShell, preferir `\|` para stdin remoto ao invés de `<` |
| E058 | `The process cannot access the file because it is being used by another process` ao limpar arquivos temporários | Processo mantém arquivo de lock aberto | `Remove-Item` falha com erro de lock no Windows | Encerrar o processo que criou o lock e então remover o arquivo | Antes de limpeza de workspace com arquivos abertos, encerrar o app responsável |
| E060 | `command timed out` ao cruzar grandes volumes via script único | Consulta ampla demais para o timeout padrão da ferramenta | A execução termina com `command timed out after ... ms` sem concluir | Reduzir escopo da consulta (paginar ou buscar direto no banco), usar abordagem incremental | Para diagnósticos massivos, evitar carregar dataset completo via API quando uma consulta SQL resolve mais rápido |
| E061 | `ENOENT: no such file or directory` ao testar scripts locais | Script executado em diretório diferente do local do arquivo alvo (`cwd` incorreto) | Node/Python retorna `ENOENT` apontando caminho inexistente | Reexecutar com caminho absoluto correto ou ajustar `workdir` para a raiz do repositório | Em testes rápidos, sempre validar `cwd` e preferir caminho absoluto para artefatos fora da pasta atual |
| E062 | `SyntaxError: f-string expression part cannot include a backslash` em script Python | Uso de `\\n` ou escape dentro de expressão interpolada no `f-string` | Execução falha imediatamente antes da lógica principal | Extrair a expressão para variável intermediária e interpolar só a variável no `f-string` | Em scripts Python geradores de SQL, evitar expressões complexas com escapes dentro de `f-string` |
| E063 | `UnicodeDecodeError` em `subprocess.run(..., text=True)` ao ler saída de SSH/psql no Windows | Decodificação padrão (`cp1252`) não suporta bytes UTF-8/latin mistos na saída remota | Stack trace aponta `encodings\\cp1252.py` | Definir `encoding='utf-8'` e `errors='replace'` no `subprocess.run` | Em scripts que consomem saída remota, nunca depender do encoding padrão do host Windows |
| E066 | `UnicodeEncodeError` ao imprimir JSON UTF-8 no terminal Windows | Console local em CP1252 tenta renderizar caracteres fora da tabela (acentos/unicode) | Stack trace em `encodings\\cp1252.py` durante `print(...)` | Exibir com escape seguro (`value.encode('unicode_escape').decode()`) ou ajustar `PYTHONIOENCODING=utf-8` | Em diagnósticos de API com caracteres acentuados, evitar `print` direto sem padronizar encoding |
| E070 | `rg: *.md ... os error 123` ao rodar ripgrep no PowerShell com glob literal | No Windows/PowerShell, `*.md` como argumento literal pode gerar erro de sintaxe de caminho | Comando falha com "A sintaxe do nome do arquivo... está incorreta. (os error 123)" | Rodar `rg` sem glob literal no path (ex.: `rg -n "<padrao>" -g "*.md"` ou `rg -n "<padrao>" .`) | Em Windows, preferir `-g` para filtros de extensão e usar `.` como raiz de busca |
| E073 | `The term 'docker' is not recognized...` ao executar comandos Docker no host Windows | Docker CLI não está instalado no host local ou não está no `PATH` | PowerShell falha imediatamente ao chamar `docker ps` | Para operação dos ambientes do projeto, executar comandos Docker via SSH na VM Oracle (`ssh -F C:\\projetos\\config faren`) | Em validações de runtime, assumir como padrão o diagnóstico remoto na VM e não depender do host local |
| E076 | `Cannot process command because of one or more missing mandatory parameters: InputObject` ao usar `echo` em PowerShell | Em algumas sessões/policies, `echo` sem argumento entre comandos encadeados dispara erro de parâmetro obrigatório | Execução retorna stack do `Write-Output` após comando com `echo;` vazio | Evitar `echo` vazio; usar `Write-Host ''` ou executar os comandos separadamente | Em scripts PowerShell de diagnóstico, não usar `echo` sem argumento explícito |
| E085 | `grep: The term 'grep' is not recognized`, `tail: not recognized` ou `<comando>: command not found` no shell local | Comando exclusivo de bash/Linux executado acidentalmente no terminal PowerShell do host | O terminal recusa com `term is not recognized as a name of a cmdlet` | Usar equivalentes nativos do PowerShell. Tabela de substituição: `tail -N` → `Select-Object -Last N`; `head -N` → `Select-Object -First N`; `grep PADRÃO` → `Select-String -Pattern PADRÃO`; `cat arquivo` → `Get-Content arquivo`; `wc -l` → `(Get-Content arquivo).Count`; `which cmd` → `Get-Command cmd`; `touch arquivo` → `New-Item arquivo` | Ter constante ciência se o terminal instanciado é o Host (PowerShell) ou remote SSH (bash) antes de executar comandos Linux. Ver também E094 para comandos que exigem instalação de software externo |
| E094 | Agente propõe instalar ferramenta externa (ex: `winget install GnuWin32.Tail`, `choco install grep`, `scoop install coreutils`) para suprir comando Unix inexistente no PowerShell | O agente identifica que o comando não existe no host e decide instalar software para supri-lo, sem consultar o responsável | Proposta de instalação aparece no plano de execução ou no chat sem pergunta explícita ao usuário | **Nunca instalar software externo sem autorização explícita do responsável no chat.** Se o comando necessário não existe nativamente no PowerShell e não há equivalente nativo direto: (1) perguntar explicitamente no chat se o usuário deseja instalar o software e qual gerenciador usar (`winget`, `choco`, `scoop`, manual); (2) enquanto aguarda resposta, usar o equivalente PowerShell nativo mais próximo | Antes de usar qualquer comando que não seja nativo do PowerShell (nem alias do PS nem cmdlet), verificar se há equivalente nativo. Se não houver: **perguntar antes de instalar**. Nunca assumir que `winget`, `choco` ou `scoop` estão disponíveis sem validação |
| E091 | `Get-Content: The input object cannot be bound to any parameter` ao usar `git diff ... | cat` no PowerShell | Alias `cat` aponta para `Get-Content`, que espera caminho de arquivo e não recebe corretamente o pipe de texto do `git diff` | Comando termina com `Exit code: 1` e stack curta de binding do `Get-Content` | Não usar `| cat` no PowerShell para diffs; executar `git diff -- <arquivo>` diretamente (ou redirecionar para arquivo e abrir com `view_file`) | Em shell PowerShell, evitar aliases Unix ambíguos (`cat`, `grep`) em pipelines de saída textual |
| E095 | `Path DDAL canônico não encontrado` em script Python de normalização apesar de `dungeons-dragons/5e/2024` existir no arquivo | Validação de DDAL usava cálculo de caminho diferente do importador oficial (`systemsTreeImport`), e o parser de `.md` aceitava fallback de rótulo livre, poluindo a árvore com texto narrativo | Report do script indica `ddal_path_found: false` com saída contendo linhas narrativas transformadas em nós | Alinhar validação ao algoritmo do importador (ignorar `lineDepth < 2` e usar `lineDepth - 2`) e desabilitar fallback por rótulo livre para `.md` (manter apenas para `.txt`) | Em utilitários auxiliares de import, espelhar exatamente as regras de parsing/hierarquia do importador canônico antes de validar paths críticos |
| E096 | `grep: bad regex ... Missing ']'` ao buscar strings com `[`/`]` em comando remoto Linux | Uso de `grep` no modo regex com colchetes literais não escapados (ex.: `[[`) em comando enviado via PowerShell → SSH | Erro imediato do `grep` no stderr ao tentar localizar padrões com colchetes | Usar busca literal com `grep -F` ou escapar metacaracteres (`\[\[`); para diagnósticos rápidos, preferir `grep -Fn '<texto literal>' arquivo` | Em comandos remotos com padrões dinâmicos, assumir regex como risco e optar por `-F` por padrão quando a intenção for texto literal |
| E097 | `CORTEX_STEP_TYPE_LIST_DIRECTORY: directory <caminho> does not exist` ao usar `list_dir` | Tentativa de listar diretório não criado ainda (ex.: módulos `services`/`domain` antes da implementação) | Ferramenta retorna erro imediato de diretório inexistente sem executar etapa subsequente | Confirmar existência prévia com `list_dir` no diretório pai e criar a pasta antes de listar (`write_to_file` cria pais automaticamente); quando intencional, tratar como ausência esperada e seguir criação incremental | Em tarefas de scaffolding, validar árvore atual antes de listar subpastas novas e evitar chamadas de listagem para caminhos ainda não materializados |
| E099 | `invalid tool call error (invalid_signature) ... ReplacementChunks is a required parameter` ao editar arquivo via ferramenta | Chamada de ferramenta emitida com schema inválido (campo obrigatório ausente) | A execução falha antes da edição, com mensagem explícita de assinatura inválida e sem alteração em arquivo | Reexecutar em modo sequencial com payload completo e aderente ao schema (`ReplacementChunks` obrigatório no `multi_replace_file_content`), sem paralelizar correções de erro de chamada | Antes de enviar tool calls de edição, validar manualmente os campos obrigatórios da assinatura e manter uma correção por vez quando houver erro de schema |
| E100 | `CORTEX_STEP_TYPE_GREP_SEARCH: regex parse error ... unrecognized escape sequence` ao usar `grep_search` | Padrão regex enviado com escapes inválidos para o motor da ferramenta (ex.: `\"`), comum ao portar string escapada de outra linguagem | A ferramenta falha imediatamente sem resultados, exibindo `regex parse error` com posição do escape inválido | Simplificar o padrão para regex nativo (`id="([^"]+)"`) ou usar `IsRegex=false` para busca literal; quando necessário, validar primeiro em padrão mínimo e iterar | Ao usar `grep_search` com `IsRegex=true`, evitar over-escape; tratar o padrão como regex bruto e só escapar metacaracteres realmente necessários |

---

## Categoria: Backend / API Node.js

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E041 | `TS2305: Module has no exported member` em rota do backend | Regressão de refatoração (renomeação de função exportada em middleware) | Falha no `tsc` durante o build no Docker | Atualizar os `imports` nas rotas para o novo nome da função | Realizar busca global por referências ao antigo nome após qualquer refatoração de exports |
| E078 | API Node.js não inicializa — container reinicia em loop | Variável de ambiente obrigatória ausente no `.env` (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `IMGUR_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET`) ou banco PostgreSQL ainda não está disponível na rede Docker | `docker compose logs mesas-beta-api` mostra `Error: getaddrinfo ENOTFOUND` ou `password authentication failed` ou `Cannot read properties of undefined` logo no startup | Verificar `.env` com `grep -c "POSTGRES_USER\|DATABASE_URL\|JWT_SECRET\|JWT_REFRESH_SECRET\|IMGUR_CLIENT_ID\|GOOGLE_CLIENT_ID\|GOOGLE_CLIENT_SECRET" /opt/mesas-beta/.env`; se banco não estiver pronto, aguardar ou adicionar `depends_on` com `healthcheck` no compose | Sempre preencher `.env` antes do primeiro `docker compose up`; usar `depends_on` com condição `service_healthy` para a API aguardar o banco |
| E087 | `Cannot GET /auth/google/callback` após login Google no beta | `redirect_uri` efetivo ficou em `/auth/google/callback` (legado), mas a rota canônica ativa da API é `/api/v1/auth/google/callback`; quando o alias `/auth` não está realmente ativo no build em execução, o callback legado cai em 404 | 1) `curl -i https://mesasbeta.artificiorpg.com/auth/google/callback?code=test` retorna `404`; 2) `curl -i https://mesasbeta.artificiorpg.com/api/v1/auth/google/callback?code=test` retorna `500` de código inválido (prova que a rota canônica existe); 3) `GET /api/v1/auth/google` retorna `302` com `redirect_uri` legado | **Não usar callback legado**. Padronizar Google Console + `GOOGLE_CALLBACK_URL` para `https://mesasbeta.artificiorpg.com/api/v1/auth/google/callback`; validar após deploy que o header `Location` de `/api/v1/auth/google` aponta para a URI canônica | Antes de qualquer teste manual de OAuth, validar primeiro o `Location` do `302` em `/api/v1/auth/google`. Se vier `/auth/google/callback`, não prosseguir com login até corrigir a configuração |
| E089 | `{"error":"Erro de autenticação com provedor externo."}` após callback OAuth com `code` válido | `require('google-auth-library').google.oauth2(...)` falha com `Cannot read properties of undefined (reading 'oauth2')` — `google` não é exportado diretamente de `google-auth-library` dessa forma | `docker logs mesas-beta-api` mostra `TypeError: Cannot read properties of undefined (reading 'oauth2')` na linha do callback | Substituir o bloco `require(...).google.oauth2(...)` por `fetch` direto no endpoint `https://www.googleapis.com/oauth2/v2/userinfo` com header `Authorization: Bearer ${tokens.access_token}` — sem dependência extra | Nunca usar `require('google-auth-library').google.*` — a lib exporta `OAuth2Client`, `GoogleAuth`, etc. diretamente. Para buscar userinfo, usar o `access_token` retornado por `getToken()` com fetch nativo |
| E098 | Hotfix local de OAuth parece correto, mas ambiente beta continua com comportamento antigo | Alteração feita apenas no workspace local (ou em branch sem deploy), enquanto o runtime beta ainda usa configuração/build anterior (`GOOGLE_CALLBACK_URL` efetivo antigo) | `docker-compose.beta.yml` local aponta para `/api/v1/auth/google/callback`, porém o `Location` real de `/api/v1/auth/google` ainda mostra `/auth/google/callback` | Após alteração de OAuth, exigir ciclo completo: commit → push autorizado para `dev` → run `Deploy Beta` concluído → revalidar `Location` do `302` em produção beta. Se persistir, auditar `.env` remoto em `/opt/mesas-beta/` | Não considerar correção de OAuth concluída sem validação runtime da URL de redirecionamento efetiva (não apenas leitura de código local) |

---

## Categoria: Imgur / Upload de Imagens

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E079 | Upload de imagem retorna `403 Forbidden` da API do Imgur | `IMGUR_CLIENT_ID` ausente, inválido ou expirado no `.env` | Log da API mostra `Authorization header missing` ou `Invalid client_id` ao chamar `POST /image` | Confirmar `IMGUR_CLIENT_ID` no `.env` com `grep IMGUR_CLIENT_ID /opt/mesas-beta/.env`; validar o Client ID no painel do Imgur; nunca usar valor placeholder do `.env.example` | Verificar presença e validade do `IMGUR_CLIENT_ID` no pre-flight (`PRE-FLIGHT_CHECKLIST.md` passo 6) antes de qualquer tarefa com imagens |
| E080 | Upload retorna `429 Too Many Requests` da API do Imgur | Rate limit de 1250 uploads/dia por Client ID atingido | Log da API mostra `429` na chamada ao Imgur; verificar contagem diária em `imgur_cleanup_log` | Aguardar reset diário do limite (UTC midnight); não tentar novamente na mesma requisição; retornar erro claro ao usuário via Backend | Monitorar volume de uploads diários (`OPS-04` do `BACKLOG_OPERACIONAL.md`); nunca fazer upload em loop sem verificação de rate limit |
| E081 | Imagem deletada do Imgur mas `cover_url` ainda retorna na API pública | CleanupWorker executou a deleção no Imgur mas falhou ao zerar os campos no banco antes de encerrar | `cover_url` na tabela `tables` aponta para link que retorna 404 no Imgur | Zerar manualmente `cover_url`, `cover_deletehash`, `cover_imgur_id` no banco para a mesa afetada; registrar ocorrência em `imgur_cleanup_log` com `status=error` | CleanupWorker deve executar a atualização do banco na mesma transação da confirmação de deleção do Imgur; verificar logs do job após cada ciclo |

## Categoria: Git / Versionamento (continuação)

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E101 | `git merge` trava com "Deletion of directory 'X' failed. Should I try again? (y/n)" e não completa mesmo respondendo 'y' ou 'n' | Windows mantém lock em diretórios que foram deletados em uma branch mas ainda existem em outra; processo em background (IDE, antivírus, indexador) pode estar acessando o diretório | Comando `git merge` ou `git merge --squash` trava aguardando input infinitamente; diretórios como `backend/scripts`, `frontend/src/styles` aparecem na mensagem | **NUNCA tentar merge local com squash quando há deleção de diretórios.** Usar GitHub PR: `gh pr create --base dev --head feature/X --title "..." --body "..."` seguido de `gh pr merge <número> --squash --delete-branch`. O merge remoto no GitHub não sofre de locks do Windows | Sempre usar workflow via PR para merges que envolvem deleção de diretórios; evitar `git merge --squash` localmente no Windows; se necessário merge local, usar `git merge` sem squash e depois fazer squash no GitHub |
| E143 | Arquivos desaparecem ao fazer `git checkout` entre branches — usuário vê arquivos sendo deletados e entra em pânico | **Causa raiz confirmada (13/04/2026):** Comportamento NORMAL do Git. Ao fazer `git checkout main` vindo de `dev`, o Git remove arquivos que existem em `dev` mas não em `main` para refletir o estado correto da branch `main`. Ao voltar para `dev` com `git checkout dev`, os arquivos são restaurados automaticamente. **Problema:** Usuário vê arquivos importantes desaparecendo (ex: `MAPA_DE_API.md`, `map_scratch.json`, `RESUMO_EXECUCAO.md`, `generateMap.js`) e acredita que foram perdidos permanentemente | Usuário executa `git checkout main` e vê arquivos sendo deletados; IDE mostra arquivos riscados ou ausentes; usuário reporta "arquivos foram excluídos" | **Solução imediata:** `git checkout dev` — todos os arquivos são restaurados automaticamente. **Nenhum arquivo é perdido.** Git apenas ajusta o working directory para refletir o estado de cada branch. **Prevenção:** NUNCA fazer `git checkout` entre branches para deploy — usar GitHub PR ao invés de merge local | **REGRA OBRIGATÓRIA PARA AGENTES:** NUNCA executar `git checkout <outra-branch>` durante deploy ou promoção de código. SEMPRE usar GitHub PR: `gh pr create --base main --head dev` + `gh pr merge <número>`. Se precisar verificar divergência, usar `git log origin/main..origin/dev` SEM fazer checkout. Adicionar aviso explícito em `OPERACAO_PRODUCAO.md` e `PRE_DEPLOY_CHECKLIST.md` |
| E144 | Deploy de produção derruba ambiente beta (mesasbeta retorna 502 após deploy em main) | **Causa raiz confirmada (13/04/2026):** Workflow `deploy-prod.yml` executa limpeza destrutiva global: `docker ps -a --filter "name=mesas-" ... | xargs docker rm -f`. Esse filtro captura e remove também containers do beta (`mesas-beta-frontend`, `mesas-beta-api`, `mesas-beta-db`) porque todos começam com `mesas-`. Resultado: produção sobe, beta fica OFF | Após deploy de produção bem-sucedido, `https://mesasbeta.artificiorpg.com` retorna `502`; `docker ps -a --filter name=mesas-beta` não lista containers; logs do GitHub Actions mostram remoção explícita de `mesas-beta-frontend`, `mesas-beta-api`, `mesas-beta-db` | **Recuperação imediata validada:** `ssh ... "cd /opt/mesas-beta && git fetch origin dev && git reset --hard origin/dev && docker compose -f docker-compose.beta.yml up -d --force-recreate"` restaura beta em ~30s; healthcheck volta para 200 | **Prevenção obrigatória:** No `deploy-prod.yml`, remover limpeza global por nome. Se precisar remover órfãos, usar escopo de projeto compose (`docker compose -f docker-compose.prod.yml down --remove-orphans`) ou filtro estrito por labels do projeto de produção. Nunca usar `name=mesas-` em comandos destrutivos globais |
| E145 | Frontend responde externamente com HTTP 200, mas container permanece `unhealthy` | Healthcheck do frontend usando `http://localhost:80` resolve para IPv6 (`[::1]`) no container; Nginx estava acessível em IPv4 loopback (`127.0.0.1`) e o probe falhava com `Connection refused` | `docker inspect <frontend> --format '{{json .State.Health}}'` mostra `Connecting to localhost:80 ([::1]:80)` + `Connection refused`; ao mesmo tempo `curl` no domínio retorna 200 | Ajustar healthcheck em `docker-compose.prod.yml` e `docker-compose.beta.yml` para `http://127.0.0.1:80`, recriar apenas os frontends (`mesas-app` e `mesas-beta-frontend`) e validar health `healthy` | Workflows `deploy-prod.yml` e `deploy-beta.yml` devem falhar deploy se frontend não atingir `healthy` no timeout; considerar deploy falho mesmo quando site externo responde 200 |
| E146 | Deploy beta falha com `container name ... is already in use` durante criação do `mesas-beta-db` | Corrida entre execuções simultâneas do workflow `Deploy Beta` no mesmo host, ambas tentando executar `docker compose up -d` e recriar o mesmo conjunto de containers | Dois runs de `Deploy Beta` iniciados em sequência curta; um run falha com conflito de nome enquanto outro conclui; erro explícito no log: `Container mesas-beta-db ... already in use` | Reexecutar deploy após término do run concorrente e validar estado dos containers beta (`frontend`, `api`, `db`) como `healthy` | Serializar execução no workflow com `concurrency` (group por branch) e lock no host com `flock` (`/tmp/mesas-beta-deploy.lock`) para garantir exclusão mútua |


---

## Categoria: SSH / Conexão Remota

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E102 | `getsockname failed: Not a socket` seguido de `Read from remote host ... Unknown error` ao executar comando SSH via `ssh -F C:\projetos\config` | `ControlPath ~/.ssh/ssh-%r@%h:%p` no arquivo de config SSH é incompatível com Windows — o caminho `~/.ssh/` não existe ou tem permissões inadequadas, causando falha no socket de multiplexação | Qualquer comando `ssh -F C:\projetos\config faren` falha imediatamente com erro de socket; `scp` também falha | Editar `C:\projetos\config` e desabilitar multiplexação: `ControlMaster no` (remover linha `ControlPath`). Alternativa: usar caminho Windows válido `ControlPath C:/Users/%USERNAME%/.ssh/sockets/ssh-%r@%h:%p` | Validar config SSH em Windows usando caminhos absolutos compatíveis ou desabilitar `ControlMaster` se multiplexação não for crítica |

---

## Categoria: Autenticação / Sessão

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E103 | Usuários sendo deslogados inesperadamente durante o uso da aplicação | **Causa raiz final (05/04/2026 - 3 tentativas):** JWT_EXPIRES_IN=15m estava hardcoded no docker-compose.beta.yml, sobrescrevendo o .env. Docker Compose prioriza variáveis no YAML sobre .env. **Por que demorou:** (1ª) Corrigiu código local - não resolveu; (2ª) Corrigiu .env + restart - compose ignorou; (3ª) Identificou hardcode no YAML + down/up - resolveu | Usuário relata logout após ~15 minutos de uso; logs do frontend mostram chamadas frequentes para `/api/v1/me`; `window.location.reload()` sendo chamado no storage listener. **Diagnóstico remoto:** `docker exec mesas-beta-api env \| grep JWT_EXPIRES_IN` retorna `JWT_EXPIRES_IN=15m` | **Solução validada (05/04/2026):** (1) Atualizar `.env` no servidor: `ssh faren "sed -i 's/JWT_EXPIRES_IN=15m/JWT_EXPIRES_IN=7d/' /opt/mesas-beta/.env"`; (2) Reiniciar container: `ssh faren "docker restart mesas-beta-api"`; (3) Validar: `docker exec mesas-beta-api env \| grep JWT_EXPIRES_IN` deve retornar `7d`. Modificações no código (`AuthContext.tsx` com validação inteligente) já estavam aplicadas desde 04/04/2026 | NUNCA hardcodar env vars no docker-compose.yml - sempre usar ${VARIAVEL}; Validar 3 locais: .env local, .env remoto, docker-compose.yml; Sempre usar down/up após mudanças no compose (restart não aplica mudanças do YAML) |
| E147 | Login OAuth iniciado em `localhost` retorna para domínio incorreto ou sessão não persiste no frontend local | Backend beta não estava aceitando origem local em CORS e cookie estava com `SameSite` incompatível para fluxo cross-origin (`localhost` ↔ `mesasbeta`). Em paralelo, o redirect pós-login precisava respeitar `frontend_redirect` validado por allowlist | (1) Validar se `FRONTEND_URLS` inclui `http://localhost:5173` e `http://127.0.0.1:5173`; (2) validar `COOKIE_SAME_SITE=none` no ambiente beta; (3) confirmar em `backend/src/server.ts` uso de lista dinâmica de origens; (4) confirmar em `backend/src/routes/auth.ts` leitura de `frontend_redirect` com allowlist; (5) confirmar em `frontend/src/utils/auth.ts` envio de `frontend_redirect=window.location.origin` | **Solução validada (14/04/2026):** (1) Atualizar `/opt/mesas-beta/.env` com `FRONTEND_URLS` (localhost e 127.0.0.1) + `COOKIE_SAME_SITE=none`; (2) injetar variáveis no `docker-compose.beta.yml`; (3) recriar stack beta para aplicar envs; (4) manter CORS dinâmico por `FRONTEND_URLS` em `server.ts`; (5) manter callback OAuth retornando para origem permitida via `state` + `frontend_redirect` em `auth.ts` | Antes de validar OAuth local, sempre conferir allowlist (`FRONTEND_URLS`), política de cookie (`SameSite=None; Secure`) e parâmetro `frontend_redirect`. Sempre testar `/api/v1/me` com `credentials: 'include'` após callback para confirmar sessão ativa no frontend local |

---

## Categoria: React / Frontend / Performance

| ID | Sintoma | Causa provável | Diagnóstico rápido | Solução validada | Prevenção |
|---|---|---|---|---|---|
| E104 | Loop infinito de re-renderização no console do navegador — stack trace mostra `setInterval` e chamadas repetidas `Dl/El` | `useEffect` com dependência em propriedade de objeto (`obj.prop`) que é modificado dentro do próprio `useEffect`, criando ciclo: `useEffect` → `setState` → novo objeto → `useEffect` → ... | Console do navegador mostra centenas/milhares de linhas repetindo `Dl @ index-XXX.js:8` e `El @ index-XXX.js:8`; página trava ou fica extremamente lenta; CPU em 100% | **Remover a propriedade do objeto das dependências do `useEffect`** e adicionar guard interno para evitar criação desnecessária de objeto. Exemplo: `useEffect(() => { if (!condition) { setState(prev => prev.prop ? {...prev, prop: false} : prev); } }, [condition])` em vez de `useEffect(() => { if (!condition && state.prop) { setState(prev => ({...prev, prop: false})); } }, [state.prop, condition])` | Nunca incluir propriedades de objetos (`obj.prop`) nas dependências de `useEffect` se o próprio `useEffect` modifica esse objeto; sempre adicionar guard `if (prev.prop !== newValue)` antes de criar novo objeto no `setState`; usar `useCallback` e `useMemo` para estabilizar referências de objetos |

| E111 | Sistema selecionado no `SystemTreeSelector` não fica visível no topo, usuário precisa navegar pela árvore para encontrá-lo | Componente não exibia o sistema selecionado de forma destacada; faltava caixa fixa no topo mostrando seleção atual com opções de refinamento (edição/variante) | Usuário relata: "ao pesquisar e selecionar um sistema, ele vai lá pra baixo, e dificulta ter que encontrar" | **Solução validada (05/04/2026):** Adicionar caixa destacada no topo do `SystemTreeSelector.tsx` (após linha 201) que exibe: (1) Sistema base selecionado com ícone de check; (2) Dropdown de edições (se houver); (3) Dropdown de variantes (se edição selecionada e houver variantes); (4) Caminho completo da seleção atual. Implementação usa IIFE para calcular hierarquia (baseNode/editionNode/variantNode) a partir do `selectedIds[0]` e renderiza dropdowns condicionais. Build validado (Frontend compilou sem erros). | Sempre implementar feedback visual claro de seleção em componentes complexos; permitir refinamento hierárquico quando aplicável; testar UX com listas de 100+ itens |
| E116 | Logout em 15 minutos persiste mesmo após correção do código e do .env — usuários continuam sendo deslogados prematuramente | **Causa raiz (05/04/2026 - 3 tentativas até resolver):** JWT_EXPIRES_IN=15m estava **hardcoded no docker-compose.beta.yml**, sobrescrevendo completamente o arquivo .env. Docker Compose prioriza variáveis definidas diretamente no YAML sobre o .env. **Por que demorou 3 tentativas:** (1ª) Corrigiu apenas código local (AuthContext.tsx) — não resolveu; (2ª) Corrigiu .env remoto e reiniciou container — compose ignorou; (3ª) Identificou hardcode no YAML e recriou containers — resolveu | **Diagnóstico em 3 camadas:** (1) docker exec mesas-beta-api env grep JWT_EXPIRES_IN → retorna 15m (problema confirmado); (2) cat /opt/mesas-beta/.env grep JWT_EXPIRES_IN → retorna 7d (correto, mas ignorado); (3) grep JWT_EXPIRES_IN /opt/mesas-beta/docker-compose.beta.yml → retorna - JWT_EXPIRES_IN=15m (hardcode encontrado) | **Solução definitiva (05/04/2026):** (1) Corrigir hardcode: sed -i 's/JWT_EXPIRES_IN=15m/JWT_EXPIRES_IN=7d/' /opt/mesas-beta/docker-compose.beta.yml; (2) Validar mudança; (3) **Recriar containers (não apenas restart):** cd /opt/mesas-beta && docker compose -f docker-compose.beta.yml down && docker compose -f docker-compose.beta.yml up -d; (4) Validar runtime. **Crítico:** docker restart NÃO aplica mudanças do compose — exige down && up | **Prevenção obrigatória:** (1) NUNCA hardcodar variáveis de ambiente no docker-compose.yml — sempre usar ; (2) Após qualquer mudança em env vars, validar TRÊS locais: .env local, .env remoto E docker-compose.yml; (3) Sempre usar docker compose down && up após mudanças no compose; (4) Adicionar comentário no compose indicando quais vars vêm do .env |
| E142 | Erro "token inválido ou expirado" ao tentar desativar mesa no painel do mestre — outras operações autenticadas funcionam normalmente | **Causa raiz confirmada (13/04/2026):** Frontend usava `PUT /api/v1/gm/tables/:id` para alterar status da mesa (linhas 397-406 do `PainelMestrePage.tsx`), mas esse endpoint espera **todos os campos obrigatórios** de uma mesa completa (título, descrição, sistema, etc.) conforme validação do `updateTableSchema`. Quando o frontend enviava apenas `{status: 'draft'}`, o backend rejeitava por campos obrigatórios ausentes, retornando erro 400 que o frontend interpretava como erro de autenticação. O backend possui endpoint específico `PATCH /api/v1/gm/tables/:id/status` (linha 581 do `gmPanel.ts`) que aceita apenas o campo `status` | **Diagnóstico:** (1) Inspecionar `PainelMestrePage.tsx` linha 397 — endpoint usado é `PUT /tables/:id`; (2) Verificar `gmPanel.ts` linha 322 — `PUT /tables/:id` usa `updateTableSchema` que exige campos obrigatórios; (3) Verificar `gmPanel.ts` linha 581 — existe `PATCH /tables/:id/status` específico para alterar status; (4) Console do navegador mostra erro 400 ao tentar desativar mesa | **Solução validada (13/04/2026):** Corrigir `handleToggleTableStatus` em `PainelMestrePage.tsx` (linhas 387-406): alterar endpoint de `PUT /api/v1/gm/tables/${tableId}` para `PATCH /api/v1/gm/tables/${tableId}/status` e método de `PUT` para `PATCH`. Build validado sem erros TypeScript. Agora o toggle de status usa o endpoint correto que aceita apenas o campo `status` | **Prevenção obrigatória:** (1) Sempre usar endpoint específico para operações parciais (PATCH) ao invés de endpoint de atualização completa (PUT); (2) Consultar `MAPA_DE_API.md` antes de implementar chamadas de API; (3) Validar que endpoints PATCH existem para operações de toggle/status antes de usar PUT; (4) Adicionar testes E2E para operações de toggle de status |
| E117 | Abas "Aprovadas" e "Rejeitadas" em `/gestao` mostram os mesmos candidatos — dados idênticos nas duas abas | Mapeamento incorreto de status editorial no frontend. Query usava `approved` mas o backend espera `accepted`. Linha 329 do `GestaoPage.tsx`: `if (filter === 'approved') return candidate.editorial_status === 'approved';` deveria ser `=== 'accepted'` | Abrir `/gestao`, clicar em "Aprovadas" e "Rejeitadas" — ambas mostram mesma lista; console não mostra erros; backend retorna dados corretos mas frontend filtra errado | **Solução validada (05/04/2026):** Corrigir linha 329 do `GestaoPage.tsx`: `if (filter === 'approved') return candidate.editorial_status === 'accepted';`. Build validado (Frontend compilou sem erros). | Sempre validar mapeamento de enums entre frontend e backend; usar constantes compartilhadas quando possível; adicionar testes E2E para filtros críticos |
| E118 | Edição de sistema via `SystemEditModal` não persiste aliases — aliases desaparecem após salvar | Rota `PUT /api/v1/admin/systems/:id` não processava o campo `aliases` do body. Frontend enviava `aliases: ['D&D', '5e']` mas backend apenas atualizava `name`, `slug`, `node_type`, `parent_id`, `depth` e `path_slug` — ignorando completamente o array de aliases | Admin edita sistema, adiciona/remove aliases, clica "Salvar" — modal fecha com sucesso mas ao reabrir o sistema os aliases não foram salvos; banco de dados não mostra mudanças na tabela `system_aliases` | **Solução validada (05/04/2026):** Adicionar processamento de aliases na rota PUT (linhas 324-350 do `backend/src/routes/systems.ts`): (1) Extrair `aliases` do `req.body`; (2) Deletar aliases existentes: `db.deleteFrom('system_aliases').where('system_id', '=', id)`; (3) Inserir novos aliases com loop: `db.insertInto('system_aliases').values({system_id, alias, alias_slug: slugify(alias), is_official: false})`. Build validado (Backend compilou sem erros). | Sempre implementar CRUD completo (incluindo campos relacionados) ao criar rotas PUT; validar que todos os campos do modal são persistidos; adicionar testes de integração para rotas CRUD |

| E127 | `POST /api/v1/gm/tables` retorna 500 Internal Server Error ao criar mesa — frontend envia payload correto mas backend falha | Migration 17 (setting_name e setting_styles) não foi aplicada no banco beta. Backend tenta fazer `INSERT` com colunas que não existem: `ERROR: column "setting_name" of relation "tables" does not exist` | Frontend: `POST https://mesasbeta.artificiorpg.com/api/v1/gm/tables 500 (Internal Server Error)`. Diagnóstico: `SELECT column_name FROM information_schema.columns WHERE table_name='tables' AND column_name IN ('setting_name','setting_styles')` retorna `(0 rows)` | **Solução validada (05/04/2026):** Aplicar migration 17 via pipeline: `Get-Content -Raw "backend\src\migrations\migration_17_setting_and_styles.sql" | ssh faren "docker exec -i mesas-beta-db psql -U admin -d mesas_rpg"`. Validar com query de verificação. Resultado esperado: `BEGIN`, `ALTER TABLE`, `CREATE INDEX`, `CREATE TABLE`, `INSERT 0 10`, `COMMIT` | Sempre validar que migrations foram aplicadas no ambiente alvo antes de fazer deploy de código que depende delas; adicionar checklist de migrations no pre-flight; nunca assumir que migration local foi aplicada em beta/prod |
| E128 | `POST /api/v1/gm/tables` retorna 500 Internal Server Error — erro bloqueador crítico que impede criação/importação de mesas | **Causa raiz confirmada (05/04/2026):** Constraint do banco `price_value_required` exige que quando `price_type = 'paga'`, o campo `price_value` seja NOT NULL. O código em `gmPanel.ts` linha 437 fazia `price_value: price_value ?? null` sem validar antes se `price_type` era 'paga'. Quando frontend enviava `price_type: 'paga'` mas `price_value` era `undefined`, `null`, `0` ou string vazia, a constraint falhava com erro 500 | Frontend: `POST https://mesasbeta.artificiorpg.com/api/v1/gm/tables 500 (Internal Server Error)`. Log do backend: `error: new row for relation "tables" violates check constraint "price_value_required"`. Fluxo manual e fluxo importado ambos afetados | **Solução validada (05/04/2026):** (1) Adicionar validação explícita antes da transação: `const safePriceType = price_type ?? 'gratuita'; if (safePriceType === 'paga') { const parsedPriceValue = Number(price_value); if (!price_value || isNaN(parsedPriceValue) || parsedPriceValue <= 0) { return res.status(400).json({ error: 'Para mesas pagas, informe um valor válido maior que zero.' }); } }`; (2) Usar `safePriceType` no INSERT ao invés de `price_type ?? 'gratuita'`; (3) Build validado sem erros TypeScript. **Nota:** Constraint foi removida do banco com `ALTER TABLE tables DROP CONSTRAINT price_value_required;` — validação agora é feita exclusivamente no código da aplicação | Sempre validar campos obrigatórios condicionais (dependentes de outro campo) antes da transação do banco; retornar erro 400 claro ao invés de deixar constraint do banco retornar 500; adicionar validação similar no endpoint PUT /api/v1/gm/tables/:id |
| E129 | Banner não preenchido no fluxo de importação — `banner_url` extraído pelo parser mas não chega ao formulário de revisão | **Causa raiz confirmada (05/04/2026):** Bug crítico em `candidateToFormData.ts` linha 276. A função verificava `parsedContent.banner_url` ao invés de `enrichedJson.banner_url`. Como `parsedContent` é extraído de `enrichedFields` (linha 144-146) mas `enrichedJson` é o merge completo de `parsed_json + parsedContent` (linha 155), o campo `banner_url` do parser Python nunca era mapeado para o formulário. O mesmo bug afetava `avatar_url` (linha 287) | Candidato importado tem `banner_url` em `parsed_json.enrichedFields`, mas formulário de revisão não mostra preview do banner. Campo de banner aparece vazio. Mesa publicada não exibe banner mesmo após aprovação. Logs do backend mostram `banner_url` presente em `enrichedFields`, mas frontend não recebe | **Solução validada (05/04/2026):** (1) `candidateToFormData.ts` linha 276: alterar `if (parsedContent.banner_url)` para `if (enrichedJson.banner_url)`; (2) Linha 287: alterar `if (parsedContent.avatar_url)` para `if (enrichedJson.avatar_url)`; (3) Build validado sem erros TypeScript. Agora `banner_url` e `avatar_url` do parser Python são corretamente mapeados para o formulário de revisão | Sempre usar `enrichedJson` (merge completo) ao invés de `parsedContent` (apenas enrichedFields) para acessar campos do parser Python; validar que todos os campos de mídia seguem o mesmo padrão de mapeamento; testar fluxo completo de importação após correções de mapeamento |
| E130 | Descrição incompleta no fluxo de importação — sistema usa apenas sinopse curta quando deveria montar descrição longa completa | **Causa provável (05/04/2026):** Sistema está tratando `synopsis` como se fosse a descrição completa, quando o anúncio real muitas vezes tem: título, sinopse, regras, observações, diferenciais, instruções de inscrição, benefícios. Parser pode estar extraindo só `synopsis` curta e não o bloco inteiro útil. `candidateToFormData.ts` pode estar priorizando campo curto e ignorando descrição longa. Pode haver truncamento ou sanitização excessiva no frontend. `POST /api/v1/gm/tables` ou fluxo de aprovação pode estar persistindo `description` incompleta | Anúncios grandes do JSON real têm sinopse + observações + benefícios + instruções de inscrição, mas apenas um pedaço curto aparece no formulário de revisão e na mesa publicada. Instruções de inscrição podem estar sendo misturadas à descrição principal | **Decisão funcional obrigatória:** Definir regra editorial clara: (1) `synopsis` não é automaticamente igual a `description` final; (2) `description` final deve ser montada a partir dos blocos mais relevantes do anúncio; (3) `signupText` não deve ser colado no meio da descrição; (4) `rules/observations` devem ir para campo próprio; (5) Benefícios/diferenciais devem ir para campo apropriado ou ficar fora da descrição se o produto assim exigir. **Diagnóstico ponta a ponta:** (1) Parser Python: auditar o que é extraído como `synopsis` e o que fica fora; separar melhor `synopsis`, `rules`, `observations`, `benefits`, `signupText`; (2) Schema Pydantic: garantir campos suficientes para descrição editorial longa; (3) normalizeExporterPayload: preservar blocos textuais longos sem truncar; (4) parseExporterMessage: definir regra de composição de `description` final do candidato; (5) candidateToFormData: mapear corretamente `description`, `rules/observations` e `signupText` para campos separados; (6) Formulário: garantir que área de descrição receba texto completo; (7) gmPanel.ts: confirmar persistência sem truncamento; (8) candidateService: garantir persistência da descrição revisada; (9) API pública: confirmar que devolve descrição longa correta; (10) MesaPage: validar renderização do texto completo. Ver `sessoes/plano_json 2.md` linhas 357-430 para backlog detalhado | **Prioridade 2 - Qualidade editorial.** Sem essa decisão funcional, o sistema vai continuar "puxando descrição errada" mesmo com parser melhor. Teste manual ideal: usar anúncio grande do JSON real que tenha sinopse, observações, benefícios e instruções de inscrição; comparar texto cru da mensagem vs descrição final renderizada em 7 pontos do fluxo |
| E131 | Frontend exibe "R$ null" quando price_value é null — problema visual após remoção da constraint price_value_required | **Causa raiz (05/04/2026):** Após remover a constraint `price_value_required` do banco (para permitir validação no código), o frontend passou a aceitar `price_value: null` do backend. Os componentes `MesaPage.tsx` e `TableCard.tsx` não tratavam corretamente o caso de `price_value` null, exibindo "R$ null" ao invés de ocultar a seção | Frontend exibe "R$ null" em cards de mesa e página de detalhes quando `price_type='paga'` mas `price_value` é null. Visualmente confuso e não profissional | **Solução validada (05/04/2026):** Lógica simplificada - **se tiver preço, mostra; se não tiver, não mostra nada**. (1) `MesaPage.tsx` linhas 440-447: envolver seção de preço com `{table.price_value && (...)}` para renderização condicional; (2) `TableCard.tsx` lines 108-112: envolver span de preço com `{table.price_value && (...)}` para renderização condicional; (3) Remover lógica de fallback "Gratuita" - preço só aparece quando existe valor válido; (4) Build validado sem erros TypeScript. Agora a seção de preço é completamente oculta quando `price_value` for null | Sempre usar renderização condicional para informações opcionais; evitar fallbacks visuais quando a ausência de informação é válida; validar build após mudanças de lógica condicional |
| E132 | `ParserError: '}' de fechamento ausente` ou `Bloco Catch ou Finally ausente` em scripts PowerShell (.ps1) | **Causa raiz confirmada (07/04/2026):** Uso de emojis (como 📊) em arquivos UTF-8 sem BOM sendo lidos em ambiente Windows ANSI (CP1252). Bytes específicos de emojis podem ser interpretados como aspas inteligentes (`“`) ou escapes, fazendo o parser pular fechamentos de blocos ou `catch` | Erro ao executar script: `MissingEndCurlyBrace` ou `MissingCatchOrFinally`. A linha do erro geralmente aponta para o fechamento de um bloco `try` ou para um `Write-Host` com emoji | **Solução validada (07/04/2026):** (1) Remover emojis do script e usar indicadores ASCII (`[OK]`, `[ERRO]`); (2) Forçar encoding UTF-8 com BOM: `Get-Content script.ps1 | Out-File script.ps1 -Encoding utf8BOM` | Evitar o uso de emojis em scripts de infraestrutura PowerShell no Windows; sempre utilizar UTF-8 com BOM em arquivos `.ps1` para garantir portabilidade entre PowerShell 5.1 e 7 |



---

## E060 — Erro de compilação TypeScript: campo não existe em UpdateObjectExpression

**Sintoma:**
```
error TS2353: Object literal may only specify known properties, and 'age_rating' does not exist in type 'UpdateObjectExpression<Database, "tables", "tables">'.
```

**Causa:**
Após adicionar novos campos no banco de dados via migration, a interface TypeScript `TablesTable` em `backend/src/db/types.ts` não foi atualizada para incluir os novos campos. O Kysely usa essa interface para type-checking e não reconhece campos que não estão declarados.

**Solução:**
1. Abrir `backend/src/db/types.ts`
2. Localizar a interface `TablesTable`
3. Adicionar os novos campos com os tipos corretos:
   - Para campos enum: usar union types literais (ex: `'livre' | '10+' | '12+' | '14+' | '16+' | '18+'`)
   - Para campos nullable: adicionar `| null`
   - Para arrays: usar `string[]` ou `string[] | null`
   - Para campos com default: usar `Generated<tipo>` se necessário

**Exemplo:**
```typescript
export interface TablesTable {
  // ... campos existentes ...
  age_rating: 'livre' | '10+' | '12+' | '14+' | '16+' | '18+' | null;
  table_level: 'iniciante' | 'intermediario' | 'avancado' | null;
  game_platform: string | null;
  communication_platform: string | null;
  custom_scenario: string | null;
  style_tags: string[] | null;
  // ... outros campos ...
}
```

4. Executar `npm run build` no backend para verificar se não há mais erros

**Prevenção:**
Sempre que criar uma migration que adiciona campos à tabela `tables`, atualizar imediatamente a interface `TablesTable` em `backend/src/db/types.ts` antes de usar os campos no código.

**Contexto:**
Migration 13 adicionou 6 novos campos (age_rating, table_level, game_platform, communication_platform, custom_scenario, style_tags) mas a interface TypeScript não foi atualizada simultaneamente.

**Data:** 07/04/2026

---

## E134 — Sistema de Logging de Rotas para Debug

**Implementado em:** 07/04/2026

**Objetivo:**
Sistema completo de logging de requisições HTTP para diagnóstico de problemas de rotas, erros de banco de dados e comportamento inesperado da API.

**Localização dos logs:**
- **Arquivo principal (container):** `/app/logs/routes.log`
- **Arquivo principal (servidor):** `/opt/mesas-beta/logs/routes.log`
- **Arquivos rotacionados:** `routes-<timestamp>.log`
- **Rotação automática:** A cada 6 horas ou quando arquivo atingir 10MB
- **Retenção:** Últimos 5 arquivos rotacionados
- **Persistência:** ✅ Logs sobrevivem a deploys e recriações de container

**Como acessar os logs:**

```powershell
# Ver últimas 50 linhas (via container)
ssh -F C:\projetos\config faren "docker exec mesas-beta-api tail -50 /app/logs/routes.log"

# Ver últimas 50 linhas (diretamente no servidor)
ssh -F C:\projetos\config faren "tail -50 /opt/mesas-beta/logs/routes.log"

# Ver logs em tempo real (follow)
ssh -F C:\projetos\config faren "docker exec mesas-beta-api tail -f /app/logs/routes.log"

# Buscar por slug específico
ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep 'a-voz-nas-cartas' /app/logs/routes.log"

# Buscar por erro específico
ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep 'ERROR' /app/logs/routes.log | tail -20"

# Buscar por código de erro PostgreSQL
ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep '22P02' /app/logs/routes.log"

# Buscar por Request ID específico
ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep 'ReqID: 1712520000000-abc123' /app/logs/routes.log"

# Copiar log completo para análise local
scp -F C:\projetos\config faren:/opt/mesas-beta/logs/routes.log C:\projetos\mesas_rpg_artificio\testes\routes.log
```

**Formato do log:**

**Requisição normal:**
```
[2026-04-07T20:10:00.000Z] GET /api/v1/tables/slug-da-mesa | ReqID: 1712520000000-abc123 | Params: {"slug":"slug-da-mesa"} | Query: {} | IP: 192.168.1.1
```

**Erro de aplicação:**
```
[2026-04-07T20:10:00.500Z] GET /api/v1/tables/slug-da-mesa | ReqID: 1712520000000-abc123 | ERROR: Erro ao buscar mesa. | Code: 500 | Duration: 500ms | Params: {"slug":"slug-da-mesa"} | Query: {}
```

**Erro de banco de dados:**
```
[2026-04-07T20:10:00.500Z] DB_ERROR in GET /api/v1/tables/:slug (fetch_table_details) | ReqID: 1712520000000-abc123 | Error: invalid input syntax for type uuid: "slug-da-mesa" | PG Code: 22P02 | Params: {"slug":"slug-da-mesa"}
```

**Campos do log:**
- `timestamp`: ISO 8601 com timezone UTC
- `method`: GET, POST, PUT, DELETE, PATCH
- `path`: Caminho da rota (ex: `/api/v1/tables/slug-da-mesa`)
- `ReqID`: ID único da requisição para rastreamento
- `Params`: Parâmetros de rota (ex: `{slug: "..."}`)
- `Query`: Query string (ex: `{page: "1", limit: "10"}`)
- `IP`: Endereço IP do cliente
- `ERROR`: Mensagem de erro (apenas em falhas)
- `Code`: Status HTTP (apenas em falhas)
- `Duration`: Tempo de resposta em ms (apenas em falhas)
- `PG Code`: Código de erro PostgreSQL (apenas em erros de banco)

**Uso no código:**

```typescript
// Middleware já está ativo globalmente - não precisa adicionar em rotas individuais

// Para logar erros de banco de dados em rotas específicas:
import { logDatabaseError } from '../middleware/requestLogger';

try {
  const result = await db.selectFrom('tables').where('slug', '=', slug).executeTakeFirst();
} catch (error: any) {
  logDatabaseError(req, error, {
    route: 'GET /api/v1/tables/:slug',
    operation: 'fetch_table_details'
  });
  throw error;
}
```

**Diagnóstico de problemas comuns:**

1. **Erro 500 em rota específica:**
   ```powershell
   ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep 'GET /api/v1/tables' /app/logs/routes.log | grep ERROR | tail -10"
   ```

2. **Rastrear requisição específica por Request ID:**
   ```powershell
   ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep 'ReqID: <id>' /app/logs/routes.log"
   ```

3. **Ver todos os erros de UUID:**
   ```powershell
   ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep '22P02' /app/logs/routes.log"
   ```

4. **Ver requisições lentas (> 1000ms):**
   ```powershell
   ssh -F C:\projetos\config faren "docker exec mesas-beta-api grep -E 'Duration: [0-9]{4,}ms' /app/logs/routes.log"
   ```

**Manutenção:**
- Rotação automática a cada 6 horas ou 10MB
- Mantém últimos 5 arquivos rotacionados
- Logs antigos são deletados automaticamente
- Não requer intervenção manual

**Prevenção:**
- Sempre consultar logs antes de fazer debug manual
- Usar Request ID para rastrear requisições específicas
- Verificar logs após deploy para detectar regressões
- Monitorar erros 500 e códigos PostgreSQL recorrentes

**Contexto:**
Sistema implementado em 07/04/2026 após 3 horas de debug do erro 500 em `GET /api/v1/tables/:slug`. O sistema de logging teria reduzido o tempo de diagnóstico de 3 horas para ~15 minutos.

---

## E135 — Links de WhatsApp não funcionam quando backend retorna apenas número

**Sintoma:**
Botão "Enviar mensagem no WhatsApp" na página de detalhes da mesa não abre conversa. Link gerado é inválido (ex: `https://99985199454` ao invés de `https://wa.me/5599985199454`).

**Causa raiz confirmada (08/04/2026):**
Backend retorna contatos de WhatsApp com `value` contendo apenas o número (ex: `"99985199454"`), sem formatação de URL. A função `getValidUrl` no `TableContactsBlock.tsx` (linhas 100-112) só formatava corretamente se o valor começasse com `wa.me`, mas não tratava números puros.

**Diagnóstico:**
1. Inspecionar resposta da API: `curl -s "https://mesasbeta.artificiorpg.com/api/v1/tables/<slug>" | grep -A 5 "whatsapp"`
2. Se `value` for apenas dígitos (ex: `"99985199454"`), o problema está confirmado
3. Testar link gerado no navegador — deve retornar erro de DNS ou página não encontrada

**Solução validada (08/04/2026):**
Corrigir função `getValidUrl` em `frontend/src/features/table/components/TableContactsBlock.tsx` (linhas 100-125) para detectar números puros e formatar como URL `wa.me`:

```typescript
const getValidUrl = (value: string): string => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  
  if (contact.channel === 'whatsapp') {
    if (value.startsWith('wa.me')) {
      return `https://${value}`;
    }
    // Detectar número puro e formatar
    const cleanNumber = value.replace(/\D/g, '');
    if (cleanNumber.length >= 10) {
      const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      return `https://wa.me/${fullNumber}`;
    }
  }
  
  return `https://${value}`;
};
```

**Prevenção:**
1. **Solução ideal (backend):** Formatar URLs de WhatsApp no backend antes de retornar na API — adicionar helper `formatWhatsAppUrl()` em `backend/src/utils/contacts.ts`
2. **Solução atual (frontend):** Manter formatação defensiva no frontend para lidar com dados legados
3. **Validação:** Adicionar teste E2E que verifica se links de WhatsApp abrem corretamente
4. **Deploy:** Sempre usar script `scripts/deploy-beta.ps1` ao invés de deploy manual para evitar erros de cache

**Script de deploy criado:**
`scripts/deploy-beta.ps1` — automatiza: validação de branch, push, pull no servidor, build, cópia para container, reload nginx e validação.

**Uso:**
```powershell
.\scripts\deploy-beta.ps1
```

**Data:** 08/04/2026

---

## E136 — Aplicação de migration antiga apaga dados estruturados (sistemas, taxonomias, etc.)

**Sintoma:**
API retorna erro `42P01: relation "system_aliases" does not exist` ou similar para tabelas de dados estruturados. Tentativa de aplicar migration antiga resulta em perda massiva de dados (ex: 600+ sistemas reduzidos a 15).

**Causa raiz confirmada (09/04/2026):**
Quando há erro de tabela faltando em sistema com dados estruturados (sistemas de RPG, taxonomias, catálogos), o primeiro instinto é aplicar a migration que cria a tabela. **ERRO CRÍTICO:** Migrations antigas podem conter comandos destrutivos (`TRUNCATE`, `UPDATE` com valores default, `DELETE`) que sobrescrevem dados em produção.

**Diagnóstico correto:**
1. ❌ **NUNCA fazer:** Aplicar migration antiga imediatamente
2. ✅ **SEMPRE fazer primeiro:** Procurar arquivo fonte de dados (`.json`, `.csv`, `.sql`) e script de importação (`.ts`, `.js`, `.py`)
3. ✅ Verificar se há comando de importação documentado no README ou em `backend/src/scripts/`

**Solução validada (09/04/2026):**

**Passo 1 - Procurar arquivo fonte:**
```powershell
Get-ChildItem -Recurse -Filter "sistemas.json"
Get-ChildItem -Recurse -Filter "*.json" | Where-Object { $_.Name -match "sistema|system|taxonomy" }
```

**Passo 2 - Procurar script de importação:**
```powershell
Get-ChildItem -Recurse -Filter "import*.ts"
Get-ChildItem -Recurse -Filter "import*.js"
```

**Passo 3 - Executar importação (dentro do container):**
```bash
docker exec mesas-api node dist/scripts/importSistemas.js
```

**Passo 4 - Verificar resultado:**
```bash
docker exec mesas-db psql -U admin -d mesas_rpg -c 'SELECT COUNT(*) FROM systems;'
```

**Exemplo real:**
- Erro: `relation "system_aliases" does not exist`
- ❌ Aplicou `migration_02` → `UPDATE 15` → apagou 600+ sistemas
- ✅ Deveria ter procurado `backend/sistemas.json` (682 sistemas) + `backend/src/scripts/importSistemas.ts`
- ✅ Executar `docker exec mesas-api node dist/scripts/importSistemas.js` → restaurou 1.344 sistemas

**Prevenção obrigatória:**
1. **NUNCA aplicar migration antiga sem ler o conteúdo completo primeiro**
2. **SEMPRE procurar arquivo fonte de dados ANTES de aplicar migration**
3. **SEMPRE verificar se migration contém comandos destrutivos:** `TRUNCATE`, `DELETE`, `UPDATE` com valores default
4. **SEMPRE fazer backup antes de aplicar migration em produção:** `pg_dump -U admin -d mesas_rpg -t <tabela> > backup_<tabela>_$(date +%Y%m%d_%H%M%S).sql`
5. **Documentar localização de arquivos fonte e scripts de importação em `ARQUITETURA_PROJETO.md`**

**Comandos destrutivos comuns em migrations:**
- `TRUNCATE TABLE systems CASCADE;` ← **CRÍTICO: apaga todos os dados**
- `UPDATE systems SET field = 'default' WHERE field IS NULL;` ← **pode sobrescrever dados válidos**
- `DELETE FROM systems WHERE condition;` ← **pode apagar dados importantes**

**Checklist obrigatória antes de aplicar migration:**
- [ ] Li o conteúdo completo da migration
- [ ] Verifiquei se há comandos `TRUNCATE`, `DELETE` ou `UPDATE`
- [ ] Procurei arquivo fonte de dados (`.json`, `.csv`, `.sql`)
- [ ] Procurei script de importação (`.ts`, `.js`, `.py`)
- [ ] Fiz backup da tabela afetada
- [ ] Testei em ambiente local primeiro

**Data:** 09/04/2026

---

## E148 - Build TypeScript falha apos docker compose down deixando beta offline

**Sintoma:**
Ambiente beta (mesasbeta.artificiorpg.com) fica completamente offline apos push para `dev`. Containers `mesas-beta-frontend`, `mesas-beta-api` e `mesas-beta-db` nao existem mais. Volumes de dados preservados.

**Causa raiz confirmada (14/04/2026):**
Workflow `deploy-beta.yml` executava `docker compose down --remove-orphans` ANTES do `docker compose build`. Se o build falhar por qualquer motivo (erros TypeScript, dependencia ausente, etc.), os containers ja foram derrubados e nao ha rollback automatico.

**Erros TypeScript que causaram o incidente (commit 4442a3d):**
- `SessionRepeater.tsx`: `FREQUENCIES` declarado mas nunca usado (TS6133); bloco duplicado referenciando `DAYS` inexistente (TS2304)
- `SystemTreeSelector.tsx`: `getDisplayName()` recebia `SystemTreeNode` mas esperava `FlattenedSystemNode` (TS2345, 4 ocorrencias); `selectedVariantId` nao declarado (TS2304)
- `StepFinal.tsx`: `selectedScenarioName` declarado duas vezes na interface (TS2300)
- `StepReview.tsx`, `CreateTableForm.tsx`, `useCreateTableForm.ts`: `frequency` e `slots_per_session` referenciados em `SessionSchedule` mas nao existem no tipo (TS2339, TS2353)

**Diagnostico:**
1. `gh run list --repo FarenRavirar/mesas_rpg_artificio --branch dev --limit 3 --json status,conclusion,databaseId,displayTitle`
2. Identificar run com `conclusion: "failure"`
3. `gh run view <id> --log-failed` - procurar por `error TS` no output
4. `docker ps` na VM confirma ausencia dos containers beta

**Solucao validada (14/04/2026):**
1. Corrigir todos os erros TypeScript no codigo local
2. Validar localmente: `npx tsc --noEmit` no diretorio `frontend/` deve retornar sem erros
3. Push para `dev` - novo deploy sobe o beta automaticamente

**Prevencao aplicada no workflow (commit 62f67db):**
1. Step `TypeScript check (frontend)` adicionado no runner do GitHub Actions ANTES do step SSH. Se `npx tsc --noEmit` falhar, o deploy nem chega a VM e o beta permanece no ar
2. `trap rollback ERR` no script SSH: se o build falhar apos o `down`, tenta resubir os containers automaticamente
3. Lock timeout reduzido de 600s para 120s

**Recuperacao manual (se necessario):**
```powershell
ssh -F C:\projetos\config faren "cd /opt/mesas-beta && docker compose -f docker-compose.beta.yml up -d --force-recreate"
```

**Data:** 14/04/2026

---

## E149 - Deploy de producao bloqueado por variaveis Cloudinary ausentes no .env

**Sintoma:**
Workflow `Deploy Production` falha no step SSH antes de executar o gate de migrations. O run termina com erro de variavel obrigatoria ausente.

**Causa raiz confirmada (15/04/2026):**
O arquivo `/opt/mesas/.env` em producao nao possui `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET`. O workflow `deploy-prod.yml` valida essas chaves no inicio e aborta quando estao ausentes.

**Diagnostico:**
1. Run de producao apos merge do PR #56: `24430796276` (status `failure`)
2. Log do run contem: `ERRO: Variavel obrigatoria ausente no .env: VITE_CLOUDINARY_CLOUD_NAME`
3. Verificacao remota confirmou ausencia no `.env`:
   - `VITE_CLOUDINARY_CLOUD_NAME=missing`
   - `VITE_CLOUDINARY_UPLOAD_PRESET=missing`

**Solucao validada:**
1. Inserir as duas variaveis no `/opt/mesas/.env` com valores corretos de producao
2. Disparar novo deploy de producao
3. Confirmar no log do run a execucao de `apply_required_migrations.sh` e a linha `[migrations] schema em conformidade para runtime.`

**Prevenção obrigatoria:**
1. Antes de merge `dev -> main`, validar obrigatoriamente no servidor de producao a presenca de todas as env vars exigidas por `deploy-prod.yml`
2. Manter checklist de preflight de envs sensiveis (Cloudinary, OAuth, JWT) como gate previo ao merge
3. Se o deploy falhar antes do gate de migrations, bloquear avanco do Passo 3 ate rerun bem-sucedido com evidencias de log

**Data:** 15/04/2026

---

## Incidente E148 — Frontend de produção exibe "Backend não disponível" (VITE_API_URL apontando para beta)

**ID:** E148

**Sintoma:** Ao acessar `https://mesas.artificiorpg.com`, o frontend exibe a tela de erro "Backend não disponível — O servidor backend não está respondendo. Tente novamente em alguns instantes." mesmo com todos os containers de produção em estado `healthy`.

**Causa raiz confirmada (15/04/2026):**
O arquivo `/opt/mesas/.env` foi sincronizado a partir do beta sem ajuste da variável `VITE_API_URL`. O valor copiado era `https://mesasbeta.artificiorpg.com` (URL do beta). O frontend de produção foi buildado com esse valor via `docker-compose.prod.yml` (arg `VITE_API_URL`). O `App.tsx` faz `fetch(${VITE_API_URL}/health)` no startup — como a URL apontava para o beta, o healthcheck do frontend de produção dependia da disponibilidade do ambiente beta. Quando o beta estava fora ou com latência, o frontend de produção exibia o erro.

**Diagnóstico rápido:**
```bash
ssh -F C:\projetos\config faren "grep 'VITE_API_URL' /opt/mesas/.env"
# Resultado incorreto: VITE_API_URL=https://mesasbeta.artificiorpg.com
# Resultado correto esperado: VITE_API_URL=https://mesas.artificiorpg.com
```

**Solução validada (15/04/2026):**
1. Corrigir `/opt/mesas/.env`:
```bash
ssh -F C:\projetos\config faren 'set -e; PROD_ENV=/opt/mesas/.env; ts=$(date +%Y%m%d_%H%M%S); cp "$PROD_ENV" "${PROD_ENV}.backup_${ts}"; grep -Ev "^VITE_API_URL=" "$PROD_ENV" > /tmp/prod_env_next; printf "VITE_API_URL=https://mesas.artificiorpg.com" >> /tmp/prod_env_next; echo >> /tmp/prod_env_next; mv /tmp/prod_env_next "$PROD_ENV"; grep "^VITE_API_URL=" "$PROD_ENV"'
```
2. Reexecutar `Deploy Production` para rebuild do frontend com a URL correta:
```bash
gh run rerun <run_id>
```
3. Validar após deploy:
```bash
ssh -F C:\projetos\config faren "docker exec mesas-app wget -qO- http://127.0.0.1:80/api/v1/health 2>&1"
# Esperado: {"status":"ok","environment":"production",...}
```

**Prevenção obrigatória:**
1. Ao sincronizar `.env` de beta para produção, NUNCA copiar `VITE_API_URL` diretamente — ajustar para o domínio de produção antes de salvar.
2. Adicionar ao checklist de preflight de produção: verificar que `VITE_API_URL` em `/opt/mesas/.env` aponta para `https://mesas.artificiorpg.com` e não para `mesasbeta`.
3. Considerar separar variáveis de ambiente por ambiente em arquivos distintos (`.env.prod`, `.env.beta`) para evitar cópia acidental.

**Data:** 15/04/2026

---

## E150 - Rotas críticas falham após deploy com frontend healthy (stale upstream no Nginx)

**Sintoma:**
Após deploy/restart de containers, as rotas `GET /api/v1/tables`, `GET /api/v1/systems?view=tree` e `GET /auth/google` passam a falhar (tipicamente `502`) mesmo com containers `mesas-api` e frontend em estado `healthy`.

**Causa raiz confirmada (16/04/2026):**
O Nginx no frontend manteve resolução de upstream antiga para o container de API após troca de IP interno no Docker network. Com isso, o proxy continuou tentando encaminhar para IP inválido, afetando principalmente as rotas de listagem de mesas, árvore de sistemas e redirecionamento OAuth.

**Diagnóstico rápido:**
1. Validar rotas críticas:
```bash
curl -s -o /dev/null -w "%{http_code}" "https://mesasbeta.artificiorpg.com/api/v1/tables?limit=1"
curl -s -o /dev/null -w "%{http_code}" "https://mesasbeta.artificiorpg.com/api/v1/systems?view=tree"
curl -s -D /tmp/beta_oauth.headers -o /dev/null -w "%{http_code}" "https://mesasbeta.artificiorpg.com/auth/google?frontend_redirect=https%3A%2F%2Fmesasbeta.artificiorpg.com"
grep -i '^location: https://accounts.google.com/o/oauth2/v2/auth' /tmp/beta_oauth.headers
```
2. Confirmar frontend `healthy` mesmo com falha de rota:
```bash
docker inspect mesas-beta-frontend --format '{{.State.Health.Status}}'
```
3. Verificar logs de proxy/API para erro de upstream:
```bash
docker compose -f docker-compose.beta.yml logs --tail=120 mesas-beta-frontend mesas-beta-api
```

**Solução validada:**
1. Reiniciar somente o frontend do ambiente afetado para forçar re-resolução de upstream:
```bash
docker restart mesas-beta-frontend
# ou
docker restart mesas-app
```
2. Aguardar `Health.Status=healthy` no frontend.
3. Revalidar `tables`, `systems?view=tree` e `auth/google`.
4. Se falhar novamente, marcar deploy como falho e coletar logs de frontend/API.

**Prevenção obrigatória:**
1. Workflows `deploy-beta.yml`, `deploy-prod.yml` e `promote-to-prod.yml` devem validar rotas críticas (`/api/v1/tables?limit=1`, `/api/v1/systems?view=tree` e `/auth/google?frontend_redirect=...`) após health dos containers.
2. Em falha dessas rotas com containers healthy, executar auto-recuperação controlada (`docker restart` do frontend), aguardar health e revalidar uma única vez.
3. Persistindo falha após segunda validação, abortar deploy e manter evidências em log.
4. Checklist operacional deve conter gate explícito dessas validações (PRE_DEPLOY_CHECKLIST.md e OPERACAO_PRODUCAO.md).

**Data:** 16/04/2026

---

## E151 - DRIFT ERROR: banco possui migration não encontrada no disco (drift I2)

**Sintoma:**
Deploy falha com mensagem `DRIFT ERROR: Banco possui migration não encontrada no disco: migration_XX_nome.sql`. O gate de migrations detecta que a tabela `schema_migrations` possui entrada que não existe no diretório `database/`.

**Causa raiz confirmada (21/04/2026):**
Migration foi aplicada manualmente via SSH no banco de produção/beta para corrigir incidente urgente, mas o arquivo `.sql` não foi commitado no repositório. O gate detecta drift I2 (hotfix manual sem reconciliação) e bloqueia deploy para evitar inconsistência entre código e schema.

**Diagnóstico:**
```bash
# Listar migrations pendentes e índice transacional (Beta)
ssh -F C:\projetos\config faren "cd /opt/mesas-beta && bash scripts/deploy/reconcile_migrations.sh --list docker-compose.beta.yml mesas-beta-db"

# Listar migrations pendentes e índice transacional (Produção)
ssh -F C:\projetos\config faren "cd /opt/mesas && bash scripts/deploy/reconcile_migrations.sh --list docker-compose.prod.yml mesas-db"
```

Saída esperada mostra `[DB_ONLY]` para a migration que existe no banco mas não no disco.

**Solução validada:**
1. Reconciliar manualmente sem executar novamente:
```bash
ssh -F C:\projetos\config faren "cd /opt/mesas-beta && bash scripts/deploy/reconcile_migrations.sh --mark-applied migration_XX_nome.sql docker-compose.beta.yml mesas-beta-db"
```
2. Commitar o arquivo `.sql` no repositório se ainda não foi versionado
3. Validar que drift foi resolvido executando `--list` novamente

**Prevenção obrigatória:**
1. Sempre executar `reconcile_migrations.sh --mark-applied` após qualquer intervenção manual via SSH (ver `OPERACAO_PRODUCAO.md` §11)
2. Sempre commitar o arquivo `.sql` do hotfix no repositório após aplicação manual
3. Nunca aplicar migration via SSH sem reconciliação posterior

**Data:** 21/04/2026

---

## E152 - Deploy bloqueado por migration manual-risk pendente sem autorização

**Sintoma:**
Deploy falha com mensagem `MANUAL-RISK ERROR: Existem migrations manual-risk pendentes. Deploy bloqueado sem ALLOW_MANUAL_MIGRATIONS=true.` e exit code 3. Workflow termina antes de aplicar qualquer migration.

**Causa raiz confirmada (21/04/2026):**
Migration destrutiva (`DROP TABLE`, `DELETE FROM`, `ALTER COLUMN TYPE`, `TRUNCATE`) foi commitada com header `-- @class: manual-risk`. O gate bloqueia por padrão e exige autorização explícita via `workflow_dispatch` com flag `ALLOW_MANUAL_MIGRATIONS=true`. Em produção, também exige `PROD_BACKUP_FILE` (path do dump validado) e `REQUIRE_PROD_BACKUP_FOR_MANUAL=true`.

**Diagnóstico:**
```bash
# Verificar classificação das migrations pendentes
grep -n "@class:" database/migration_*.sql

# Confirmar que migration é realmente destrutiva
cat database/migration_XX_nome.sql | grep -E "DROP|DELETE|TRUNCATE|ALTER.*TYPE"
```

**Solução validada:**

**Opção A — Autorizar via workflow_dispatch:**
```bash
# Acessar GitHub Actions → workflow "Deploy Production" (ou "Deploy Beta")
# Clicar em "Run workflow" e preencher inputs:
# - ALLOW_MANUAL_MIGRATIONS: true
# - PROD_BACKUP_FILE: /tmp/backup_20260421_1430_pre_deploy.sql
# - REQUIRE_PROD_BACKUP_FOR_MANUAL: true (apenas produção)
```

**Opção B — Reclassificar se marcação incorreta:**
Se a migration foi incorretamente classificada como `manual-risk`, editar header do arquivo `.sql`:
```sql
-- @class: online-safe
```
Commitar, push e redisparar deploy.

**Prevenção obrigatória:**
1. Sempre gerar backup validado ANTES de autorizar `ALLOW_MANUAL_MIGRATIONS=true` (ver `PRE_DEPLOY_CHECKLIST.md` fase 3)
2. Validar classificação de risco no PR review — se marca destrutiva está coerente com conteúdo SQL
3. Consultar `migrations_guide.md` seção "Classificação de Risco" para regras de classificação

**Data:** 21/04/2026

---

## E153 - Drift I5: migrations dessincronizadas entre dev e main

**Sintoma:**
Deploy detecta divergência entre estado esperado pela branch e estado real do banco. Mensagem de drift aponta migration presente em um ambiente e ausente no outro, ou `DRIFT ERROR` cruzado ao promover branch.

**Causa raiz confirmada (21/04/2026):**
Migration aplicada em beta mas não promovida para main, ou vice-versa. Causas comuns: merge parcial entre branches; feature mergeada em `dev` sem promoção subsequente para `main`; hotfix aplicado em `main` sem backport para `dev`.

**Diagnóstico:**
```bash
# Verificar migrations presentes em dev e ausentes em main
git log origin/main..origin/dev --oneline -- database/

# Verificar migrations presentes em main e ausentes em dev (caso oposto)
git log origin/dev..origin/main --oneline -- database/

# Listar divergência de commits
git rev-list --left-right --count origin/main...origin/dev
```

**Solução validada:**

**Caso 1 — dev possui migrations que main não tem (cenário comum):**
```bash
# Promover via PR padrão
gh pr create --base main --head dev --title "chore: sync migrations dev → main" --body "Sincronização de migrations pendentes"
```

**Caso 2 — main possui migrations que dev não tem (hotfix direto em prod):**
```bash
# Backport via cherry-pick
git checkout dev
git cherry-pick <commit-hash-da-migration>
git push origin dev
```

**Prevenção obrigatória:**
1. Sempre promover migrations via PR de `dev` para `main` — nunca aplicar diretamente em produção sem passar por beta
2. Workflow `preflight-prod.yml` detecta drift I5 antes do merge em `main` e posta relatório no PR
3. Evitar hotfix direto em `main` quando possível — preferir aplicar em beta primeiro e promover

**Data:** 21/04/2026

---

## E154 - Reconciliação inicial: "Muitas migrations pendentes (N > 5)" no primeiro deploy após feature 001

**Sintoma:**
Deploy beta/prod falha com mensagem `::error::Muitas migrations pendentes (28 > 5).` no job `migrate`. Todos os outros jobs (validate, lint, enforce-dir) passam. O erro ocorre na primeira aplicação da feature 001 em ambiente com banco pré-existente.

**Causa raiz confirmada (22/04/2026):**
Schema histórico foi aplicado antes da tabela `schema_migrations` existir. Quando a feature 001 é instalada pela primeira vez, o script `apply_required_migrations.sh` detecta todas as migrations históricas como "pendentes" porque não há registro delas na tabela de controle. O limite de segurança de 5 migrations pendentes bloqueia o deploy para evitar aplicação massiva acidental.

**Diagnóstico:**
```bash
# Listar drift (Beta)
ssh -F C:/projetos/config faren "cd /opt/mesas-beta && bash scripts/deploy/reconcile_migrations.sh --list docker-compose.beta.yml mesas-beta-db"

# Listar drift (Produção)
ssh -F C:/projetos/config faren "cd /opt/mesas && bash scripts/deploy/reconcile_migrations.sh --list docker-compose.prod.yml mesas-db"
```

Saída esperada mostra grande quantidade de `[DISK_ONLY]` (migrations no disco sem registro no banco) e 0 `[DB_ONLY]`.

**Solução validada (22/04/2026):**

**Passo 1 — Aplicar migration_114 manualmente (bootstrap da coluna `applied_by`):**
```bash
ssh -F C:/projetos/config faren "cat /opt/mesas-beta/database/migration_114_add_applied_by.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg"
```

**Passo 2 — Reconciliar migrations históricas em lote:**
```bash
# Criar lista de migrations [DISK_ONLY] (excluindo migration_114 que já foi aplicada)
# Executar loop de reconciliação via PowerShell ou script bash
```

**Passo 3 — Validar reconciliação:**
```bash
bash scripts/deploy/reconcile_migrations.sh --list docker-compose.beta.yml mesas-beta-db
```
Esperado: 0 `[DISK_ONLY]`, 0 `[DB_ONLY]`.

**Passo 4 — Disparar deploy normalmente.**

**Prevenção obrigatória:**
1. Próximos ambientes (prod) devem ser reconciliados **antes** de tentar deploy, não depois
2. Documentar checklist de reconciliação inicial em `BRANCH_POLICY.md` e `pr-description.md`
3. Adicionar seção "Reconciliação Inicial" no `PRE_DEPLOY_CHECKLIST.md` para ambientes novos

**Recorrente:** Sim (vai acontecer em prod na primeira instalação da feature 001)

**Data:** 22/04/2026

---

## E155 - Job smoke em deploy-beta.yml falha com "syntax error near unexpected token 'fi'"

**Sintoma:**
Deploy beta completa jobs `validate`, `lint`, `enforce-dir`, `migrate` e `deploy-app` com sucesso, mas falha no job `smoke` com erro `bash: -c: line 43: syntax error near unexpected token 'fi'`. Exit code 2. Aplicação está funcional (rotas respondendo 200), mas workflow marca deploy como falho.

**Causa raiz provisória (22/04/2026):**
Erro de sintaxe bash em heredoc/script SSH do job `smoke` no workflow `deploy-beta.yml`. Bloco `if ... fi` mal formado na linha 43 do script remoto. Não afeta funcionalidade da aplicação — todas as rotas críticas respondendo corretamente após deploy.

**Diagnóstico:**
```bash
gh run view <RUN_ID> --log-failed | grep -A 5 smoke
```

Saída mostra:
```
smoke	Smoke Tests	err: bash: -c: line 43: syntax error near unexpected token 'fi'
smoke	Smoke Tests	2026/04/22 03:35:10 Process exited with status 2
```

**Solução pendente:**
1. Investigar workflow `deploy-beta.yml` job `smoke`
2. Identificar bloco `if ... fi` mal formado (provavelmente problema de escape em heredoc ou sintaxe bash)
3. Corrigir sintaxe
4. Testar com commit vazio: `git commit --allow-empty -m "test: validar correcao smoke test"`

**Prevenção obrigatória:**
Não é recorrente (primeira ocorrência após feature 001 entrar ativa). Correção pendente sem urgência — não bloqueia operação. Job `smoke` é validação adicional; rotas críticas já são validadas em `deploy-app`.

**Recorrente:** Não

**Data:** 22/04/2026

---

## E156 - reconcile_migrations.sh --mark-applied falha com "column 'applied_by' does not exist"

**Sintoma:**
Comando `reconcile_migrations.sh --mark-applied migration_XX.sql` falha com erro PostgreSQL: `ERROR: column "applied_by" of relation "schema_migrations" does not exist`. Ocorre ao tentar reconciliar migrations em banco que ainda não tem a migration_114 aplicada.

**Causa raiz confirmada (22/04/2026):**
Migration_114 adiciona a coluna `applied_by` que o próprio script de reconciliação usa no `INSERT INTO schema_migrations`. Bootstrap requer aplicar migration_114 manualmente antes da reconciliação em lote. Sem essa coluna, o script falha ao tentar inserir registro com `applied_by`.

**Diagnóstico:**
```bash
# Verificar se coluna applied_by existe
docker exec mesas-beta-db psql -U admin -d mesas_rpg -c '\d schema_migrations'
```

Se output mostrar apenas `migration_name` e `applied_at` (sem `applied_by`), o problema está confirmado.

**Solução validada (22/04/2026):**

**Passo 1 — Aplicar migration_114 via pipe:**
```bash
cat /opt/mesas-beta/database/migration_114_add_applied_by.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
```

Esperado: `ALTER TABLE`, `DO`, `NOTICE: schema_migrations.applied_by: ok`

**Passo 2 — Executar loop de reconciliação normalmente:**
```bash
bash scripts/deploy/reconcile_migrations.sh --mark-applied migration_01_base_schema.sql docker-compose.beta.yml mesas-beta-db
# ... repetir para outras migrations
```

**Passo 3 — Marcar migration_114 também:**
```bash
bash scripts/deploy/reconcile_migrations.sh --mark-applied migration_114_add_applied_by.sql docker-compose.beta.yml mesas-beta-db
```

**Prevenção obrigatória:**
1. Em reconciliação inicial de **prod**, aplicar migration_114 primeiro antes do loop
2. Documentar isso no checklist pós-merge do `BRANCH_POLICY.md`
3. Adicionar nota no `pr-description.md` sobre ordem de bootstrap

**Recorrente:** Sim (vai acontecer de novo em prod na primeira reconciliação)

**Data:** 22/04/2026
