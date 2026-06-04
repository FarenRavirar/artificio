# Prompt de retomada — Chat novo (Fase 2). Continuação direta.

> Cola no chat novo do projeto `C:\projetos\artificio`.

---

Este chat é a **continuação direta** do trabalho do Artifício G1. As Fases 0 e 1 já foram feitas noutro chat; tu retomas pra **executar a Fase 2** (spec já escrita). Caveman mode, português.

## Antes de tudo — contextualiza (lê nesta ordem)
1. `.specify/memory/project-state.md` — onde estamos.
2. `docs/agents/context-capsule.md` — regras + stack + topologia.
3. `.specify/memory/decisions.md` — D001–D036 (todas as decisões; não re-decidir).
4. `AGENTS.md` — governança/regras pétreas.
5. `.specify/arquiteture.md` — contratos (por seção).
6. `docs/agents/token-economy.md` — modo de trabalho.
7. **`specs/003-fase2-monorepo-sso/{spec,plan,tasks}.md`** — o que vais executar.
8. `sessoes/26-06-04_3_monorepo_fase2-sso.md` — sessão ativa.

## O projeto (resumo)
**Artifício G1** = suite modular de RPG em **subdomínios** sob `*.artificiorpg.com` (D017), unida por **login Google único** (cookie `.artificiorpg.com`, D018), leve (TS), saindo do WordPress. Monorepo em `C:\projetos\artificio` (pnpm+Turbo). Módulos: site(blog), glossario, mesas, downloads, **esferas** (Spheres of Power, multi-sistema D&D 2014/2024 + PF futuro, D028), srd, links. Pacotes: auth, ui, analytics, config, content, crosslink.

## Já feito (Fases 0+1)
- Governança completa (specs/skills/agentes/caveman, gates A→B→C→D, log de decisões append-only).
- Backup G1 validado off-VM (`C:\projetos\artificiobackup\2026-06-04`, restore-test OK). Gate A ✅.
- **VM Oracle recriada limpa** (`ssh faren` → `<IP_DA_VM>`, ARM/Ubuntu24/200GB), rede **`artificio_net`**, **tunnel Cloudflare próprio** (sem telegram). glossário+mesas restaurados e **no ar** (smoke 200, dados intactos: 8808 termos). telegram/foundry descartados (D034/D035).

## Modo de trabalho (IMPORTANTE)
**Tu (Opus) ORQUESTRAS; o Codex EXECUTA — delega por default.** O Codex provou-se confiável e pegou coisas que o Opus não pegou. Tu: desenhas/refinas specs, defines tarefas `CDX-*` auto-contidas (com `✓ Validar`), e **validas** a saída. Não rodes comando na VM nem escrevas boilerplate que o Codex faça (e o classifier bloqueia Opus em write na VM prod). Gatilho do mantenedor pro Codex: **"realize as tarefas para codex na sessão"**. O mantenedor cola a saída; tu validas e avanças. Saída de agentes em caveman.

## Tua missão — Fase 2 (→ Gate B)
Executar `specs/003-fase2-monorepo-sso` (tasks CDX-301..306):
1. Scaffold monorepo (pnpm-workspace, turbo, tsconfig base) + `packages/config`.
2. `packages/auth` — contrato de sessão (verifyToken, requireAuth, useSession, redirectToLogin).
3. `packages/ui` — design sóbrio (Nielsen/ISO), Header/Nav/Footer.
4. `apps/accounts` — SSO Google em `accounts.artificiorpg.com`: OAuth → JWT → cookie `Domain=.artificiorpg.com` → `users` em `accounts-db`.
5. Deploy na VM (`artificio_net`) + rota Cloudflare + **smoke + teste cross-subdomínio**.

**2 passos do mantenedor** (avisa quando chegar): (a) criar OAuth client Google "Artifício" (redirect `accounts.artificiorpg.com/api/auth/google/callback`) e entregar client id/secret; (b) rota Cloudflare `accounts.artificiorpg.com` → container.

**Gate B fecha quando:** `accounts.artificiorpg.com` faz login Google completo, `/api/auth/me` retorna o user pelo cookie, e a sessão é lida por outro subdomínio via `packages/auth.verifyToken`.

## Regras que não podem furar
- **Auth é sagrado** (D018): cookie `Domain=.artificiorpg.com; HttpOnly; Secure; SameSite=Lax`. Testar cross-subdomínio antes de fechar Gate B.
- **glossário/mesas NÃO se tocam** nesta fase (rodando em prod; integração ao SSO/monorepo = fases posteriores).
- Stack canônica: React19/Vite/TS/Tailwind + Express/Kysely/PG16 + google-auth-library/jsonwebtoken. Sem framework novo sem aprovação.
- Segredo nunca no git (`.env` gitignored). Tudo compartilhado/SSO/infra = SDD Completo.
- Atualiza rastreabilidade (project-state, sessão, decisions) ao avançar — pode delegar a parte mecânica ao Codex.

## Infra/refs
`ssh faren` (chave `C:/projetos/Secrets/ssh-key-MINHAVM.key`) · rede `artificio_net` · tunnel Cloudflare próprio · estrutura `/opt/artificio/<svc>` · backup em `C:\projetos\artificiobackup\2026-06-04`. Referência de robustez/stack: `C:\projetos\mesas_rpg_artificio`.

Começa contextualizando (T0 + spec 003), confirma comigo o entendimento, e dispara a primeira leva de tarefas Codex (301→303). Pergunta o que precisar definir.
