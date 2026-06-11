# Tasks — 013

- [ ] T1 — Localizar artefato das 2 páginas (mantenedor indica caminho; varrer `C:\projetos`, `artificiobackup` incl. `secrets.7z`/`opt-dirs`, Cloudflare Pages/DNS read-only) · feito quando: código-fonte ou build confirmado pelo mantenedor; registrado na sessão. **Confirmar também: `regras.` = ex-`servidorvirtual.`?**
- [ ] T2 — Importar p/ `apps/links` (estático + nginx, 2 hostnames). **Se T1 não achar artefato: refazer do zero** (Wayback + conteúdo do mantenedor, stack estática canônica, marca G1) · feito quando: build local verde, preview local serve as duas páginas com conteúdo aprovado.
- [ ] T3 — Push p/ GitHub no monorepo (fecha pendência T6/spec 001 + D027) · feito quando: código versionado; `decisions.md` com linha fechando D027.
- [ ] T4 — `deploy-links.yml` via `_deploy-module.yml` · feito quando: pr-checks verdes.
- [ ] T5 — [APROVAÇÃO] rotas tunnel `links.` + `regras.` + deploy · feito quando: ambos 200 externos.
- [ ] T6 — Validação do mantenedor (paridade de conteúdo) + atualizar `project-state.md`/roadmap/sessão · feito quando: aceite registrado.
