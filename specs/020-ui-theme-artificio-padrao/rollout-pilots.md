# Rollout piloto — Spec 020

Status: **plano fechado**. Nao executa codigo, deploy, VM, commit ou push nesta revisao.

## Objetivo

Definir a ordem segura para evoluir o Theme Artificio padrao depois da fonte unica de tokens, com validacao e rollback por consumidor. O rollout evita "big bang": cada fatia deve ser pequena, reversivel e validada no app que muda antes de promover para o proximo.

Ordem canonica para esta spec:

1. `accounts`
2. `glossario`
3. `mesas`
4. `site`
5. `site-admin`

> **Nota:** esta ordem governa a **consolidacao/primitives restante** (dedup de helpers de tema, primitives/forms), onde `accounts` e o canario. A **variante lua/sol** (D065 glossario dark, D066 mesas light) ja executou **fora desta ordem** — glossario -> mesas primeiro, por prioridade do mantenedor — e ja esta em prod (D067). Portanto "accounts = piloto 1" se refere a consolidacao, nao a variante de tema, que ja rodou em glossario/mesas.

## Estado atual ja executado

- Fonte unica de tokens: feita em `packages/ui` (`tokens.ts`, CSS vars, Tailwind preset, paridade).
- Tema compartilhado: D067 em producao para apps afetados; cookie `artificio_theme` so e escrito em escolha explicita.
- `accounts`: ja tem login SSO, toggle lua/sol e comportamento D067 correto; ainda duplica helpers locais de tema.
- `glossario`: variante dark implementada e promovida; B6 fechado por aprovacao do mantenedor em prod registrada na sessao `26-06-13_1`.
- `mesas`: variante light implementada e promovida com default-dark; B7 fechado em 2026-06-15 por validacao do mantenedor em prod (`/perfil` light com dados + mestre com `banner_url` custom + smoke anti-regressao).
- `site`: caminho Astro/zero-JS fechado em T9; B2/T11 fechados com `@artificio/ui/static`.
- `site-admin`: admin React isolado; ainda candidato a primitives/forms/estado quando estas existirem.

## Regra de entrada comum

Antes de qualquer piloto que toque codigo:

- escopo do app/pacote explicitado em sessao;
- se tocar `packages/*`, SDD Completo + builds/smokes dos consumidores;
- nenhuma mudanca em auth, banco, deploy, VM ou producao sem aprovacao nominal;
- rollback definido antes do merge;
- `git status --short` revisado para nao misturar diff alheio;
- doc de spec/sessao atualizado antes da alteracao.

## Piloto 1 — accounts

Papel: menor superficie visual; SSO central; canario do tema compartilhado.

Escopo recomendado:
- manter tela de login compacta (`AuthPage`);
- remover duplicacao local de tema quando houver subpath/helper static-safe em `@artificio/ui`;
- preservar allowlist de `return` e fluxo Google;
- nao alterar contrato SSO.

Validacao:
- build `@artificio/accounts-frontend` e backend quando tocado;
- login page renderiza claro/escuro;
- toggle grava cookie somente em clique explicito;
- `/api/auth/me` sem cookie = 401;
- return URL permitido preservado; host externo sanitizado;
- smoke visual mobile para logo, botao Entrar e tema.

Rollback:
- desligar toggle visual ou voltar helper local de tema;
- manter endpoint/redirect SSO intocado;
- reverter apenas fatia visual.

Saida:
- login funcional;
- cookie `artificio_theme` confiavel;
- nenhuma regressao de auth.

## Piloto 2 — glossario

Papel: base clara/nav da suite; app de leitura com blast radius menor.

Escopo recomendado:
- validar dark opt-in com dados reais;
- manter `GlossarioHeader` como compositor do `Header` compartilhado;
- nao mover dados de changelog/notificacao/feedback para `packages/ui`;
- migrar primitives apenas quando T14 autorizar.

Validacao:
- build frontend/backend conforme arquivos tocados;
- `/api/terms` 200 em ambiente alvo;
- home claro/escuro, busca, filtros e resultados com dados;
- cards de termo, variantes, comentarios/votos e historico;
- admin review/users/structure/activity quando logado admin;
- AddTermModal, forms, selects, erro/empty/loading;
- contraste AA em texto normal/foco/disabled;
- troca tema sem flash;
- mobile drawer/nav.

Rollback:
- esconder acao lua/sol no header;
- manter CSS light original como fallback;
- reverter remap dark se contraste quebrar;
- nao tocar SSO/migration de dados.

Saida:
- B6 fechado; nova fatia so reabre com evidencia de regressao.

## Piloto 3 — mesas

Papel: app operacional pesado; referencia dark/actions; maior risco visual.

Escopo recomendado:
- preservar default-dark sem cookie;
- light so por escolha explicita via cookie compartilhado;
- manter telas auth-gated cobertas por regressao visual quando mexer no tema; B7 ja esta fechado por validacao do mantenedor;
- nao centralizar regra de negocio de mesa no theme.

Validacao:
- build frontend/backend quando tocados;
- publico `/` claro/escuro + mobile;
- `/api/v1/me/options` sem cookie = 401;
- sem cookie: `data-theme=dark`;
- com cookie `artificio_theme=light`: light opt-in;
- catalogo com dados, filtros, cards e paginacao;
- detalhe de mesa, CTA/sidebar/sticky mobile;
- painel mestre, gestao/admin, forms multi-step, modais/drawers, notificacao/changelog;
- contraste AA em light;
- smoke de login/return para accounts.

Rollback:
- esconder acao lua/sol;
- forcar fallback dark no boot;
- remover/neutralizar folha `[data-theme="light"]`;
- preservar `artificio_theme` sem apagar escolha do usuario global;
- se apenas visual quebrar, nao reverter SSO/backend.

Saida:
- B7 fechado em 2026-06-15; nova fatia so reabre com evidencia de regressao.

## Piloto 4 — site

Papel: publico SEO/SSG; precisa continuar static/zero-JS.

Escopo recomendado:
- resolver T11/B2: export/paridade static de brand/nav/footer sem importar barrel React;
- manter `SiteHeader.astro` e `SiteFooter.astro`;
- consumir `@artificio/ui/styles.css` e dados static-safe;
- nao introduzir React island no publico;
- manter WP raiz e Gate C intocados.

Validacao:
- `pnpm --filter @artificio/site build`;
- Astro `output: static`;
- `_astro` sem JS de shell; JS apenas Pagefind/GA4 quando esperado;
- `/`, `/blog/`, artigo, pagina institucional, `robots.txt`, `sitemap-index.xml`, `rss.xml`;
- canonical/OG/JSON-LD intactos;
- Pagefind lazy abre e busca;
- tema claro/escuro sem flash;
- `/admin/status` segue protegido (401 sem cookie);
- WP raiz fora de escopo.

Rollback:
- voltar imports do site para `@artificio/ui/brand`/`@artificio/ui/modules` se o subpath static falhar;
- voltar `Base.astro` ao import anterior de favicon;
- remover mudanca de shell static sem tocar conteudo/importador.

Saida:
- B2/T11 fechados; nova fatia do site deve preservar `@artificio/ui/static` e zero-JS do shell.

## Piloto 5 — site-admin

Papel: area operacional React isolada; boa candidata a primitives de forms/estado.

Escopo recomendado:
- so iniciar apos primitives minimas fecharem implementacao. **Dependencia transitiva:** site-admin -> primitives (T7/B4) -> tokens semanticos `success/warning/danger/info` (**B11**) + shadow/spacing canonicos. As variantes coloridas de `Button`/`Badge`/`Panel`/`State` (usadas pelo admin) so existem apos B11;
- migrar botao/campo/badge/panel/state de forma incremental;
- nao misturar admin React no bundle publico Astro;
- preservar fluxo editorial BlockNote/preview/rebuild.

Validacao:
- build `@artificio/site-admin`;
- lista de posts/paginas;
- editor de post/pagina;
- SEO panel;
- media library/picker;
- estados saving/error/toast;
- preview e publish quando backend disponivel;
- admin protegido por auth server-side no `apps/site`.

Rollback:
- manter CSS local `.btn`, `.card`, inputs e badges;
- reverter primitive por tela, nao o admin inteiro;
- manter backend/rebuild intocado.

Saida:
- admin continua isolado e funcional; primitives so avancam se reduzirem duplicacao real.

## Matriz resumida

| Ordem | Consumidor | Tipo | Estado | Fecha |
|---|---|---|---|---|
| 1 | `accounts` | SSO/login canario | runtime atual ok; duplicacao local futura | theme runtime consolidado sem regressao auth |
| 2 | `glossario` | base clara + dark opt-in | codigo promovido; E2E B6 validado pelo mantenedor | B6 fechado |
| 3 | `mesas` | dark operacional + light opt-in | codigo promovido; E2E B7 validado pelo mantenedor | B7 fechado |
| 4 | `site` | Astro/SSG/SEO | T9 fechado; B2/T11 pendente | B2/T11 |
| 5 | `site-admin` | admin React/forms | aguarda primitives | T14/primitives |

## Rollback global

Rollback deve ser por fatia:

- visual/theme: esconder toggle, voltar CSS local, manter tokens aliases;
- shared package: reverter commit do pacote + rebuild consumidores tocados;
- app isolado: reverter so o app;
- prod: usar fluxo GitHub/prod autorizado, nunca VM manual sem aprovacao;
- se duvida entre bug visual e regra historica: consultar sessoes/decisions antes de "corrigir".

## Validacao final de cada fatia

Todo piloto fecha com:

- busca/grep relevante provando ausencia de duplicacao proibida;
- build do pacote/app tocado;
- smoke desktop/mobile;
- contraste AA se tema/cores mudaram;
- sessao atualizada com evidencia;
- `project-state.md` atualizado se mudar estado operacional;
- rollback anotado.

## Criterio de fechamento T10

T10 fecha porque a ordem accounts → glossario → mesas → site/site-admin esta definida, cada piloto tem criterio de entrada, validacao, saida e rollback, e o estado real ja executado em dev/prod foi separado do residual T14. B6, B7 e B2 foram fechados depois.
