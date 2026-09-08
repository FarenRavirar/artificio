# Plano — 025

## Arquitetura da solução

Programa em camadas, nesta ordem:

1. **Medicao limpa primeiro.** Criar harness Lighthouse/axe sem extensoes, com repeticao, mediana, artefatos e budgets.
2. **Quick wins seguros.** Corrigir dimensoes de logos/imagens, contrastes obvios, nomes acessiveis e `robots.txt` quando confirmado.
3. **Performance por app.** Atacar `site`, `glossario` e `mesas` separadamente, porque os gargalos sao diferentes.
4. **Infra/headers.** Criar contrato de headers por host, validado antes de qualquer deploy.
5. **Compartilhamento com prova.** Promover para `packages/ui/content/analytics` so o que virar contrato real e repetido.

## Specs/debitos recomendados

| Ordem | ID backlog | Spec/fatia sugerida | Escopo | Por que |
|---|---|---|---|---|
| 1 | `BL-QA-LH-HARNESS` | 025-T1 | todos publicos | Sem baseline limpo, todo score vira chute. |
| 2 | `BL-QA-SITE-IMAGES` | 026 ou 025-T2 | `apps/site`, Cloudinary | Site tem economia ~472 KiB so em imagens. |
| 3 | `BL-QA-SHELL-CLS` | 027 ou 020-B13 subfatia | `packages/ui`, shells Astro/React | Glossario CLS 0.652 e footer/logo sem reserva. |
| 4 | `BL-QA-GLOSSARIO-PERF` | 028 | `apps/glossario` | Bundle inicial ~1.14 MiB + `/api/terms` ~612 KiB no caminho critico. |
| 5 | `BL-QA-MESAS-PERF` | 029 | `apps/mesas` | TBT alto, JS/CSS inicial e unused JS relevantes. |
| 6 | `BL-QA-ROBOTS-SEO` | 030 | `packages/content`, apps, nginx se preciso | Lighthouse acusa `robots.txt` invalido em glossario/mesas. |
| 7 | `BL-QA-SECURITY-HEADERS` | 031 | infra + apps | CSP/HSTS/COOP/XFO/Trusted Types exigem desenho cross-host. |
| 8 | `BL-QA-A11Y-SWEEP` | 032 | site/glossario/mesas + tokens UI | Contraste, nomes acessiveis, touch targets e links. |
| 9 | `BL-QA-THIRD-PARTY` | 033 ou junto de analytics | analytics/Cloudflare/scripts | Separar extensoes de usuario de scripts reais do produto. |

## Arquivos afetados prováveis

- `apps/site/src/components/Card.astro`
- `apps/site/src/components/SiteFooter.astro`
- `apps/site/src/pages/blog/[slug].astro`
- `apps/site/src/pages/robots.txt.ts`
- `apps/glossario/frontend/src/**`
- `apps/glossario/backend/src/**`
- `apps/mesas/frontend/src/**`
- `packages/ui/src/**`
- `packages/content/src/robots.ts`
- `packages/analytics/src/**`
- `.github/workflows/**` se budgets entrarem em CI
- deploy/nginx/headers por app, quando a spec de infra for aberta

## Contratos/interfaces tocados

- `@artificio/ui/styles.css`: tokens e componentes compartilhados.
- `@artificio/ui/static`: logos/nav/footer data-only para shell Astro.
- `@artificio/content`: robots/sitemap/meta helpers.
- `@artificio/analytics`: fonte unica de scripts/eventos permitidos.
- HTTP headers por subdominio.
- APIs publicas do glossario (`/api/terms`) se houver paginacao/lazy load.

## Impacto em consumidores

- `site`: SSG/zero-JS deve permanecer; ajustes de imagem e footer podem afetar todos os cards/posts.
- `glossario`: mudancas de bundle/data afetam busca, detalhe de termo e login/SSO.
- `mesas`: mudancas de bundle podem afetar catalogo publico, painel mestre e auth.
- `packages/ui`: qualquer primitiva nova precisa smoke proporcional nos consumidores.
- Infra headers: afeta todos os hosts sob Cloudflare Tunnel; WP raiz fica fora ate Gate C.

## Rollback

- Harness: remover workflow/script sem afetar runtime.
- Imagens: voltar markup anterior e transforms Cloudinary.
- CLS/shell: voltar componente/estilo anterior.
- SPA perf: rollback por PR/app; evitar migration destrutiva.
- Robots/headers: rollback por arquivo/app/nginx; manter plano de header minimo conhecido bom.

## Validação

Minimo por fatia:

- build do app/pacote tocado;
- `git diff --check`;
- `rg` direcionado para garantir que a pendencia saiu;
- Lighthouse limpo com mediana antes/depois quando runtime for afetado;
- axe ou Lighthouse accessibility quando UI mudar;
- smoke HTTP para `robots.txt`, sitemap e headers quando SEO/infra mudar;
- sessao + `specs/backlog.md` + `project-state.md` atualizados.

## Harness T1

Comando local:

```powershell
pnpm quality:lighthouse
```

Padrao do harness:

- URLs: `https://beta.artificiorpg.com/`, `https://glossariobeta.artificiorpg.com/`, `https://mesasbeta.artificiorpg.com/`.
- Perfis: `mobile` e `desktop`.
- Repeticoes: 3 por URL/perfil.
- Artefatos: `artifacts/lighthouse/<timestamp>/`, com JSON/HTML por rodada e `summary.json` com medianas.
- Limpeza: cada rodada usa `--user-data-dir` temporario, `--headless=new`, `--disable-extensions`, `--disable-default-apps`, `--disable-sync` e flags anti-background.
- Sem Chrome do mantenedor: o script usa Lighthouse CLI/Chrome limpo; nao usa plugin Chrome, perfil logado, cookies ou extensoes do mantenedor.

Opcoes uteis:

```powershell
pnpm quality:lighthouse --dry-run
pnpm quality:lighthouse --url https://beta.artificiorpg.com/ --profile mobile --runs 1
pnpm quality:lighthouse --out artifacts/lighthouse/manual-025
```

Dependencia: `lighthouse` esta versionado como devDependency root. Se precisar usar binario externo, `LIGHTHOUSE_BIN` continua suportado.

## Ordem de execucao recomendada

1. `BL-QA-LH-HARNESS`
2. `BL-QA-SHELL-CLS`
3. `BL-QA-GLOSSARIO-PERF`
4. `BL-QA-ROBOTS-SEO`
5. `BL-QA-SITE-IMAGES`
6. `BL-QA-A11Y-SWEEP`
7. `BL-QA-MESAS-PERF`
8. `BL-QA-SECURITY-HEADERS`
9. `BL-QA-THIRD-PARTY`

Motivo: medir limpo; corrigir problemas pequenos e claros; depois atacar fatias maiores de app/infra.
