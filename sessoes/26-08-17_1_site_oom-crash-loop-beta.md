# 26-08-17_1 · `site` — OOM no build do container, crash loop e o mesmo defeito armado em prod

**Estado:** aberta · causa raiz medida · **correção implementada e testada localmente, sem commit** · crash loop **contido** (`site-beta-app` parado com autorização em 2026-08-17 23:49)
**Branch sugerida:** `fix/site-oom-build-container` (partir de `dev` atualizado)
**Origem:** deploy de beta do `site` disparado após o merge da PR #270 (spec 092), run `32079093164`, `failure`. `mesas` e `downloads` (runs `32079081040` e `32079087349`) subiram verdes no mesmo lote.

---

## Resultado da investigação, em uma linha

O `astro build` que roda **dentro do container** no entrypoint estoura o heap do Node (`heap_limit_MB=259`, medido) e mata o container; como o build nunca completa, o guard de resiliência do entrypoint nunca dispara, e o `restart: always` transforma uma falha determinística em loop infinito de ~128% de CPU.

## Medições

| o quê | comando | resultado |
|---|---|---|
| falha do deploy | `gh run view 32079093164 --log-failed` | `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`; `Command was killed with SIGABRT: astro build` |
| onde estourou | mesmo log, bloco `Last few GCs` | `Mark-Compact 253.8 (256.7) -> 253.2 (258.2) MB` — teto batido em ~253 MB |
| heap que o Node enxerga | `docker exec site-beta-app node -e "...getHeapStatistics().heap_size_limit..."` | **`heap_limit_MB=259`** |
| heap em **prod** | `docker exec site-prod-app` idem | **`prod_heap_limit_MB=259`** (idêntico) |
| limite do container | `docker inspect site-beta-app` | `Memory=536870912` (512 MiB), de `docker-compose.beta.yml:58` |
| política de restart | `docker inspect` | `RestartPolicy=always:0` — sem limite de tentativas |
| escalada do loop | `docker inspect ... RestartCount` em 3 momentos | **8 → 10 → 31** durante a investigação |
| consumo de CPU | `docker stats --no-stream`, 4 amostras | `site-beta-app` **129,32% / 127,57%**; todo o resto da VM ≤ 2,4% |
| RAM da VM | `free -m` | 23974 MB total, **21 GB disponíveis** — a máquina está folgada |
| load average | `uptime` | `3.19 / 4.29 / 4.85` (1/5/15 min) |
| último deploy verde do site em beta | `gh run list` + `gh run view --json headSha` | run `31892180665`, SHA `ea363f7a`, **2026-08-15** |

## Causa raiz — três defeitos, não um

### 1. O heap não cabe no build, e ninguém escolheu esse heap

Não existe `NODE_OPTIONS`/`--max-old-space-size` em lugar nenhum de `apps/site` (grep negativo em `*.json`, `*.yml`, `*.sh`, `Dockerfile`). O V8 deriva o old space do que o cgroup expõe: 512 MiB de container → **259 MB de heap**. Ou seja, **o heap do Node é hoje um efeito colateral do `mem_limit`** — quem mexer em um muda o outro sem perceber.

`memory: 512m` é o padrão do repo (todos os apps usam; `glossario` usa 384m). A diferença é que **o `site` é o único app que roda um build completo em runtime**: os outros servem artefato pronto. `git log -S "memory: 512m"` mostra que o valor é antigo (anterior a `be7fafd`) — **o limite não mudou; o custo do build é que cresceu**.

### 2. O guard de resiliência não protege contra o caso para o qual foi escrito

`apps/site/docker-entrypoint.sh`:

```sh
if [ -f dist/index.html ] && [ "${SITE_FORCE_REBUILD:-false}" != "true" ]; then
  echo "[site] dist presente — serve direto (restart sem rebuild)"
  exec pnpm run serve
fi
```

O comentário acima dele diz, literalmente, que serve para "mesmo container reiniciando por **OOM**/reboot/restart:always". Só que ele testa o **resultado** de um build bem-sucedido. Quando o OOM acontece no *primeiro* build, `dist/index.html` nunca existe, o guard nunca dispara, e cada restart refaz `migrate` + `export` (125 posts) + `astro build` do zero. Confirmado no log do container: as últimas linhas são sempre `[rebuild] astro build -> dist.a`, nunca `dist presente`.

**Container que morre e fica morto é diagnosticável; container que ressuscita para morrer de novo esconde a causa e queima CPU.**

### 3. O CI não cobre o caminho que quebrou

O build do Docker passou inteiro (`12 successful, 12 total`, incluindo o guard `test -d packages/comments/dist`). O `astro build` **do conteúdo** só roda no entrypoint, dentro do limite de memória — o CI builda no runner do GitHub, com memória de sobra. Por isso o merge ficou verde num commit que não sobe. É a mesma forma dos incidentes **E016/E017** citados no próprio `Dockerfile`: verde no CI, quebra no container.

## O que mudou desde o último verde (e o que NÃO foi a causa)

`git diff --stat ea363f7a..e6332c2 -- apps/site` → 17 arquivos, 1729 inserções. O que entrou foi a **spec 090 fase 6**: `apps/site/src/pages/blog/[slug].astro` passou a montar `<PostConversation client:visible postId={...} />`, e esse template roda **`getStaticPaths()` para 125 posts** (`export: 125 posts -> posts.json`, medido no log). É a **única ilha hidratada de todo o site** (grep `client:` em `src/pages` + `src/layouts` devolve só esta). O `packages/comments` que ela arrasta cresceu junto: `facadeRelay.ts` (417 linhas), `useConversationHost.tsx` (340), mais React e `@artificio/content-editor`.

**Não foi o CSS da spec 092.** O merge de hoje mudou 20 linhas em `apps/site/src/styles/global.css` e **não tocou** `Dockerfile` nem os composes (`git diff --stat bcab6fb..e6332c2` nesses arquivos volta vazio).

**Não confundir com a falha de 15/08** (run `31891719698`): aquela foi `cannot lock ref 'refs/remotes/origin/dev'`, corrida de git na VM, resolvida no retry 10 min depois.

## Risco aberto em produção

`site-prod-app` está `Up 2 days (healthy)`, 0,19% de CPU, 205 MiB — **mas só porque tem `dist` de um build antigo e o guard serve direto**. O heap medido lá é o mesmo `259`, e `docker-compose.prod.yml:58` tem o mesmo `memory: 512m`.

**No próximo deploy de prod do `site`, o mesmo OOM acontece em produção.** Não deployar `site` em prod até isto estar corrigido.

## Correção implementada (2026-08-17, testada localmente, **sem commit**)

A correção não é subir o limite de memória — isso só adia. **O `astro build` saiu do runtime e passou a rodar na imagem**, que é onde a falha pode ser vista antes de chegar em produção.

A premissa que mantinha o build no entrypoint estava desatualizada. O `Dockerfile` dizia "o build do Astro NÃO roda na imagem (depende do DB+WP)": o WP saiu em 2026-07-27, e o Astro **nunca** leu o banco — quem lê é `db/export.ts`, que materializa `src/data/*.json` justamente para "desacoplar o build do banco" (comentário do próprio arquivo). Busca negativa que confirma: nada em `apps/site/src` importa `connection`, `getDb` ou `DATABASE_URL`.

| # | mudança | arquivo | o que resolve |
|---|---|---|---|
| 1 | `pnpm run build` na imagem + fail-fast `test -f dist/index.html` | `Dockerfile` | falha de build volta a acontecer **no CI**, antes de qualquer container subir |
| 2 | `NODE_OPTIONS=--max-old-space-size` explícito (1024 na imagem, 768 em runtime) | `Dockerfile`, ambos composes | heap deixa de ser efeito colateral do `mem_limit` |
| 3 | `memory: 512m` → `1g` | ambos composes | o heap de 768 MB precisa caber no cgroup, senão o OOM do V8 vira OOM-kill do kernel (pior: sem rastro no log) |
| 4 | rebuild degrada em vez de derrubar (`rebuild_rc`, sem `set -e` matando o boot) | `docker-entrypoint.sh` | **mata o loop**: falha de rebuild deixa o site no ar servindo `dist`, em vez de reiniciar para sempre |
| 5 | marca `dist/.seed-build` | `Dockerfile`, `docker-entrypoint.sh` | impede que o seed de 8 posts seja servido **silenciosamente** no lugar dos 125 reais |

### Por que a marca `.seed-build` existe

`src/data/posts.json` **está versionado, mas é um seed congelado desde a PR #113: 8 posts, contra 125 no banco** (medido). Sem a marca, o `dist` da imagem seria indistinguível de um `dist` real, e um rebuild falho serviria 8 de 125 posts sem avisar — que lê como perda de dados. Com a marca, o guard de restart não dispara sobre o seed (força rebuild) e, se o rebuild falhar, o log grita que o conteúdo é parcial e que **o banco está intacto**.

### Testes executados

| teste | resultado |
|---|---|
| reprodução local do OOM (`--max-old-space-size=259`) | **falha idêntica** — `FATAL ERROR`, ~253 MB, `EXIT=134` (SIGABRT) |
| piso real do heap (259 / 320 / 384 / 512 / 768) | **259 falha; 320 em diante passa** — faltavam ~41 MB |
| `pnpm run build` (comando exato do Dockerfile, Astro + pagefind) | `EXIT=0`, `dist/index.html` gerado, pagefind indexou 8 páginas |
| fail-fast `test -f dist/index.html` | passa |
| 5 caminhos do entrypoint (A–E, simulados) | todos corretos; **caso C (o incidente) agora sai `EXIT=0` servindo com alerta, em vez de reiniciar** |
| `sh -n` (POSIX) | OK |
| `shellcheck -s sh` | **exit 0** — pegou e corrigiu um SC2319 real (`$?` dentro de `elif` reportaria código errado) |
| YAML dos dois composes (parse + valores efetivos) | válido; `mem=1g`, heap 768 MB, folga de 256 MB |
| `vitest run` em `apps/site` | **89/89 passam** (10 arquivos) |

### Não testado, e por quê

**`docker build` real não rodou: Docker Desktop está fora** (`failed to connect to the docker API`). O comando de dentro do `RUN` foi validado isoladamente, mas a construção da imagem em si — ordem de camadas, `chown`, o `dist` sobrevivendo até o runtime — só será exercitada no CI.

### Lacuna de cobertura encontrada de passagem

`_lint-shell.yml` roda shellcheck com **`scandir: ./scripts`** — `apps/*/docker-entrypoint.sh` **não é coberto**. O SC2319 que introduzi teria passado verde no CI; peguei por rodar o shellcheck local. Não ampliei o escopo do gate: endurecer gate exige verde comprovado antes, e a decisão é do mantenedor.

### Fora de escopo, aguardando decisão do mantenedor

Reduzir o custo do build em si (a ilha `client:visible` roda nos 125 posts) **muda comportamento observável do produto** — carregar a conversa sob demanda em vez de por scroll. As 5 mudanças acima não alteram nada do que o leitor vê.

## Contenção executada (2026-08-17 ~23:49)

`docker stop site-beta-app`, com autorização nominal do mantenedor. **`RestartCount` estava em 99** no momento da parada — tinha subido de 31 para 99 depois da medição anterior, o que dimensiona o custo de ter deixado o loop correndo durante a investigação.

Efeito medido ~20s depois:

| métrica | durante o loop | após o stop |
|---|---|---|
| load average (1/5/15 min) | `3.19 / 4.29 / 4.85` | `1.20 / 1.99 / 2.73` |
| maior consumidor de CPU | `site-beta-app` **127–129%** | `mesas-beta-db` **2,74%** |

`site-beta-app` = `Exited (1)`, sem reiniciar. `site-beta-db` = `Up (healthy)`, dado intacto. Reverter é `docker start site-beta-app` — mas isso só recolocaria o loop, porque a imagem em beta ainda é a defeituosa.

## Pendência

`beta.artificiorpg.com` está **fora do ar** (deliberadamente: o container parado é preferível ao loop). Volta com um deploy novo, depois que a correção acima for commitada e mergeada — **nada disso foi autorizado ainda**.

`site-prod-app` segue `Up (healthy)`, servindo `dist` antigo. **Não deployar `site` em prod antes da correção**: o heap medido lá é o mesmo 259 e o próximo rebuild bate no mesmo OOM.

## Achado lateral (não investigado)

O push de `998ccf9` trouxe aviso do GitHub: **33 vulnerabilidades Dependabot na branch default** (19 high, 10 moderate, 4 low). Não medido, não relacionado a esta falha.
