# Decisões — Artifício G1 (append-only)

> ADR-lite. Uma decisão = uma linha. **Append-only:** nunca reescrever histórico; para reverter, adicionar nova linha que supera (`supera D0NN`). Ler este arquivo evita re-decidir = evita retrabalho. Manter MINÚSCULO: sem prosa.
>
> Formato: `D0NN | AAAA-MM-DD | <decisão> | <motivo curto> | status`. Status: firme | revisar | superada.

| ID | Data | Decisão | Motivo | Status |
|---|---|---|---|---|
| D001 | 2026-06-03 | Monorepo único `artificio`, pnpm + Turborepo | leve, modular, build só do que mudou | firme |
| D002 | 2026-06-03 | Path único `artificiorpg.com/<módulo>` + gateway nginx | unidade G1, 1 host p/ SEO/analytics, cookie único | **superada (D017)** |
| D003 | 2026-06-03 | SSO: 1 OAuth Google, JWT em cookie `Domain=.artificiorpg.com` | logado no site = logado em tudo | firme |
| D004 | 2026-06-03 | WordPress roda em paralelo; cutover DNS só no Gate C | zero downtime | firme (Gate C adiado, D016) |
| D005 | 2026-06-03 | CMS = store nativo Postgres + importador WP one-shot descartável | leve, sem dep pesada; migração some pós-cutover | firme |
| D006 | 2026-06-03 | Blog = pré-render estático (SSG) c/ rebuild incremental, não SSR | mais leve, SEO-safe, menos runtime quebrando | firme |
| D007 | 2026-06-03 | Stack canônica = stack do mesas (React19/Vite/Tailwind + Express/Kysely/PG16/Cloudinary) | consistência, reuso, 1 stack só | firme |
| D008 | 2026-06-03 | Infra: Oracle 24GB/200GB, Docker, Cloudflare Tunnel, GHCR, Watchtower(beta) | já é o padrão do ecossistema | firme |
| D009 | 2026-06-03 | Backup off-VM em `C:\projetos\artificiobackup` (local, 300GB livre) | fora da VM antes de destruir | firme |
| D010 | 2026-06-03 | Acesso DB da VM via RaiDrive = read-only por padrão; escrita exige aprovação | segurança operacional | firme |
| D011 | 2026-06-03 | Site sobe como `beta.artificiorpg.com`; demais serviços integram em versão principal | site é o maior risco (300+ posts) | refinada por D015 |
| D012 | 2026-06-03 | Governança antes de código; avanço por gates A→B→C→D | controlar risco por processo | firme |
| D013 | 2026-06-03 | Caveman default na saída de todos os agentes; docs de reload mantidos minúsculos | economia de tokens em projeto de ~3 meses | firme |
| D014 | 2026-06-03 | Reload obrigatório em tiers (T0 minúsculo todo chat; T1/T2 sob demanda) | cortar custo de contexto por sessão | firme |
| D015 | 2026-06-03 | **Interim híbrido.** Novos (site, downloads, wiki-sop, srd) sob `beta.artificiorpg.com/<base>` (path único no host beta). Glossário e mesas ficam nos subdomínios prod atuais (`glossariorpg.`, `mesas.`), unidos por SSO + nav + ui; código (branch main/prod) entra no monorepo, deploy mantém o subdomínio. Path único na raiz = alvo só no cutover futuro | WP segura `artificiorpg.com`; site é só beta; mínima disrupção do prod existente | **superada (D017)** |
| D016 | 2026-06-03 | **Cutover adiado.** Apontar raiz `artificiorpg.com` ao novo site + desligar WP = fora do escopo destes ~3 meses. Gates ativos = **A, B, D**. Gate C = futuro documentado, não executado | "por enquanto não vai ter prod, só beta do site" | firme (refinada D017: só o blog vai à raiz; módulos não convergem) |
| D017 | 2026-06-03 | **Topologia = subdomínio-por-módulo** (supera D002/D015). Cada módulo no próprio subdomínio (`glossariorpg.`, `mesas.`, `downloads.`, `spheres.`, `srd.`, `links.`), root `/` próprio, **sem basename**. Blog novo em `beta.artificiorpg.com` (→ raiz `artificiorpg.com` no futuro, D016). WP fica na raiz agora. Unido por SSO (cookie `.artificiorpg.com`) + nav + design system. Cloudflare Tunnel mapeia hostname→container | dissolve a contradição WP-na-raiz, sem migração de glossário, modelo Google-suite (docs./mail.), menos código por app | firme |
| D018 | 2026-06-03 | **SSO central em `accounts.artificiorpg.com`** (OAuth callback, sessão, refresh). 1 OAuth client Google; cada módulo redireciona pra cá no login e valida o JWT do cookie raiz | host dedicado isola o auth, padrão de suite | firme |
| D019 | 2026-06-03 | Blog (aposta de SEO) fica na **raiz** `artificiorpg.com`; módulos-ferramenta em subdomínio | mitiga não-consolidação de SEO do modelo subdomínio (autoridade concentra no blog/raiz) | firme |
| D020 | 2026-06-03 | Search Console = 1 **Domain property** (`artificiorpg.com`, cobre todos subdomínios); GA4 = 1 property com `cookie_domain` raiz + exclusão de referral interno | "analytics pega tudo" no modelo subdomínio | firme |
| D021 | 2026-06-03 | **Escopo do backup = só G1** (mesas beta/prod, glossário beta/prod, WP, links/servidorvirtual, segredos, DNS). `gerenciador_telegram` e `foundry` **não** entram | mantenedor refaz ambos do zero; telegram está no GitHub | firme |
| D022 | 2026-06-03 | Tunnel Cloudflare **novo** na Fase 1 (o velho mora no telegram, descartado). Backup só do DNS export p/ saber hostnames a re-apontar; token velho descartável | tunnel atual acoplado ao telegram | firme |
| D023 | 2026-06-03 | Acesso à VM por alias **`ssh faren`** (host/chave em `~/.ssh/config` local, não versionado). Read-only sem aprovação; write na VM = aprovação pétrea | mantenedor liberou acesso direto | firme |
