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

## Estado atual (2026-06-05)
- **Gate B ✅**: SSO `accounts.` no ar, cross-subdomínio provado, CI/CD canônico, VM `/opt/artificio`=clone git.
- **mesas**: deploy real ✅ (CDX-309E, run `26994910262`), login Google real ✅. **Falta Gate D**: E2E **logout** + **allowlist prod**.
- **CDX-311 (marca real) commitado** — PR [#2](https://github.com/FarenRavirar/artificio/pull/2) (branch `feat/brand-design-system`): cores reais (laranja `#FF9457`, navy `#020740`, D040), Header/Footer-hub, login SSO rebrandado, nome corrigido. Build 7/7. **Aguardando codex mergear + deployar** `accounts`+`mesas` (toca `packages/ui`).

## Próximos passos (ordem sugerida — ver roadmap)
1. **Confirmar deploy do CDX-311** (codex mergeou PR #2 + deployou accounts+mesas?) e validar marca no ar (header/footer/login nas cores certas, logo branco no dark).
2. **Fechar Gate D mesas**: E2E browser real — **logout** (cookie morre em mesas+accounts) + **allowlist prod** (conta fora da lista barrada). Login já ✅. Trazer evidência → validar.
3. **Beta `mesasbeta.artificiorpg.com`**: erro `deleted_client` (usa OAuth client legado deletado). Rebuildar do `main` (passa a usar accounts, sem client próprio) **ou** aposentar. CDX dedicado.
4. **CDX-310**: reconciliar `deploy-accounts.yml` ao `_deploy-module.yml` + compose versionado (durabiliza deploy do SSO).
5. **Spec auditoria visual cross-módulo** (dedicada, token-eficiente): audita marca+visual de TODOS os módulos contra `@artificio/ui` (cores, logo, header/footer, contraste AA, layout) — gate antes de promover páginas. Base: `seo-usability-auditor`. Criar com `/new-spec`.
6. **glossario** → monorepo (já em prod, menor risco; valida playbook `add-module`).
7. **site/blog** + importador WP one-shot (maior risco/valor; puxa `packages/content`+`analytics`).
8. **downloads** · **esferas** (multi-sistema, D028) · **srd** (+`crosslink`) · **links** (achar host, D027).
9. (futuro/⏸️) Gate C — cutover raiz + desligar WP. Fora do escopo ~3 meses.

## Pendência do mantenedor (🔒)
Rotacionar segredos vazados: tunnel token, PAT GitHub, WP creds, senha do `secrets.7z`.

## Regras que não furam
- **Auth é sagrado** (D018): cookie `Domain=.artificiorpg.com; HttpOnly; Secure; SameSite=Lax`. Testar cross-subdomínio.
- **Deploy/código via GitHub** (D039): PR→main→`workflow_dispatch mode=deploy`. VM direto só bootstrap/rollback aprovado. Opus não escreve na VM prod.
- **Marca** (D040): laranja `#FF9457` = acento (nunca texto branco pequeno sobre ele — usar navy `#020740`); navy `#020740` = texto/contraste; superfície dark do app = `#1B2A4A`. Logo branco em fundo escuro.
- Segredo nunca no git. Compartilhado/SSO/infra = SDD Completo. Atualiza rastreabilidade ao avançar (pode delegar mecânico ao Codex).

## Infra/refs
`ssh faren` (chave `C:/projetos/Secrets/ssh-key-MINHAVM.key`) · rede `artificio_net` · tunnel CF próprio · `/opt/artificio/<svc>` · backup `C:\projetos\artificiobackup`. Gatilho do mantenedor pro Codex: **"realize as tarefas para codex na sessão"**.

Começa contextualizando (T0 + roadmap), confirma comigo o estado do deploy do CDX-311, e propõe o fechamento do Gate D mesas. Pergunta o que precisar.
