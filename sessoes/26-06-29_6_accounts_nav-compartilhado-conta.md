# 26-06-29_6 — accounts: nav compartilhado na página de conta

- **Data:** 2026-06-29
- **App:** `apps/accounts` (SSO frontend) + `packages/ui` (header da suíte)
- **Gate:** D
- **Objetivo:** a página de conta (`accounts.artificiorpg.com/conta`) deve exibir o **nav/header compartilhado da suíte** (igual aos outros apps), além do conteúdo atual da conta.
- **Aprovação:** mantenedor aprovou a feature em 2026-06-29 ("era para já ter feito nav compartilhada"). Pediu **sessão, não spec**.
- **Modo:** SDD-via-sessão (mantenedor optou por sessão). Mesmo assim, `accounts` e `packages/ui` são sagrados → smoke obrigatório de SSO + consumidores.

> ⚠️ **BLOQUEADO no início por outage:** em 2026-06-29 o deploy de accounts derrubou o SSO (502, `ERR_MODULE_NOT_FOUND 'cloudinary'`). Recuperação está na sessão `26-06-29_5`. **Não implementar este nav até o SSO estar de volta (200) e estável.**

---

## Diagnóstico atual
`apps/accounts/frontend/src/main.tsx` renderiza `<main className="accounts-page">` com `ContaView`/`LoginView`. A conta usa só componentes internos (`AccountHeader`, `AccountBrand`) — **não** importa o header da suíte de `@artificio/ui`. Por isso o nav compartilhado (links Glossário/Mesas/Downloads/Esferas/SRD/Links + tema + menu de conta) não aparece.

O site usa `SiteHeader.astro` + `SiteHeaderIsland.tsx` (Astro). O glossário/mesas (React SPA) usam o `Header` de `@artificio/ui`. A conta deveria seguir o mesmo `Header` de `@artificio/ui` (React).

## Plano (rascunho — validar ao executar)
1. Ver a API do `Header` de `@artificio/ui` (`packages/ui/src/Header.tsx`): props (`showSearch`, `onSearch`, links/módulos, sessão, tema). Conferir como glossário/mesas o consomem.
2. Em `main.tsx`, envolver a página com o `Header` compartilhado no topo (acima de `ContaView`/`LoginView`), mantendo o card da conta no corpo.
   - Decidir: nav aparece também na tela de **login** ou só na **conta**? (login é pré-sessão; provavelmente só conta, ou nav sem menu de usuário no login.)
   - Reusar sessão via `@artificio/auth/client` (`useSession`) que o accounts já usa.
   - Tema: accounts já tem `useTheme`/`applyTheme`; alinhar com o toggle do header pra não duplicar.
3. Ajustar layout/CSS (`styles.css`): o `.accounts-page` é centralizado full-height; com header no topo, rever o split do fundo (`--accounts-rail`/canvas) pra não brigar com o header.
4. Garantir links do header apontando pros subdomínios corretos (mesma fonte dos outros apps — provavelmente `@artificio/ui`/`@artificio/config`).

## Arquivos prováveis
- `apps/accounts/frontend/src/main.tsx` (montar header)
- `apps/accounts/frontend/src/styles.css` (layout com header)
- (leitura) `packages/ui/src/Header.tsx`, consumidores em `apps/glossario`/`apps/mesas` frontend

## Smoke obrigatório (accounts/ui sagrados)
- login → me → logout funcionando (SSO intacto).
- Header aparece na conta, links corretos, tema ok, menu de conta ok.
- Pelo menos 1 app consumidor do SSO ainda loga (não regrediu).
- Build local (`vite build` do accounts) + lint.

## Git
- Branch própria (ex.: `feat/accounts-conta-shared-nav`), PR base `dev`, merge autorizado, promoção + deploy prod (accounts é prod-only).
- **NÃO** começar antes do SSO restaurado (ver sessão 5).

## Estado
- Fase: superada. O outage de SSO da sessão 5 foi resolvido antes desta execução; a nav pôde avançar.
- Próximo histórico: implementar `Header` compartilhado e corrigir o rail branco residual.

---

## Implementação Codex — nav compartilhada

Escopo executado:
- `apps/accounts/frontend/src/main.tsx`
  - importa `Header` e `@artificio/ui/styles.css`;
  - renderiza o `Header` compartilhado acima de `accounts-page`;
  - usa `showThemeToggle`, `variant={theme}`, `brandHref={BRAND_ORIGIN}`;
  - remove o toggle flutuante local para evitar duplicidade.
- `apps/accounts/frontend/src/styles.css`
  - mantém correção da lateral branca com `--accounts-rail`;
  - ajusta `min-height` da página para descontar o header;
  - remove CSS do toggle local.
- `docs/api/generated/api-consumers.generated.json`
  - atualizado por `pnpm verify:api` apenas por deslocamento de linhas dos `fetch` no frontend.

Validação:
- `pnpm --filter @artificio/accounts build` ✅
- `pnpm --filter @artificio/accounts test` ✅ (8/8)
- `pnpm --filter @artificio/accounts lint` ✅
- `pnpm verify:api` ✅ (3 warnings conhecidos de ambiguous paths em mesas/glossario; exit 0)
- Checagem em `dist/client`: bundle contém `.artificio-header`, nav compartilhada (`Portal`, `Glossário`, `Mesas`, `Downloads`, `Esferas`, `SRD`, `WhatsApps`) e rail dark `#070b1a`.

Impacto deploy:
- Não toca Dockerfile, backend, `package.json`, `pnpm-lock.yaml`, `@artificio/media`, Cloudinary ou deps runtime.
- Impacto esperado: rebuild frontend do `accounts`.

Estado:
- Implementado localmente e depois publicado via PR #115.

## Publicação — PR #115

Branch:
- `fix/accounts-shared-nav`

Commits:
- `2766217 fix(accounts): use shared nav and dark rail`
- `d3b3e19 chore(api): update generated diff report`
- `c0721d8 chore(api): normalize generated diff report`

PR:
- #115 `fix/accounts): use shared nav and dark rail`
- Base: `dev`
- Mergeado em `dev`: merge commit `ed22e06640d4ad341bf3262a26163e7835e7558f`
- Branch remota removida pelo merge.

Validação CI/PR:
- `lint + build + test` ✅
- `api-governance` ✅
- workflow de deploy em PR: módulos avaliados, deploy real skipped (comportamento esperado).

Promoção/deploy:
- `dev → main`: workflow `promote-prod-fast-forward.yml`, run `28416447625` ✅
- Deploy prod accounts disparado via `deploy.yml`, run `28416458299`
- Por ordem do mantenedor, não houve acompanhamento/smoke depois do dispatch nesta sessão.

Estado final:
- Nav compartilhado adicionada no accounts.
- Lateral branca corrigida por `--accounts-rail` escuro.
- Sem alteração em Dockerfile, backend, deps runtime, secrets ou VM.
- Sem documentação/spec adicional além desta sessão.
