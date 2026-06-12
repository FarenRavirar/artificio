# AGENTS.md — Governança de Agentes de IA · Artifício RPG

**Projeto:** Artifício RPG — Plataforma G1 (monorepo modular)
**Fonte canônica de governança operacional.** Em conflito com qualquer documento operacional, este arquivo prevalece. Em conflito sobre arquitetura ou contratos técnicos, prevalece `.specify/arquiteture.md`.

Toda comunicação com o mantenedor é em português. Nomes de arquivos, comandos, funções e identificadores permanecem no formato original.

---

## O que é o G1

Suite modular em **subdomínios** sob `*.artificiorpg.com` (D017), login Google único (SSO via `accounts.artificiorpg.com`), leve (TypeScript/React/Express/Postgres), SEO forte. Monorepo `artificio` com `apps/*` (módulos) e `packages/*` (compartilhados). Cada módulo é plugável, no próprio subdomínio/deploy isolado, mas compartilha auth, design e analytics. Modelo Google-suite (`docs.`/`mail.`).

Módulos: `site` (portal+blog), `glossario`, `mesas`, `downloads`, `esferas` (Spheres of Power, multi-sistema), `srd` (DnD 5.2.1), `links`.
Pacotes: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

---

## Leitura Mínima de Retomada (Tier 0 — todo chat, todo agente)

Projeto longo (~3 meses, N chats, N agentes). Reload paga × centenas de sessões. Ler **só** o T0:

1. `.specify/memory/project-state.md` — onde estamos (fase/gate).
2. `docs/agents/context-capsule.md` — regras críticas + stack.
3. `.specify/memory/decisions.md` — decisões fechadas (não re-decidir = não retrabalhar).

**Não** ler `AGENTS.md` inteiro por hábito — é T1 (consulta de regra sob demanda). `arquiteture.md` só por seção. Disciplina completa em `docs/agents/token-economy.md`. Caveman default na saída.

Depois verificar `sessoes/` por sessão ativa incompleta. Se houver, continuar nela salvo pedido explícito de abrir sessão dedicada. Antes de qualquer alteração, registrar na sessão: o que vai fazer, o que falta, o que já foi feito.

**Anti-retrabalho:** se um fluxo parecer estranho, contraditório ou perigoso (CI/CD, deploy, branch, DNS/tunnel, auth, banco, SEO, importador, pacote compartilhado), **não corrigir no chute**. Primeiro pesquisar decisões, specs, sessões e docs operacionais relevantes (`decisions.md`, `project-state.md`, `errors.md`, `specs/`, `sessoes/`, `docs/agents/`). Identificar se o comportamento é decisão histórica, exceção temporária ou bug real; só então corrigir e registrar evidência.

---

## Gates do Programa (regra pétrea de sequência)

O G1 avança por gates. **Nenhum gate é pulado.** Cada gate exige aprovação explícita do mantenedor. **Gates ativos neste projeto (~3 meses): A, B, D.** Gate C = futuro, adiado (D016).

| Gate | Status | Libera | Pré-condição |
|---|---|---|---|
| **A** | ativo | Recriar/destruir instância Oracle | Backups completos, verificados e copiados off-VM (`C:\projetos\artificiobackup`) |
| **B** | ativo | Importar conteúdo / construir módulos | SSO (`accounts.`) funcionando + 1º módulo no ar em subdomínio |
| **C** | **adiado (fora de escopo)** | Apontar DNS de `artificiorpg.com` ao novo site e desligar WordPress | Site validado em beta (conteúdo + SEO + 301 + Nielsen/ISO) **e decisão explícita de cutover** |
| **D** | ativo | Próximo módulo | Módulo atual passou smoke |

**Topologia (subdomínio-por-módulo, D017/D057):** cada módulo no próprio subdomínio (`glossario.`, `mesas.`, `downloads.`, `esferas.`, `srd.`, `links.`), root próprio, sem basename. `glossariorpg.` foi alias histórico pré-monorepo e não é hostname ativo a preservar. Blog novo em `beta.artificiorpg.com` (BETA; → raiz `artificiorpg.com` no futuro, Gate C). WP fica na raiz agora. SSO central em `accounts.artificiorpg.com` (D018). Une tudo: cookie `.artificiorpg.com` + nav + design. Cloudflare Tunnel mapeia hostname→container.

**Antes do Gate A:** nada destrutivo na Oracle. Nenhum `docker stop/rm`, nenhum drop de volume, nenhuma recriação de instância.
**Sempre (Gate C adiado):** o WordPress de produção e o DNS de `artificiorpg.com` são **intocáveis** todo o projeto. WP roda em paralelo. Importador só **lê** do WP (REST API / dump), nunca escreve. Nenhum cutover de raiz sem reabrir o Gate C com aprovação explícita.

---

## Modos de Trabalho

Escolha o menor processo que controle o risco. Detalhe em `docs/agents/operating-model.md`.

| Modo | Quando | Artefatos mínimos |
|---|---|---|
| Sem SDD | pergunta, delta documental, correção pontual sem risco | sessão + evidência |
| SDD Lite | bug moderado, feature pequena, ajuste localizado em **um** módulo | mini-spec + checklist + evidência |
| SDD Completo | **obrigatório** para: qualquer mudança em `packages/*` (auth, ui, analytics, config, content, crosslink), infra (Cloudflare Tunnel/DNS), serviço `accounts.` (SSO), migration/banco, permissões, dados pessoais, upload/Cloudinary, importador WP, contrato público/API, deploy, CI/CD, SEO estrutural, ou feature/refator grande | `spec.md` + `plan.md` + `tasks.md` + validação + sessão |

Regra G1: **tudo que é compartilhado é SDD Completo.** Um módulo isolado pode ser SDD Lite; um pacote compartilhado nunca.

---

## Regras Pétreas

### Aprovação Obrigatória

Nunca executar sem aprovação explícita do mantenedor:

- Qualquer comando contra a VM Oracle: `docker restart|stop|start|rm`, `scp`, `rsync`, `docker cp`, `docker compose up|down`
- `npm`/`pnpm run build` no servidor
- `git commit`, `git push origin dev|main`, `git push --delete`
- `psql`/SQL com `INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE`
- Qualquer ação contra WordPress de produção ou DNS antes do Gate C
- Recriar/redimensionar instância Oracle, mexer em volume ou tunnel antes do Gate A
- Copiar/sobrescrever arquivos em produção
- Modificar arquivos fora do escopo solicitado, ou de outro módulo/pacote não autorizado

**Regra de obediência estrita:** se uma ação está nesta lista, o agente **não infere autorização** de frases genéricas como "pode seguir", "corrija", "resolve isso", "faz o resto", "promova" ou "termina". A autorização precisa nomear a ação perigosa ou o bloco de comandos (`commit`, `push`, `merge`, `workflow_dispatch`, comando VM, deploy etc.). Na dúvida, parar e pedir aprovação no formato abaixo.

Read-only permitido sem aprovação: `docker ps|logs|stats|inspect`, `ls`, `cat`, `grep`, `find`, `head`, `tail`, `curl -s` GET, `psql` com `SELECT`, leitura via RaiDrive.

**Pacotes apt ausentes:** se, durante uma tarefa já autorizada, faltar pacote `apt` necessário para executar/validar a operação (ex.: `git`, `jq`, `tree`, `p7zip-full`, `postgresql-client`, `curl`, `ca-certificates`), o agente pode rodar `sudo apt-get update` e `sudo apt-get install -y <pacote>` sem nova aprovação. Escopo: utilitário operacional padrão em VM Ubuntu/Debian. Proibido usar esta exceção para instalar serviço persistente novo, alterar arquitetura, mexer em WP/DNS/tunnel, instalar runtime/framework pesado não aprovado, ou executar deploy.

**Escopo da aprovação (pétrea):** aprovação vale **por ação, não por sessão**. Um "pode prosseguir" autoriza APENAS o bloco de comandos apresentado naquele momento. Não se estende a commits/pushes/deploys/correções posteriores. Editar arquivo local dentro do escopo pedido não precisa de aprovação; `git commit`, `git push`, merge, promoção, deploy e comando write na VM sempre precisam de aprovação explícita própria, a cada vez.

Formato obrigatório para pedir aprovação:

```text
## APROVAÇÃO NECESSÁRIA

Ação: [o que será feito]
Motivo: [por que]
Risco: [o que pode dar errado]
Rollback: [como desfazer]
Escopo: [qual módulo/pacote/gate]

Comandos:
1. ...

Posso prosseguir?
```

### Isolamento de Módulo (pétrea do monorepo)

- Sessão com escopo num módulo (ex: `apps/srd`) **não toca** outro `apps/*` nem `packages/*` sem aprovação explícita e ampliação de escopo.
- Mudança em `packages/auth` exige aprovação + SDD Completo + smoke de **todos** os módulos que consomem SSO. Auth é sagrado: nunca quebrar a sessão compartilhada.
- Mudança em `packages/ui` ou no serviço `accounts.` (SSO) exige verificar impacto em todos os módulos.
- Não introduzir novo framework/lib pesada num módulo sem aprovação. Stack canônica é única (ver `.specify/arquiteture.md`).

### Git, Branch e Deploy

Fluxo: `feat/NNN-nome` → `dev`/Beta → `main`/Produção. Branch nomeado por módulo: `feat/srd-001-tooltips`.

**Deploy/código canônico:** entrega normal passa por GitHub (branch/PR/checks/workflow_dispatch/Actions/secrets) e a VM faz `git fetch/reset` no clone. Acesso SSH direto à VM é exceção para bootstrap do clone, instalar utilitários operacionais, conexão, diagnóstico ou rollback aprovado — não é caminho normal de deploy/codificação. Se GitHub cobre a ação, use GitHub para rastreabilidade e branch safety.

- Criar branch `feat/*`: automático.
- `git push origin feat/*`: automático.
- Abrir PR para `dev`: automático.
- `git push origin dev`: aprovação explícita.
- `git push origin main`: aprovação explícita.
- Merge de PR: só com autorização explícita.
- **Nunca fazer `git commit`/`git push` por interpretação.** "Corrija", "documente", "ajuste", "pode seguir" ou "resolve logo" autorizam no máximo editar arquivos locais dentro do escopo. Para commitar/pushar, a mensagem precisa pedir explicitamente algo como "commite", "faça push", "suba para dev/main", "promova agora" ou aprovar um bloco de comandos que inclua essas ações.
- **Doc-only não libera commit/push automático.** `git commit`, `git push` e promoção continuam exigindo aprovação explícita por ação, mesmo quando o diff é só documentação. Quando o mantenedor pedir explicitamente para subir/promover um diff que é **somente documentação**, então a promoção `dev→main` deve ser por fast-forward (`promote-prod-fast-forward.yml` ou comando equivalente autorizado), sem merge commit/squash. Para **código**, seguir o fluxo normal: branch/PR/checks/revisão/merge autorizado; não promover código por fast-forward direto só para "resolver logo". Se o GitHub sugerir PR de `dev`, verificar `origin/main...origin/dev` e o conteúdo antes de agir.
- Nunca `git checkout` entre `dev` e `main` durante deploy. Usar `git fetch`, `git rev-parse`, `git log origin/main...origin/dev`, `gh run` e comparações sem checkout.
- **Doc-only nunca sozinho, nem em PR.** Mudança só de documentação não vai sozinha para `dev`/`main`, não abre PR e não é pushada, salvo se o mantenedor pedir explicitamente **documentar/commitar/pushar docs agora**. Push/merge em `dev` dispara workflows (e pode acionar deploy/CI beta) — desperdício e risco para delta sem código. Docs viajam junto com o próximo commit de código que as motiva, ou ficam locais acumuladas. Exceção única: correção documental urgente aprovada explicitamente pelo mantenedor; nesse caso registrar na sessão "doc-only autorizado".

### Acesso à VM (Oracle)

- Acesso direto por alias SSH: **`ssh faren`** (host/IP/chave em `~/.ssh/config` local, **não versionado**). Aliases equivalentes: `oracle`, `ubuntu`, IP. VM = Oracle ARM `aarch64`, Ubuntu 24.04. Mapa: `docs/agents/infra-map.md`.
- **Read-only sem aprovação:** `ssh faren '<cmd read-only>'` com `docker ps|logs|inspect|stats`, `df`, `ls/cat/grep`, `psql ... SELECT`, `pg_dump` (read-only no DB). Filtrar segredos da saída (nunca imprimir `*PASSWORD*|*TOKEN*|*SECRET*`).
- **Aprovação obrigatória (pétrea):** qualquer write na VM — `docker stop|rm|up|restart`, escrever/copiar arquivo, migration, `scp/rsync`, subir/derrubar serviço, mexer no tunnel.
- A chave privada (`*.key`) é segredo: gitignored, nunca commitar/expor/imprimir.

### Banco, Infra e Segredos

- Nunca migration com `TRUNCATE|DROP|DELETE|ALTER` em produção sem dump prévio e checklist.
- Cada módulo tem seu schema/banco lógico isolado; SSO/usuários é o único cross-cutting. Documentar em `.specify/arquiteture.md`.
- Nunca criar tunnel/container `cloudflared` paralelo.
- Nunca registrar, expor ou versionar token, PAT, segredo ou credencial. Segredos vivem em `.env` (gitignored) e nos secrets do Actions/Cloudflare.
- Acesso DB "local" via RaiDrive é **read-only por padrão**. Escrita no banco da VM = aprovação.

---

## Regras de Produto e SEO

- Compromissos inegociáveis: gratuidade, sem anúncios, sem coleta desnecessária de dados.
- **Google OAuth é o único login.** Sessão única em cookie `Domain=.artificiorpg.com`. E-mail/senha só com autorização explícita.
- **SEO é inegociável no site:** slugs do WordPress preservados, redirects 301 preservados, sem merge que cause regressão de meta/sitemap/canonical. Validar com Search Console + Lighthouse antes de promover.
- Toda mudança de interface respeita as **10 Heurísticas de Nielsen** e **ISO 9241-11** (eficácia, eficiência, satisfação) antes do merge. Checklist na sessão.
- Design sóbrio/minimalista estilo Google (Docs/Gmail), com cores e logo do Artifício, vindo de `packages/ui`. Não divergir do design system por módulo sem aprovação.
- Analytics (GA4) cobre todos os módulos via `packages/analytics`. Toda página/rota nova é instrumentada.
- Upload e processamento de imagem ocorrem sempre no Backend, via Cloudinary com signed preset. Nunca hardcodar credencial Cloudinary.

---

## Regras Gerais de Código

- Mudança mínima, reversível, dentro do escopo. Sem refactor massivo sem autorização.
- Stack canônica única: Frontend React/TS/Vite/Tailwind; Backend Node/Express/TS/Kysely/PG; auth via JWT no backend.
- Python só para scripts fora do runtime principal.
- **Normalização obrigatória:** todo dado de API/banco/JSON/JSONB/query/localStorage/integração externa é `unknown` até passar por normalizador tipado antes de entrar em estado React, props ou render.
- Proibido `.map/.filter/.reduce/.forEach`, spread de array ou `.length` sobre payload externo sem `Array.isArray`/schema/fallback explícito.
- HTML importado do WordPress é hostil: sanitizar sempre (DOMPurify) antes de persistir/renderizar.

---

## Erros Conhecidos

Ao encontrar erro/regressão: (1) parar tentativas repetidas; (2) consultar `.specify/memory/errors.md` por código `E###` ou sintoma; (3) se houver solução documentada, aplicar e registrar evidência; (4) se não, diagnosticar e registrar aprendizado validado.

---

## Protocolo de Sessão

Sessões em `sessoes/` no formato `AA-MM-DD_N_<modulo>_<escopo>.md`. Consultar `sessoes/index.md`.

Conteúdo mínimo: cabeçalho (data/objetivo/módulo/gate), vínculos, plano, checklist de fechamento, arquivos a modificar, critério de conclusão, item para atualizar `project-state.md`. Atualizar a sessão antes de alterações técnicas e após cada etapa relevante.

---

## Conclusão de Tarefas

Concluída só quando: busca final relevante retorna o esperado; checklist da sessão fechada; nenhum arquivo parcialmente modificado; `project-state.md` atualizado; validação técnica/manual registrada. Evitar "parcial", "restante", "maioria", "principais", "alguns" ou percentual incompleto.

---

## Documentação Canônica

| Tipo | Fonte |
|---|---|
| Governança operacional | `AGENTS.md` |
| Princípios inegociáveis | `.specify/memory/constitution.md` |
| Arquitetura/contratos | `.specify/arquiteture.md` |
| Estado atual (fase/gate) | `.specify/memory/project-state.md` |
| Erros conhecidos | `.specify/memory/errors.md` |
| Contexto de retomada | `docs/agents/context-capsule.md` |
| Mapa da VM/infra (verificado) | `docs/agents/infra-map.md` |
| Registro de acesso & segredos | `docs/agents/access-registry.md` |
| Modelo de operação (SDD) | `docs/agents/operating-model.md` |
| Subagentes | `.claude/agents/` |
