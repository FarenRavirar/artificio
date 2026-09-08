# 019 — D-INFRA2: auditoria de fonte unica compartilhada

- **Modulo/Pacote:** infra / monorepo (`apps/*`, `packages/*`, `.github`, scripts)
- **Gate relacionado:** nenhum

## Problema
D062 fixou que tudo que e compartilhado deve ter fonte unica importavel em `packages/*`, nunca copia/sync solto. A spec 017 fechou um caso concreto (favicon, tema, rodape), mas o backlog D-INFRA2 ainda exige uma auditoria ampla do monorepo para localizar outras duplicacoes que podem virar fonte unica.

Esta spec e **investigativa e preparatoria**. Ela nao autoriza refatoracao geral. O resultado esperado e inventario classificado + backlog de sub-specs pequenas, cada uma com SDD proprio quando tocar `packages/*`, auth, SEO, deploy ou infra compartilhada.

## Requisitos (numerados, testaveis)
- **R1** — Auditar, em modo read-only, duplicacoes/candidatos nas categorias: assets de marca, tema/cookie, shell/chrome, auth/fetch/session, analytics/SEO/content, normalizers/guards, copy/terminologia publica, Docker/deploy/scripts, CSS tokens e config/env/domain constants.
- **R2** — Para cada achado, registrar: ID, arquivos/linhas, tipo, duplicacao observada, fonte unica candidata, consumidores afetados, risco, beneficio, SDD necessario, prioridade sugerida, encaminhamento e se a duplicacao e legitima.
- **R3** — Separar explicitamente: candidatos fortes para centralizar agora, candidatos que precisam de decisao do mantenedor, duplicacoes aceitaveis/intencionais, riscos de centralizar cedo demais e backlog recomendado em ordem.
- **R4** — Nao alterar codigo funcional, contratos, workflows, infra, deploy, banco, DNS, VM ou producao nesta spec.
- **R5** — Toda implementacao futura que toque `packages/*`, auth, SEO estrutural, deploy/CI ou config compartilhada deve virar SDD Completo proprio.
- **R6** — Incluir no backlog da propria spec um pacote visual unico: auditoria de diferencas de cor/tema/nav, usando **as cores do glossario como base visual**, **nav base do glossario** como referencia de estrutura, e **estilo de notificacao/changelog do mesas** como referencia para a area de acoes do header.
- **R7** — A unificacao visual futura deve incluir, no mesmo fluxo, o controle lua/sol de tema compartilhado, sem habilitar dark mode onde CSS dark ainda nao estiver completo.
- **R8** — Auditar tambem estrutura de paginas e sugerir unificacoes: page frames, headings, filtros, cards, formularios, tabelas, estados vazios/carregando/erro, espacamento, raio, sombra e responsividade. A auditoria deve separar templates compartilhaveis de diferencas legitimas por produto.

## Criterios de aceite
- `plan.md` contem inventario detalhado dos achados com evidencias de busca.
- `tasks.md` contem backlog recomendado em ordem, quebrado em specs/issues/notas.
- Sessao `sessoes/26-06-12_4_infra_fonte-unica-auditoria.md` registra evidencias, comandos read-only e fechamento.
- `git status` final mostra apenas documentacao da investigacao/spec (sem codigo funcional).

## Fora de escopo
- Implementar centralizacoes.
- Remover duplicacoes.
- Alterar `packages/*` runtime, apps, CSS, auth, deploy ou workflows.
- Gate C, WordPress raiz, DNS, Cloudflare Tunnel, VM Oracle, deploy/producao.
- Commit/push/merge/workflow dispatch.

## Riscos e impacto em outros modulos
- Centralizar cedo demais pode congelar variacoes legitimas de produto, criar coupling entre apps ou ampliar blast radius de bugs em `packages/*`.
- Auth/session, Header/Footer, SEO/content e deploy sao superficies compartilhadas sensiveis; qualquer mudanca futura exige SDD Completo e smoke cross-modulo.
- O site usa Astro/SSG e pode precisar de espelhos intencionais para evitar React no publico zero-JS; nem toda duplicacao visual e erro.
- A direcao visual registrada pelo mantenedor para a proxima spec derivada e: glossario como base de cores/nav; mesas como base de UX para notificacao/changelog.
- Nem toda pagina deve ficar igual: site editorial zero-JS, accounts login e mesas/catalogo podem manter personalidade propria. O alvo e uma gramatica visual comum, nao homogeneizacao cega.
