# Site (blog Astro SSG) — imagem única: instala deps + builda pacotes compartilhados + BUILDA O ASTRO.
#
# O `astro build` roda AQUI, na imagem, desde 2026-08-17 (sessão 26-08-17_1). Antes rodava só no
# entrypoint, e o comentário desta linha dizia que era "porque depende do DB+WP". Isso deixou de ser
# verdade duas vezes: o WordPress foi removido em 2026-07-27, e o Astro NUNCA leu o banco — quem lê
# é `db/export.ts`, que materializa `src/data/{posts,pages}.json` justamente para "desacoplar o build
# do banco" (comentário do próprio arquivo). Busca negativa que confirma: nada em `apps/site/src`
# importa `connection`, `getDb` ou `DATABASE_URL`.
#
# Por que mudou: build em runtime significa build sob o `mem_limit` do container e sob `restart:
# always`. Em 2026-08-17 o `astro build` estourou o heap (259 MB disponíveis, ~300 MB necessários) e
# o container entrou em loop infinito — 127% de CPU, `RestartCount` 8→31, sem nada que o segurasse.
# O CI passou verde no mesmo commit porque no runner do GitHub sobra memória. Buildando na imagem, a
# falha volta a acontecer onde deve: no build, visível no CI, antes de qualquer container subir.
#
# base slim (glibc) p/ o binário do Pagefind (musl/alpine daria problema).
FROM node:24-slim

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Deps do workspace (inclui devDeps: astro/tsx/pagefind/tailwind — necessárias p/ o build em runtime).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/site ./apps/site
COPY apps/site-admin ./apps/site-admin
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Fail-fast: verifica que cloudinary foi instalado (dep de @artificio/media).
RUN test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado em packages/media/node_modules/" && exit 1)

# Builda os pacotes que o site consome (tsc -> dist) + a SPA admin (vite -> apps/site-admin/dist).
# A SPA admin builda na imagem (não depende de DB/WP, ao contrário do Astro público que builda no entrypoint).
RUN pnpm -w turbo run build \
  --filter=@artificio/config --filter=@artificio/auth --filter=@artificio/ui \
  --filter=@artificio/content --filter=@artificio/analytics \
  --filter=@artificio/feedback --filter=@artificio/media \
  --filter=@artificio/comments --filter=@artificio/content-editor \
  --filter=@artificio/site-admin

# Fail-fast dos pacotes da conversa (T6.4, spec 090). Esta lista de `--filter` é
# uma ALLOWLIST: pacote ausente dela não é construído, o `dist` não existe, e a
# falha só aparece no entrypoint — em runtime, já no ar. É a forma exata dos
# incidentes E016/E017 (SSO fora por 5h em 2026-08-08) e E021 (dependência
# transitiva podada do store). `content-editor` entra porque `@artificio/comments`
# o consome para sanitizar o corpo legado (`CommentsConversation.tsx`), e
# transitiva não construída falha igual à direta.
RUN test -d packages/comments/dist && test -d packages/content-editor/dist \
  || (echo "ERRO: dist de @artificio/comments ou content-editor ausente" && exit 1)

WORKDIR /repo/apps/site

# Build do site público NA IMAGEM, a partir dos JSONs versionados em `src/data/`.
#
# O QUE ESTE BUILD É, E O QUE NÃO É. Ele existe para que a falha do `astro build` aconteça AQUI —
# no build da imagem, visível no CI — e não no boot do container em produção. Esse é o ganho
# principal e ele é completo: um heap insuficiente, um componente quebrado ou um asset corrompido
# param o deploy antes de qualquer container subir.
#
# Ele NÃO é um espelho do site em produção. `src/data/posts.json` está versionado, mas é um seed
# congelado desde a PR #113: tem 8 posts, contra 125 no banco (medido em 2026-08-17). O conteúdo
# real vem de `db/export.ts` no entrypoint, que sobrescreve estes JSONs antes do rebuild. Por isso
# o entrypoint trata o `dist` da imagem como REDE DE SEGURANÇA EXPLÍCITA e barulhenta, nunca como
# substituto silencioso do conteúdo real — servir 8 de 125 posts sem avisar leria como perda de
# dados, que é pior que falhar.
#
# `--max-old-space-size` explícito porque o heap do V8 é derivado do cgroup quando não se declara
# nada: com `memory: 512m` no compose, o Node enxergava 259 MB (medido via `v8.getHeapStatistics()`)
# e o build precisa de ~300 MB. O heap deixa de ser efeito colateral do `mem_limit` e passa a ser
# escolha explícita — quem mexer em um não muda o outro sem perceber.
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN pnpm run build

# Fail-fast do build do site: se o Astro não gerou `index.html`, a imagem não presta. Falhar aqui é
# falhar no CI; sem esta linha a ausência só apareceria no container, em runtime, já no ar.
RUN test -f dist/index.html \
  || (echo "ERRO: astro build nao gerou dist/index.html" && exit 1)

# Marca este `dist` como "vindo da imagem" (conteúdo do seed, não do banco). O entrypoint usa o
# arquivo para decidir se precisa rebuildar com conteúdo real e, se o rebuild falhar, para AVISAR
# no log que o site está no ar com conteúdo parcial. `db/export.ts` + rebuild bem-sucedido apagam
# a marca. Sem isto, um `dist` de 8 posts seria indistinguível de um `dist` de 125.
RUN touch dist/.seed-build

RUN chmod +x docker-entrypoint.sh
RUN chown -R node:node /repo
USER node
EXPOSE 4322
ENTRYPOINT ["./docker-entrypoint.sh"]
