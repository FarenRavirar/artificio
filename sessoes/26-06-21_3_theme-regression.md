# Sessão: Regressão de Tema — Site + Links (2026-06-21)

**Data:** 2026-06-21 (madrugada/manhã)
**Objetivo:** Diagnosticar e corrigir regressão visual após promote `dev→main` + redeploy de todos os apps.
**Gate:** B (importação/projetos) + D (por projeto)
**Apps afetados:** `apps/site` (artificiorpg.com), `apps/links` (links.artificiorpg.com), `packages/ui`

---

## Contexto

Promote `dev→main` (run `27894586895`) trouxe ~30 commits acumulados para `main`:
- Node 24 LTS (spec 033 T8-T12)
- Vite 8 + Tailwind 4 + ESLint 10 (spec 033 F4B)
- bump deps de segurança (spec 039)
- Kysely 0.29.2 + vitest
- PR #77 (pnpm --prod fix), PR #78 (spec 038 links: mídia + report + cron)

Após promote, todos os 5 apps foram redeployados (runs `27894598616`..`27894601319`). Usuário reportou regressão visual:
1. Site principal: toggle dark/light não funciona, só light
2. Links: toggle funciona no conteúdo mas nav permanece light

---

## Descobertas

### Bug 1: React ThemeToggle não atualiza data-variant (CORRIGIDO LOCAL)

**Raiz:** `packages/ui/src/theme.tsx` — `setTheme()` e `applyTheme()` setam `data-theme` no `<html>` e cookie cross-subdomínio, mas NUNCA atualizam `data-variant` nos elementos `.artificio-header` / `.artificio-footer`.

O CSS do nav dark usa `[data-variant=dark]`:
```css
.artificio-header[data-variant=dark] {
  background: var(--artificio-navy);
  color: #fff;
}
```

Resultado: conteúdo do body muda (responde a `:root[data-theme=dark]`), mas header/footer permanecem em light.

**Fix aplicado em `packages/ui/src/theme.tsx`:**
- Nova função `applyHeaderVariant(theme, doc)` que seta/remove `data-variant` em `.artificio-header, .artificio-footer`
- Integrada em `setTheme()` e `applyTheme()` 
- Build `@artificio/ui` verde (`tsc`)

**Impacto:** shared package → todos consumidores React (links, glossario, mesas, accounts) precisam rebuild+redeploy.

**Artefatos:** `packages/ui/src/theme.tsx` modificado (linhas 45-72).

### Bug 2: Site toggle não funciona (CAUSA-RAIZ INCERTA)

**Sintoma:** Botão dark/light em artificiorpg.com não altera nada visualmente.

**Investigação:**
- JS inline (`applyVariant`/toggle handler) **idêntico** entre beta (funciona) e prod (quebrado) — 4444 bytes
- CSS compilado **idêntico** entre beta e prod — MD5 `722bcdb34c2f4eb3b834468866dc9436`
- HTML do container (`dist/index.html`) tem `<meta http-equiv="content-security-policy">`
- HTML servido via Cloudflare NÃO tem CSP — `Cf-Cache-Status: HIT` com `max-age=7200`
- Evidência forte de que Cloudflare está servindo versão cacheada antiga

**Hipóteses (em ordem de probabilidade):**
1. **Cloudflare cache** — HTML antigo pré-promote em cache na edge (mais provável: CSP ausente na resposta live vs presente no container)
2. **Upgrades quebraram build Astro** — Node 24/Vite 8/Tailwind 4 podem ter alterado comportamento do Astro (mas CSS e JS compilados são idênticos aos do beta)
3. **Build não rodou** — entrypoint encontrou `dist/index.html` pré-existente e pulou rebuild (mas logs mostram rebuild completo com swap atômico)

**Próximo passo:** Purgar cache Cloudflare `artificiorpg.com` (precisa token API — mantenedor).

### Bug 3: Nav "WhatsApps" ausente no site (RESOLVIDO)

**Raiz:** Mesmo problema do Bug 2 — Cloudflare cache servindo HTML antigo.

**Evidência:** `dist/index.html` do container TEM "WhatsApps" na nav e footer. Resposta live NÃO tem.

---

## Plano de Ação

1. ~~Corrigir `packages/ui/src/theme.tsx`~~ ✅ (local, sem commit)
2. Purgar cache Cloudflare `artificiorpg.com` → verificar site
3. Commitar fix do theme.tsx + branch + PR
4. Rebuild/redeploy links, glossario, mesas, accounts (TODOS os consumidores React do `@artificio/ui`)
5. Smoke: toggle em cada app → nav+conteúdo alternam juntos

---

## Checklist de Fechamento

- [ ] Bug 1 (React ThemeToggle): commit/push/PR mergeado, consumidores redeployados, smoke OK
- [ ] Bug 2 (Site toggle): Cloudflare cache purgado, toggle funcional confirmado
- [ ] `specs/backlog.md` atualizado com `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `D-PROMOTE-033-UPGRADES-REGRESSION`
- [ ] `project-state.md` atualizado se necessário

---

## Arquivos Modificados

- `packages/ui/src/theme.tsx` — adicionada `applyHeaderVariant()`, integrada em `setTheme()`/`applyTheme()`
- `specs/backlog.md` — 3 novas entradas de débito
- `sessoes/26-06-21_3_theme-regression.md` — este arquivo
