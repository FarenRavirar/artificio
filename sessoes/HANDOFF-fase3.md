# Prompt de retomada — Chat novo (Fase 3). Continuação direta.

> Cola no chat novo do projeto `C:\projetos\artificio` (Opus). Caveman mode, português.

---

Continuação direta do **Artifício RPG**. Fases 0/1/2 ✅ (Gates A e B aprovados). Estamos na **Fase 3 — módulos + conteúdo**. Tu (Opus) **orquestras**; o **Codex executa** (delega por default). Tu desenhas/refinas specs, defines tarefas `CDX-*` auto-contidas (com `✓ Validar`) e **validas** a saída. Não rodas comando na VM nem escreves boilerplate que o Codex faça.

## Antes de tudo — contextualiza (lê nesta ordem)
1. `.specify/memory/project-state.md` — onde estamos (fonte da verdade).
2. `docs/agents/context-capsule.md` — regras + stack + topologia (Tier 0).
3. `docs/agents/roadmap.md` — **mapa completo até conclusão** (fases/módulos/gates/pacotes).
4. `.specify/memory/decisions.md` — D001–D040 (não re-decidir).
5. `AGENTS.md` — regras pétreas. `.specify/arquiteture.md` — contratos.
6. `docs/agents/token-economy.md` — modo de trabalho/reload em tiers.

## O projeto (resumo)
Suite modular de RPG em **subdomínios** sob `*.artificiorpg.com` (D017), unida por **login Google único** em `accounts.` (cookie `Domain=.artificiorpg.com`, D018), leve (React19/Vite/TS/Tailwind + Express/Kysely/PG16/Cloudinary), saindo do WordPress (intocável até Gate C, adiado). Monorepo `C:\projetos\artificio` (pnpm+Turbo). **Nome = "Artifício RPG"; "G1" = só referência conceitual** (hub interconectado estilo portal de notícias), nunca o nome (D040).

## Estado atual (atualizado 2026-06-08)
- **Gate B ✅**: SSO `accounts.` no ar, cross-subdomínio provado, CI/CD canônico, VM `/opt/artificio`=clone git.
- **mesas**: **Gate D ✅ fechado**. Deploy real ✅ (CDX-309E), marca CDX-311 ✅ no ar, login real confirmado pelo mantenedor, allowlist prod validada (`evil.com` sanitizado; `mesas.` preservado).
- **Infra/CI-CD**: esteira beta D041 em uso; Docker cleanup + lock RW D055/D056 concluídos; `origin/main=origin/dev=22fe461` nessa retomada.

## Próximos passos (ordem sugerida — ver roadmap)
1. **Spec 011 / site CMS T16**: E2E autenticado no beta (`/admin`, criar/editar/preview/publicar/rebuild).
2. **Spec 011 T17**: operações editoriais básicas + publicação honesta.
3. **CDX-310**: reconciliar `deploy-accounts.yml` ao `_deploy-module.yml` + compose versionado (durabiliza deploy do SSO).
4. **Spec auditoria visual cross-módulo** (dedicada, token-eficiente): audita marca+visual de TODOS os módulos contra `@artificio/ui` (cores, logo, header/footer, contraste AA, layout) — gate antes de promover páginas. Base: `seo-usability-auditor`. Criar com `/new-spec`.
5. **glossario** → monorepo (já em prod, menor risco; valida playbook `add-module`).
6. **downloads** · **esferas** (multi-sistema, D028) · **srd** (+`crosslink`) · **links** (achar host, D027).
7. (futuro/⏸️) Gate C — cutover raiz + desligar WP. Fora do escopo ~3 meses.

## Pendência do mantenedor (🔒)
Rotacionar segredos vazados: tunnel token, PAT GitHub, WP creds, senha do `secrets.7z`.

## Regras que não furam
- **Auth é sagrado** (D018): cookie `Domain=.artificiorpg.com; HttpOnly; Secure; SameSite=Lax`. Testar cross-subdomínio.
- **Deploy/código via GitHub** (D039): PR→main→`workflow_dispatch mode=deploy`. VM direto só bootstrap/rollback aprovado. Opus não escreve na VM prod.
- **Marca** (D040): laranja `#FF9457` = acento (nunca texto branco pequeno sobre ele — usar navy `#020740`); navy `#020740` = texto/contraste; superfície dark do app = `#1B2A4A`. Logo branco em fundo escuro.
- Segredo nunca no git. Compartilhado/SSO/infra = SDD Completo. Atualiza rastreabilidade ao avançar (pode delegar mecânico ao Codex).

## Infra/refs
`ssh faren` (chave `<chave/segredo local fora do git>`) · rede `artificio_net` · tunnel CF próprio · `/opt/artificio/<svc>` · backup `C:\projetos\artificiobackup`. Gatilho do mantenedor pro Codex: **"realize as tarefas para codex na sessão"**.

Começa contextualizando (T0 + roadmap) e retoma pela Spec 011. Este handoff é histórico; o prompt atualizado para o próximo Claude está em `docs/agents/claude-next-prompt.md`.
