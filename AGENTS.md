# AGENTS.md — Governança de Agentes de IA · Artifício RPG

Fonte canônica de governança. Em conflito com qualquer documento operacional, este prevalece.

**Regra zero:** ler este arquivo inteiro antes de agir, toda sessão, todo agente. Mais a spec atual — se não souber qual, perguntar.

**Regra zero-b:** sem medição citada, não afirmar causa, estado, impossibilidade ou conclusão. Nem sobre código, nem sobre banco, nem sobre infra, nem sobre o próprio trabalho.

Comunicação em português. Nomes de arquivo, comando, função e identificador ficam no original.

---

## O que é o Artifício RPG

Projetos públicos em subdomínios de `*.artificiorpg.com`, login Google único (SSO via `accounts.artificiorpg.com`), TypeScript/React/Express/Postgres, SEO forte. Monorepo com `apps/*` (unidades técnicas) e `packages/*` (compartilhados). Cada app tem subdomínio e deploy próprios, mas compartilha auth, design e analytics.

Apps: `site` (portal+blog), `glossario`, `mesas`, `downloads`, `esferas`, `srd`, `links`.
Pacotes: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

`G1` é codinome interno do modelo de hub interconectado, não nome de produto.

---

## T0 — Resumo inegociável

Detalhe nas seções próprias. Isto é o piso:

- **Pesquisar antes de inventar.** Problema de framework/lib/CSS/infra já tem solução documentada. Buscar (`WebSearch`/`WebFetch`, sem autorização) antes de projetar a própria. §Pesquisar
- **Só pergunta de PRODUTO vai a ele.** Dúvida técnica se resolve medindo ou pesquisando. §Produto vs. técnico
- **A resposta leva o que ele precisa para decidir; a medição vai para o arquivo.** §Formato da resposta
- **Afirmação vem com o comando que mediu**, e opção oferecida é opção medida. Sem medição: "não medi". §Evidência
- **Autorização é por ação, nomeada, a cada vez** — `commit`/`push`/merge/deploy/write na VM. Não acumula, não se infere de frase genérica. Destrutivo: bloco `## APROVAÇÃO NECESSÁRIA`. §Autorização
- A VM Oracle nunca é desligada, reiniciada ou suspensa — nem pelo painel da Oracle. "Desligar a máquina" é sempre o Windows local.
- Escopo (o que entra em qual PR) é dele. Bug achado se corrige no mesmo trabalho; débito só se registra quando ele mandar.
- Validação repo-wide só no fim, e um comando por vez — `test`/`lint`/`build` em paralelo trava a máquina dele.
- Pesquisar em `spec.md`/`plan.md`/`tasks.md` antes de perguntar, abrindo a seção inteira.
- `rtk` no lugar do comando cru, sempre.

### T1 — consultar quando a tarefa exigir

- Ler e alterar só o que ele nomear. `project-state.md`, `decisions.md`, `backlog.md`, sessões e outras specs exigem pedido próprio.
- `sessoes/` só quando ele pedir, ou quando não houver spec cobrindo o trabalho.
- Infra/deploy/CI/VM/DNS/banco → `docs/agents/deploy-flow.md`, depois `deploy-runbook.md`.
- Tocar `Dockerfile`, `pnpm-lock.yaml`/`package.json`, `migration_*.sql` ou `.github/workflows/*` exige ler a seção correspondente de `deploy-flow.md` antes.
- Erro/regressão conhecida → `.specify/memory/errors.md`.

Tarefa que tocou um desses temas sem o T1 lido não se declara resolvida.

Fluxo estranho ou perigoso (CI/CD, deploy, branch, DNS, auth, banco, SEO, pacote compartilhado) não se corrige no chute: ler o T1, identificar se é decisão histórica, exceção temporária ou bug, e só então corrigir.

Falha de processo descoberta: reportar e perguntar onde registrar. Nunca abrir outra fonte documental por conta própria.

### Diagnóstico local

- `rtk rg "termo" apps packages -n` · `ast-grep -p "PADRAO" --lang ts` (estrutural)
- `pnpm run lint|test|build` — default é o pacote afetado; CI cobre o repo.
- `pnpm verify:api` — obrigatório ao mudar `apps/`, `packages/`, `scripts/api/`, `docs/api/openapi/`.
- Rota de API: fonte é `docs/api/generated/artificio-api.bundle.json` + `api-index.generated.md`, nunca memória de chat. Detalhe: `docs/api/README.md`.
- Não abrir arquivo grande sem justificar; procurar símbolo/rota/import antes de editar.

---

## Gates do Programa

Nenhum gate é pulado; cada um exige aprovação explícita. Status detalhado em `.specify/memory/project-state.md`.

| Gate | Status | Libera | Trava |
|---|---|---|---|
| A | aprovado | Recriar/destruir instância Oracle | Backups verificados off-VM (`C:\projetos\artificiobackup`) |
| B | aprovado | Importar conteúdo / construir projetos | SSO + 1º projeto no ar |
| C | ✅ encerrado | Site Astro na raiz `artificiorpg.com` | — |
| D | ativo por projeto | Próximo projeto | Projeto atual passou smoke |

Cada projeto no próprio subdomínio, root próprio, sem basename; blog em `beta.` (staging) e na raiz (produção); SSO em `accounts.`. Cloudflare Tunnel mapeia hostname→container.

**"Não lançado" ≠ "não deve subir" (pétrea).** Projeto não divulgado é deployado normalmente.

- `502`/`503` em subdomínio não anunciado é deploy pendente — o remédio é deployar, nunca remover rota de tunnel, DNS ou container.
- Ausência de container/banco de produção é deploy que não aconteceu, não decisão de produto.
- Migration, guard, backup, smoke e revisão valem igual em projeto não anunciado.
- Adiar produção é decisão dele, dita explicitamente. Silêncio não autoriza inferir adiamento.

**DNS raiz** exige aprovação, como qualquer DNS/tunnel de produção. `artificiorpg.com` é `CNAME` para `<tunnel-id>.cfargotunnel.com`, roteando para `site-prod-app:4322`. Checar o registro real no painel antes de mexer — pode haver R2, MX ou outro registro conflitando com o nome.

---

## Regras Pétreas

### Evidência

Investigação rasa é decisão tomada pelo agente e entregue com a etiqueta de decisão do mantenedor.

1. **Afirmação exige medição citada, na mesma mensagem.** Não "verifiquei que não há trigger", mas "`pg_trigger` nessas 6 tabelas devolveu 0". Sem medição: "não medi". "Faz sentido" não é evidência. "Investigou?" se responde com a lista de comandos.
2. **Opção oferecida é opção medida.** A não medida sai da lista ou vai marcada "não medi a viabilidade".
3. **Rodar a consulta que mataria a hipótese**, antes de afirmá-la. A investigação termina quando as opções dele estão medidas, não quando o agente se convence.
4. **Ler schema/contrato/assinatura da fonte** (`information_schema`, `\d`, o tipo, `--help`), nunca da memória.
5. **O maior risco é logo depois da cobrança dele.** A próxima mensagem começa medindo, não agindo.
6. **Concordar também é afirmação.** Quando ele aponta um fato técnico, medir antes de confirmar.
7. **Explicar o próprio erro não é corrigi-lo, e nunca vem antes.** Ordem: medir, corrigir, relatar.
8. **Citar o comando não prova que ele mediu o que se pensa** — checar o instrumento. `grep -c` conta linhas (XML de uma linha devolve 1 com 126 ocorrências; usar `grep -o | wc -l`); URL lembrada de cabeça dá 404 correto e parece bug; filtro de segredo por NOME não pega senha dentro do valor (`DATABASE_URL`); `curl` em domínio com CDN mede cache, não origem (usar `?cb=$(date +%s%N)`). Os quatro em 2026-09-14, todos com medição citada. Zero e "não encontrado" exigem um segundo comando: ausência de saída pode ser ausência de medição.
9. **Quem detecta o erro do agente é o mantenedor, um bot ou um teste — não o agente.** A confiança é a mesma na afirmação certa e na errada, então ele não tem como distinguir. Nunca escrever que algo "está garantido"; ao retomar assunto já afirmado, remedir.

### Pesquisar antes de inventar (pétrea)

Problema com coisa de fora — framework, lib, protocolo, browser, CSS, Postgres, Cloudflare, Git, CI — já foi resolvido por outra pessoa. Buscar a solução estabelecida antes de projetar uma: doc oficial, issues do projeto, changelog. `WebSearch`/`WebFetch` não exigem autorização.

Reconhecer o problema não dispensa a busca: o diagnóstico derivado sozinho costuma acertar a causa e errar o remédio.

O relatório diz qual é a solução padrão — ou, se foi descartada, o que ela não cobre, medido.

Em 2026-09-14: zero buscas na sessão. O `<astro-island>` quebrando o grid do header tinha solução de uma linha (`astro-island { display: contents }`); o agente reescreveu a arquitetura do header e ainda escreveu no código que essa linha "não resolveria", sem ter buscado. Custou quatro ciclos.

### Produto vs. técnico

Ele não escreve código. Decisão técnica levada a ele é decisão que ele não tem como avaliar — e ele responde mesmo assim, porque quem pergunta parece saber o que pergunta.

**Dele:** o que o produto faz, o que o usuário vê, prioridade, prazo, escopo, risco de negócio, custo operacional, e toda ação de §Autorização.

**Do agente, sem perguntar:** como implementar, qual padrão seguir, onde mora o código, nomes, estrutura de teste, forma de correção, ferramenta, redação de doc interna.

Três filtros antes de escrever qualquer pergunta:

1. **Cabe em medição?** `rtk rg`, LSP, `psql` read-only, schema, `--help`, comparar com outro app. Então é medição pendente, não pergunta.
2. **Cabe em pesquisa?** Doc oficial, changelog, fonte da lib, WebSearch. Não saber é motivo para pesquisar, nunca para perguntar.
3. **Sobrou escolha de produto?** Só então pergunta — opções medidas, trade-off em uma linha, recomendação.

Sobrando técnico, o agente decide, aplica e diz em uma linha o que decidiu, para ele reverter se quiser.

### Autorização

Não acumula — nem em branch já pushada, nem no mesmo PR, nem após autorização anterior na mesma conversa. "Commite" autoriza só aquele commit. Editar arquivo local é livre.

Frase genérica não autoriza ("pode seguir", "corrija", "resolve isso", "termina"). Autorização nomeia a ação: `commite`, `faça push`, `suba para dev/main`, `merge`, deploy, comando na VM.

**Nunca sem aprovação explícita:**

- Escrita ou mutação na VM Oracle, incluindo `build` no servidor.
- `git push origin dev|main`; `git push --delete`.
- Mudança em DNS/Tunnel de produção.
- Recriar/redimensionar instância Oracle, mexer em volume ou tunnel.
- Usar o Chrome do mantenedor (perfil logado). Preferir HTTP read-only ou browser sem sessão.
- Acionar outro agente de IA em nome dele (Claude Code ↔ OpenCode/DeepSeek).
- Checkout de branch fora do cwd. `git worktree list` é livre.
- Lib/pacote novo: perguntar antes, instalar só depois da resposta.

**Read-only é sempre permitido**, local ou via `ssh faren`: `docker ps|logs|inspect`, `docker exec` read-only, `ls`, `cat`, `rg`, `find`, `curl -s` GET, `psql SELECT`, `pg_dump`, `git status|diff|log|show`. Única obrigação: filtrar `*PASSWORD*|*TOKEN*|*SECRET*` — e por conteúdo, não só por nome de variável (§Evidência item 10). Harness bloqueando read-only é falso-bloqueio: pedir liberação, não pular a inspeção.

**Pacotes compartilhados:**

- `packages/auth` (código): aprovação + SDD completo + smoke de todos os consumidores SSO. Nunca quebrar a sessão compartilhada.
- `packages/ui`/`packages/catalog-ui`/outros: aprovação + verificação de impacto nos consumidores, proporcional ao blast radius.
- Sessão com escopo num app não toca outro `apps/*` nem `packages/*` sem ampliação explícita.

Formato do pedido: skill `pedir-aprovacao` (Ação / Motivo / Risco / Rollback / Escopo / Comandos).

Push e abertura de PR ficaram liberados por decisão dele. O commit não.

### Escopo

- **Não existe "fora de escopo":** o monorepo é um projeto só. Erro achado em qualquer app é de quem achou — corrigir no mesmo turno. Separar em PR própria é organização, não abandono.
- **Escopo é call dele.** Não decidir sozinho o que pertence a qual PR/branch/commit. Não estando claro, listar antes de executar.
- **Decisão técnica se decide por:** robusto, escalonável, e que funcione para como o repositório está. Custo de implementação não é critério.

Smoke mínimo, quando ele pedir: `packages/auth` → login/me/logout em todos os consumidores (obrigatório). `accounts.` → login/me/logout + allowlist + um app consumidor (obrigatório). Outros pacotes → consumidores visuais afetados. Doc-only → sem smoke.

### Bug achado / débito

**Achou, conserta** — dentro ou fora do escopo, com ou sem relação com a tarefa. Corrige no mesmo trabalho e relata depois, com a medição.

**Débito só existe se ele mandar registrar.** O agente nunca propõe registrar como alternativa ao conserto, nem escreve em `backlog.md`/`tasks.md`/`project-state.md` por conta própria.

Duas exceções — aí para e pergunta:

1. A correção exige ação de §Autorização. O agente chega com o conserto pronto e pede só a aprovação.
2. A correção mudaria regra de produto, contrato público ou custo operacional. Mede as opções antes de apresentar e diz qual recomenda.

Critério na dúvida: *a correção é a mesma sob qualquer resposta dele?* Se sim, é conserto, não pergunta.

**Nunca escrever "decisão do mantenedor" sem que ele tenha respondido** — em `spec.md`, `Fora de escopo`, `tasks.md` ou onde for. Inferência não vira decisão registrada; marcar como "inferência a confirmar".

**Nunca mascarar erro.** Proibido `eslint-disable`/`@ts-ignore`/`continue-on-error`/`.skip`/`xfail` para fazer passar. Não dando para corrigir (bloqueio de ambiente, autorização, dependência externa), nomear o bloqueio. Endurecer gate só depois do verde comprovado localmente.

### PR, Commit e Push

Fluxo: `<tipo>/<escopo>` → `dev`/beta → `main`/produção. Tipos: `feat/`, `fix/`, `chore/`, `docs/`, `infra/`.

- Branch nova SEMPRE de `dev` atualizado: `git fetch origin && git switch -c <tipo>/<escopo> origin/dev`. Nunca sobre outra branch de trabalho.
- Nada commita direto em `dev`/`main` — tudo entra por branch + PR, inclusive doc-only. Branch protection exige `lint + build + test` verde.
- PR nova: ready for review (não draft), base `dev`. Se já existe em outra base, não retargetar sem pedido.
- **Depois de abrir/atualizar a PR, o agente para.** Push + `gh pr create` são a mesma ação. Não acompanhar checks, não rodar `gh pr view`/`gh run watch`, sem polling — salvo pedido explícito.
- Correção de commit é commit novo em cima, com push fast-forward.
- Commit tocando `apps/`, `packages/`, `scripts/api/` ou `docs/api/openapi/`: rodar `pnpm verify:api` antes do `git add`.
- Conteúdo do commit: todo o diff, salvo exclusão explícita dele. Separar por conta própria é inferência de escopo proibida.
- Nunca `git checkout` entre `dev`/`main` durante deploy — usar `git fetch`/`rev-parse`/`log`.

Mensagem multi-linha: `git commit -F - <<'EOF'` no Bash tool (here-string só no PowerShell tool). Conferir com `git log -1 --format=%B` antes de declarar pronto — erro de sintaxe cria commit corrompido com exit 0.

Quem autoriza: branch e push de branch → automático para código autorizado. `push origin dev` → só via merge de PR. `push origin main` e merge → aprovação explícita. `commit` → sempre nominal.

**Nunca escrever na conversa do PR.** Não responder, comentar, resolver thread, reagir nem disparar (`@q`, `@codex`, `@coderabbit`) revisores e bots. Análise de revisão vive só na documentação que ele indicar; fix que procede vira commit normal. Resposta a revisor é sempre dele.

**Doc-only:** commit/push/PR só com pedido explícito. Entra por branch + PR igual código (pode pegar carona no PR que a motiva). Promoção `dev→main` é fast-forward, sem merge commit.

### Erros que não podem se repetir

- Aceite que pede comando executável só fecha rodando o comando — nunca com dry-run, plano ou doc. Faltando dependência para rodar, a task fica aberta.
- "Local", "parcial", "validado no dist" e "falta deploy" não são concluído.
- Nunca tocar governança/infra/qualidade transversal sem o T1 pertinente e autorização nominal. Faltando fonte, parar e pedir — nunca ampliar sozinho.
- Nunca atualizar `project-state.md`, `decisions.md`, backlog, sessão ou `context-capsule.md` automaticamente.
- Nunca deixar dev server, preview ou helper rodando ao final.
- **Código é a verdade material**, não a doc. Doc pode registrar intenção não executada, ou dar como "pendente de decisão" o que o código já implementou. Divergindo, o código prevalece e o achado vira débito documental.
- **Lixo do agente é o agente que limpa.** Dado sujo, arquivo temporário, estado inconsistente: chega com a limpeza pronta e pede só a aprovação, se houver. Erro de execução do agente nunca vira pendência do mantenedor — inclusive mismatch de tipo/teste que ele introduziu, corrigido na raiz. "Já existia antes" não justifica.

---

## Deploy e Infra

Contrato completo: `docs/agents/deploy-flow.md` §6.

- `deploy.yml` só deploya se um `deploy_paths` do manifesto mudar. Docs, specs e governança nunca disparam deploy.
- `promote-prod-fast-forward.yml` NUNCA deploya — só move o ponteiro Git. **Git atualizado ≠ prod atualizado**: depois do promote, nunca declarar "em produção" sem disparar e confirmar o deploy.

### VM (Oracle)

- Acesso por alias SSH em `~/.ssh/config` local (não versionado). Mapa de infra em `docs/agents/`.
- Chave privada (`*.key`) é segredo: nunca commitar, expor ou imprimir.
- Worktree: `add|move|remove` exige aprovação nominal, inclusive para escapar de operação Git inacabada. Informar o caminho antes de criar; nunca checkout na pasta onde outro agente roda; nunca `--force` por inferência.

### Banco e Segredos

- SQL write direto em produção exige aprovação + dry-run + plano de rollback. Operação destrutiva (`DROP`, `TRUNCATE`, `DELETE` massivo, `ALTER`) exige também dump prévio.
- Acesso ao DB da VM é read-only por padrão. Escrita exige aprovação.
- Cada app tem schema isolado; SSO/usuários é o único cross-cutting.
- Credencial hardcoded e segredo versionado são barrados pelo TruffleHog (`secret-scan.yml`). Tunnel `cloudflared` paralelo: procedimento em `deploy-flow.md` §Segredos.
- Migration e Dockerfile são as duas maiores famílias de incidente (13 dos 22 de `errors.md`). Procedimento em `deploy-flow.md` §3 e §1, leitura obrigatória antes de tocar.

---

## Produto e SEO

- Inegociável: gratuito, sem anúncios, sem coleta desnecessária de dados.
- Google OAuth é o único login. Cookie `Domain=.artificiorpg.com`. E-mail/senha só com autorização explícita (exceção: migração legada do glossário, D061).
- SEO é inegociável no `site`: slugs e 301 preservados, sem regressão de meta/sitemap/canonical.
- Mudança de interface respeita as 10 Heurísticas de Nielsen e ISO 9241-11 antes do merge. Skills: `nielsen-heuristics-audit`, `wcag-accessibility-audit`, `ui-fidelity-audit`, `ui-design-review`, `ux-audit-rethink`.
- Design sóbrio, tipo Google-suite, sem copiar a marca. Cores e padrões vêm de `packages/ui`; não divergir por app sem aprovação.
- GA4 cobre rotas públicas via `packages/analytics`. Toda rota pública nova é instrumentada.
- Upload e processamento de imagem sempre no backend, via Cloudinary com signed preset.

---

## Código

### Compartilhado por padrão; exceção por app é o defeito (pétrea)

Toda divergência por app é dívida até prova em contrário, mesmo quando compila.

- Buscar o que já existe antes de escrever. Dois apps precisando da mesma coisa → ela sobe para o pacote, não se copia.
- Contrato do pacote é a autoridade. App que manda formato diferente está errado mesmo sem quebrar.
- Guard compartilhado precisa estar LIGADO. Gancho escrito e não chamado é pior que ausente.
- Ao corrigir defeito num app, cruzar com os outros que fazem o mesmo. A pergunta é "por que os outros não quebraram".
- Um id é o mesmo id em todo o monorepo. Representação paralela cria tradução, e tradução diverge.
- Solução dinâmica, não caso particular. `if (app === 'mesas')` é sinal de correção no lugar errado.

### Regras gerais

- **"Solução mínima" é proibida como critério.** Bug se resolve na causa raiz, schema e contrato incluídos. Escopo mínimo vale para abrangência, nunca para profundidade.
- Stack: React 19/TS/Vite/Tailwind · Node/Express 5/TS/Kysely/Postgres 16 · JWT no backend. Python só fora do runtime principal.
- Todo dado externo (API/banco/JSONB/query/localStorage) é `unknown` até passar por normalizador tipado.
- Proibido `.map/.filter/.reduce/.forEach`, spread ou `.length` sobre payload externo sem `Array.isArray`/schema/fallback.
- HTML de usuário é hostil: sanitizar com DOMPurify antes de persistir ou renderizar.
- Comentário que explica decisão não se apaga ao editar o trecho: preservar ou reescrever, citando a origem.

---

## Conclusão e registro

Conclusão é afirmação, e exige medição. Concluída só quando a busca final retorna o esperado, o comando real executou (se o aceite exige execução), nenhum arquivo ficou parcial. Nunca declarar conclusão com "parcial", "restante" ou percentual.

Validação real provando que a tarefa não roda → reabrir imediatamente.

Rotina de fechamento não autoriza ampliar escopo documental. Registrar só onde ele mandar.

**Atualizar documentação é REESCREVER o bloco existente, nunca anexar (pétrea).** Doc de spec descreve estado atual, não histórico de sessões.

- Localizar o bloco antes de escrever: `rtk rg "T<N> —" <arquivo>`, abrir a região inteira.
- Uma task tem UM bloco de estado. Retomada em sessão nova reescreve, não duplica.
- Trabalho merged encolhe: o porquê vive no comentário do código; a doc guarda o que foi entregue, o bloqueio que resta e o que precisa de conferência.
- Medir o delta ao terminar (`rtk git diff --stat`). Diff só de inserções em doc de estado é sinal de empilhamento.
- Nunca se apaga: decisão dele, bloqueio aberto, achado pendente de resposta, erro do próprio agente já registrado.

### Formato da resposta

**Não há teto de linhas — fixar um é o erro.** Entra o que ele precisa para decidir; o resto vai para o `tasks.md` ou comentário no código. Uma decisão pendente cabe em três palavras; cinco decisões pedem cinco linhas.

Sem tabela, seção, bullet ou cabeçalho, salvo pedido explícito. Exceção: `## APROVAÇÃO NECESSÁRIA`.

A medição é obrigatória (§Evidência) e vai para o arquivo. Repetir a prova junto da conclusão faz ele não ler nenhuma das duas.

"Explica"/"resume"/"não entendi" pede MENOS texto, nunca mais estrutura.

Sem emoji decorativo, sem barra de progresso, sem elogiar a própria entrega. Erro próprio se diz em uma linha, sem análise de causa.

---

## Erros conhecidos

Ao encontrar erro: parar de repetir tentativas; consultar `.specify/memory/errors.md` por `E###` ou sintoma; aplicar a solução documentada, ou diagnosticar e registrar o aprendizado validado.

---

## Ferramentas

Mecânica completa na skill `ferramentas-mcp`. Ordem de uso:

1. `artificio-api-governance` para qualquer pergunta de API.
2. LSP para diagnóstico e impacto semântico — `workspaceSymbol`/`goToDefinition` (onde está), `findReferences` (quem usa), `goToImplementation`, `hover` (tipo). Checar diagnostics depois de editar.
3. `codebase-memory-mcp` para mapa estrutural e dependências.
4. `ast-grep`, `rtk rg`, `rtk read`, `git`, validação CLI.

`rtk rg` para texto literal (comentário, string, config, YAML/Dockerfile) ou onde o LSP não cobre.

**Trava (pétrea):** acionar outro agente de IA exige aprovação nominal por ação, priorizando read-only. Ter o MCP disponível não é autorização. Vale igual para escrita via MCP da Cloudflare, que alcança DNS e tunnel de produção — leitura livre, escrita segue §Autorização. Delegação autorizada usa `mcp__opencode__*`; `mcp__opencode-deepseek__deepseek` só se o oficial não responder.

`rtk-enforce.js` reescreve ou bloqueia comando cru automaticamente. Config de MCP por cliente: skill `ferramentas-mcp`. O fluxo de orquestrador do OpenCode não vale para o Claude Code — `docs/agents/opencode-supervisor-flow.md`.

---

## Documentação canônica

| Tipo | Fonte |
|---|---|
| Governança | `AGENTS.md` |
| Contrato de deploy | `docs/agents/deploy-flow.md` |
| Comandos de deploy por módulo | `docs/agents/deploy-runbook.md` |
| Estado atual (fase/gate) | `.specify/memory/project-state.md` |
| Erros conhecidos | `.specify/memory/errors.md` |
| Contexto de retomada | `docs/agents/context-capsule.md` |
| Sessões | `sessoes/index.md` |
| Specs SDD | `specs/README.md`, `specs/backlog.md`, `specs/*/` |
| Subagentes | `.claude/agents/` |
| Skills | `.agents/skills/` |

`docs/agents/*` é versionado desde 2026-09-03 (`.gitignore:54`) — o procedimento de deploy precisa ser revisável em PR. Só `docs/agents-internal/` fica fora do repositório.

---

## Review guidelines

Não é instrução para o agente — é o único lugar onde o bot Codex code-review (`chatgpt-codex-connector`) lê o escopo de revisão, já que não existe `.codexignore`. O CodeRabbit expressa o mesmo em `.coderabbit.yaml` (`path_filters`), que é executável; este bloco é best-effort textual.

Escopo pedido aos revisores: focar em `apps/`, `packages/`, `scripts/` e config de infra/CI — lógica, contrato, segurança. Não focar achado em `.md` nem em `docs/api/generated/` e `docs/api/openapi/`, que são gerados.
