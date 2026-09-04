# Context Capsule — retomada mínima

> Deve sobreviver a compactações. Só o necessário para retomar com segurança. Atualizar quando o essencial mudar.

## Regra zero
Todo chat novo, todo agente, antes de qualquer análise, plano, comando, edição ou resposta de mérito, deve ler o T0 completo: `.specify/memory/project-state.md` + `docs/agents/context-capsule.md` + `.specify/memory/decisions.md`. Sem T0 lido, não há autorização para agir nem para declarar entendimento do estado. Isto é pétreo e omnipresente.

## Em uma frase
Construindo o **Artifício RPG**: suite de projetos em **subdomínios** sob `*.artificiorpg.com`, unida por login Google único (SSO), leve (TS/React/Express/Postgres), saindo do WordPress, em monorepo modular `artificio` com pnpm+Turborepo.

## Alma operacional
Isto e um projeto longo, multi-chat e multi-agente, nao um "toque de contexto". Cada agente entra no meio de uma obra continua: precisa carregar T0, respeitar sessoes/specs/backlog/decisoes e manter continuidade. Economia de token existe para sustentar o projeto por meses, nao para pular entendimento essencial.

> **Nome × conceito:** produto = **Artifício RPG**. "G1" = só referência conceitual (hub interconectado que direciona aos projetos, estilo portal de notícias G1) — não é nome. Codinome técnico interno pode usar "G1"; UI/produto nunca.

## Topologia (subdomínio-por-módulo técnico — D017)
Cada projeto/app no **próprio subdomínio**, root `/` próprio, **sem basename/gateway de path**:
`glossariobeta.`/`glossario.` (glossário no monorepo; `glossariorpg.` foi alias histórico pré-monorepo e não é rota ativa a preservar) · `mesas.` · `links.` · `artificiorpg.com` (blog/site novo, spec 029, `53e5870`; `beta.artificiorpg.com` = testes) · `accounts.` (SSO central, D018). Futuros: `downloads.`, `esferas.`, `srd.`. WP desligado da raiz. Une tudo: **cookie `.artificiorpg.com` + nav + design system**. Cloudflare Tunnel mapeia hostname→container. Blog na raiz = aposta de SEO (D019). Não hardcodar credencial/host fora de env.

## Onde estamos
Ver `.specify/memory/project-state.md`. Hoje: **Fase 3 — projetos + conteúdo.** Gates A/B ✅; Gate D fechado para mesas, glossario, site e links. **5 apps em prod** (2026-06-22): accounts, mesas, glossario, site, links — todos com SSO Google central. `beta.artificiorpg.com` = staging. WP desligado (D074).

## Reload (Tier 0 — estes 4)
`project-state.md` + este capsule + `decisions.md` + `backlog-audit-map.md`. Resto sob demanda. **Caveman ultra é obrigatório na comunicação com o mantenedor** (salvo trecho de segurança/ordem destrutiva que exija clareza). Disciplina: `docs/agents/token-economy.md`. **Mapa macro até conclusão: `docs/agents/roadmap.md` (T1).**

**Ferramentas obrigatórias quando disponíveis:** todo agente deve usar o conjunto local antes de cair no fallback cru: `rtk` para shell/leitura/busca, `artificio-api-governance` para qualquer API, LSP para diagnóstico automático de arquivos tocados e `codebase-memory-mcp` para grafo/impacto. Se uma ferramenta não aparecer no cliente atual (Codex/Claude/OpenCode), registrar limitação na sessão e usar fallback (`rtk rg`, `ast-grep`, leitura direta, `pnpm verify:api` quando aplicável). Detalhe canônico: `AGENTS.md` §Ferramentas MCP / Agentes.

Escalada T1 obrigatoria: se tocar/questionar governanca, infra, deploy, CI/CD, VM, DNS/tunnel, banco, auth, SEO/Lighthouse/qualidade transversal, pacotes compartilhados, specs/backlog/sessoes ou conclusao de tarefa, ler as secoes/docs T1 pertinentes antes de agir/encerrar. Se nao leu o T1 pertinente, nao pode dizer "resolvido".

## Regras que não posso esquecer
1. **Gates A→B→C→D**, cada um com aprovação. Nada destrutivo na Oracle antes do Gate A. WP raiz **DNS** intocável até Gate C (cutover cerimonial, adiado). **Exceção D074:** a origem WP/Hostinger de import sai do ar ~2026-06-20 — migração total de conteúdo/mídia é finalização urgente; ainda só GET/read-only sobre o WP (nunca write no WP).
2. **Aprovação é por ação, não por sessão — e não acumula.** `git commit`/`push` e qualquer comando de **escrita/mutação** na VM sempre pedem aprovação, no formato de `AGENTS.md`. "Commite" ≠ autorização para commitar correção 5 min depois. "Pode abrir PR" ≠ autorização para commitar no PR. Cada `git commit` e cada `git push` exige pedido próprio, mesmo no mesmo PR, mesmo na mesma conversa. **Read-only na VM (`ssh <VM_ALIAS>` `docker ps|images|system df|logs|inspect`, `psql SELECT`, `pg_dump`, `git status|log|diff`, etc.) é SEMPRE permitido, sem aprovação** — ler estado não é ação de mérito; deve preceder fix de infra.
   Exceção pétrea: pacote `apt` operacional ausente e necessário para tarefa já autorizada pode ser instalado sem nova aprovação.
3. **Compartilhado = SDD Completo.** `packages/*`, infra (tunnel/DNS), `accounts.` (SSO), banco, importador, SEO. Módulo isolado pode ser Lite.
4. **Isolamento de módulo:** não tocar outro `apps/*` ou `packages/*` fora do escopo sem aprovação.
5. **Auth é sagrado:** nunca quebrar a sessão SSO compartilhada.
6. **SEO inegociável:** preservar slugs e 301; sem regressão.
7. **Deploy/código via GitHub Actions.** VM manual só bootstrap/conexão/instalação operacional/diagnóstico/rollback aprovado; deploy normal usa branch/PR/workflow/secrets.
    **⚠️ `deploy.yml` só deploya se `deploy_paths` (manifesto) mudar.** Docs/specs/reviews **nunca disparam deploy** — só CI. Verificar com: `gh run view <RUN_ID> --log | grep "deploy="`. Forçar manual: `gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta`. Detalhe em `docs/agents-internal/infra-map.md` §Regra operacional de deploy.
   **Postgres + senha (E009):** Postgres só grava senha (`pg_authid`) na **1ª init do volume**; trocar `.env` de volume já existente NÃO atualiza → `28P01` no app. Fix: recriar volume (DB vazio) ou `ALTER USER` (com dado). Gerar `.env` na VM com here-string + `ssh '... cat > .env'`, nunca `ssh "...$(...)..."` em PowerShell (`\n` literal corrompe). Diagnosticar auth pela rede docker, não `127.0.0.1` (é `trust`, falso positivo). Runbook §rotação de senha.
8. **Doc-only não libera git automático.** `commit`, `push` e promoção exigem pedido explícito por ação, mesmo doc-only.
   **Trava pétrea (D072 + D073):** `dev` tem **branch protection** (default desde 2026-06-17) — **TUDO entra em `dev` via branch + Pull Request** (`git switch -c <tipo>/<escopo>` → push branch → `gh pr create --base dev`), incl. doc-only; push direto a `dev` é **bloqueado** e o PR exige o check `lint + build + test` verde (0 approvals). Não há mais ff/push direto para `dev`. A promoção `dev→main` (código ou docs) é por fast-forward (`promote-prod-fast-forward.yml`); `main` é protegida contra force-push/delete mas aceita o ff do promote. **Motivo:** revisões da Amazon leem PRs. Furo histórico: commits `485b363`..`d077185` direto em `dev` (2026-06-15/16) — não repetir.
9. **Feito exige prova real.** Dry-run/plano/doc nao fecha task que promete comando executavel. Se a validacao real falha, reabrir task/backlog, corrigir ou registrar bloqueio concreto.
**API governance:** mudancas em `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**` ou allowlist devem passar por `pnpm verify:api` quando possivel; `api-governance` na PR e a trava obrigatoria. Descoberta primaria de rota = `artificio-api-governance`/`docs/api/generated/artificio-api.bundle.json`, nunca memoria de chat.
10. **Erros proibidos ja cometidos:** nao fechar sem comando real; nao chamar local/parcial de concluido; nao atualizar so `project-state` quando a regra e governanca; nao pular T1 em infra/qualidade/governanca; nao deixar processo auxiliar rodando.
11. Comunicação em PT. Segredos nunca versionados.

## Stack canônica
Front: React19/Vite/TS/Tailwind/React Router/TanStack Query.
Back: Express/TS/Kysely/PG16/JWT/Google OAuth/Cloudinary.
Infra: Docker/nginx(por app)/Cloudflare Tunnel(ingress hostname→container)/Watchtower(beta)/Oracle 24GB-200GB. Imagem buildada na VM.
Cloudflare API: token (env de usuário `CLOUDFLARE_API_TOKEN`+`ACCOUNT_ID`+`ZONE_ID`, lido via `GetEnvironmentVariable(...,"User")`, nunca impresso) → purge cache + read DNS/zone/settings. **⛔ Tunnel/Zero Trust = 403 Forbidden** (sem permissão `Cloudflare Tunnel:Read/Edit` no token). Agent não pode listar/criar/gerir túneis até mantenedor adicionar escopo. Débito: `BL-CF-TUNNEL-TOKEN-SCOPE`. Detalhe/política: `docs/agents-internal/access-registry.md`.

## Projetos (`apps/*`, tecnicamente módulos)
`site` (portal+blog, SSG), `glossario`, `mesas`, `links`. Futuros: `downloads`, `esferas` (multi-sistema), `srd`.
Pacotes: `auth`, `ui`, `analytics`, `config`, `content`, `changelog`, `feedback`, `media`.

## Dados Mesas e sistemas de RPG

- Catálogo/dados Mesas (mesas, usuários, perfis, preferências) e sistemas de RPG são domínios distintos.
- Central = somente serviço de sistemas de RPG no Site Prod. Mesas Prod usa Central diretamente.
- Mesas Beta mantém projeção local de sistemas, hidratada do Central por upsert: UUID preservado, existentes atualizados, ausentes inseridos, extras Beta nunca apagados.
- Mesas Prod→Beta hidrata dados Mesas, incluindo mesas/usuários, mas exclui domínio de sistemas. Runtime Beta inteiro usa projeção local.
- Spec 078/D114 supera “sem projeções locais” da 062 somente para Mesas Beta e unifica adapter, onboarding e draft JSON.

## Arquitetura de agentes (Artifício Supervisor Flow)
Agente primário único (`artificio-orquestrador`) coordena subagentes especializados (investigador, implementador, revisor, documentador, registrador, git). Sem divisão rígida por provedor de modelo — cada agente usa o modelo disponível no cliente (DeepSeek, etc.). **Nenhum agente aciona, muta, roda subprocesso ou chama ferramenta em nome do outro sem aprovação nominal do mantenedor** — a regra pétrea de aprovação-por-ação (não-por-sessão) vale integralmente aqui; comandos documentados são referência, não autorização permanente. Comunicação entre agentes prioriza read-only. Detalhe/comandos/paths: `docs/agents/operating-model.md` (T1).

**Ferramentas locais essenciais (usar quando disponíveis):**
- `rtk` — prefixo obrigatório para shell, busca, leitura, git, testes e builds; reduz tokens.
- LSP — diagnóstico automático; pega erros semânticos que busca textual não vê.
- `codebase-memory-mcp` — grafo de conhecimento para busca estrutural, chamadas e impacto.
- `artificio-api-governance` — MCP/API bundle (`search_api`, `get_api_bundle_summary`) para descoberta primária de rotas.
- `opencode-agent-browser` — automação de browser headful via `agent-browser` CLI (navegação, screenshots, scraping, formulários, dev tools). Documentado em `AGENTS.md` §Browser Automation.
