# =============================================================================
# Backend — Anúncios de Mesas RPG
# Node.js API + CleanupWorker
# =============================================================================

# Estágio 1: build TypeScript
FROM node:24-alpine AS builder

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/mesas ./apps/mesas
COPY patches ./patches

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/mesas-backend

# =============================================================================
# Estágio 2: imagem de produção (apenas o necessário)
FROM node:24-alpine AS production

WORKDIR /repo
ENV NODE_PATH=/repo/apps/mesas/backend/node_modules

# Pisos de versão em curl/libcurl/c-ares/libexpat (achado Snyk + nitpick Codex,
# spec 081, 2026-07-18): CVEs abertos na imagem base (alpine 3.23) —
# CVE-2026-6276 (SSRF/cleartext alto), CVE-2026-5773 (SSRF), CVE-2026-7168
# (auth bypass), CVE-2026-56131/... (expat use-after-free/integer overflow).
# --upgrade obrigatório: sem ele o apk não troca a lib se a base já satisfaz a
# dependência com a versão vulnerável instalada, reabrindo o CVE em silêncio.
#
# `>=` e não `=`: pin de patch EXATO contra mirror rolling já quebrou o deploy
# três vezes — libexpat=2.8.1-r0 (2026-07-16), curl=8.20.0-r0 (2026-07-18) e
# libexpat=2.8.2-r0 (2026-08-21, run 32435929546: "libexpat-2.8.3-r0 breaks:
# world[libexpat=2.8.2-r0]"). O mecanismo é sempre o mesmo: o Alpine promove o
# patch, a versão antiga sai de catálogo e o `=` passa a pedir algo que não
# existe mais. O comentário do frontend já chamava isso de "bomba-relógio
# certa" — e continuou explodindo porque a lição virou texto, não regra.
# O piso preserva o que o pin protegia (apk recusa versão abaixo do corte, logo
# nenhum CVE listado acima volta) e para de quebrar sozinho no bump de patch.
# Medido na VM em 2026-08-21 (`docker run --rm node:24-alpine apk policy`):
# c-ares 1.34.8-r0, curl/libcurl 8.21.0-r0, libexpat 2.8.3-r0.
RUN apk add --no-cache --upgrade \
    "curl>=8.21.0-r0" \
    "libcurl>=8.21.0-r0" \
    "c-ares>=1.34.8-r0" \
    "libexpat>=2.8.3-r0"

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/mesas/backend/package.json ./apps/mesas/backend/package.json
COPY patches ./patches

# pnpm --prod nao instala deps de workspace packages no node_modules local
# (achado spec 062/PR #145, reconfirmado spec 080: config/auth/catalog-client
# tem deps proprias - zod, jsonwebtoken - que ficam ausentes em runtime se so
# o app for filtrado). Instalar cada pacote workspace usado em runtime.
RUN pnpm install --prod --filter @artificio/mesas-backend --filter @artificio/config \
  --filter @artificio/content --filter @artificio/auth --filter @artificio/changelog \
  --filter @artificio/feedback --filter @artificio/media --filter @artificio/catalog-client \
  --filter @artificio/content-editor --filter @artificio/comments \
  --filter @artificio/catalog-matching \
  --frozen-lockfile

# Asserção separada do install de propósito (achado de review, PR #268): no
# encadeamento anterior (`pnpm install && test ... || echo ERRO`), falha de rede
# ou lockfile caía no mesmo `||` e era reportada como "dependencia de pacote
# workspace ausente" — diagnóstico errado num build que quebra por outro motivo.
# Agora o install falha por conta própria, e esta mensagem só cobre o que ela
# de fato descreve.
#
# O Sonar pede o contrário ("Merge this RUN instruction with the consecutive
# ones") e foi **recusado com medição**: a regra existe para evitar camada
# desnecessária, e um `RUN` que só roda `test -d` não escreve nada — medido em
# `alpine:3.20`, a camada sai com **4,1 kB** (metadado), contra 453 MB da camada
# de install. Juntar de volta economizaria 0,0009% da imagem e devolveria o
# diagnóstico errado que o Codex apontou. Não juntar.
RUN test -d packages/media/node_modules/cloudinary \
  && test -d packages/comments/node_modules/zod \
  || (echo "ERRO: dependencia de pacote workspace ausente em packages/*/node_modules/" && exit 1)

# Workspace packages are linked in production; copy built outputs they export at runtime.
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/content/dist ./packages/content/dist
# Spec 089: content passou a emitir CJS e `main` aponta para dist-cjs — sem esta
# linha o container sobe e crasha com MODULE_NOT_FOUND (padrao E016/E017).
COPY --from=builder /repo/packages/content/dist-cjs ./packages/content/dist-cjs
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/changelog/dist-cjs ./packages/changelog/dist-cjs
COPY --from=builder /repo/packages/feedback/dist ./packages/feedback/dist
COPY --from=builder /repo/packages/feedback/dist-cjs ./packages/feedback/dist-cjs
COPY --from=builder /repo/packages/media/dist ./packages/media/dist
# Achado deploy beta (PR #145, spec 062): catalog-client novo faltava aqui —
# MODULE_NOT_FOUND em runtime (dist-cjs so existia no estagio builder).
COPY --from=builder /repo/packages/catalog-client/dist ./packages/catalog-client/dist
COPY --from=builder /repo/packages/catalog-client/dist-cjs ./packages/catalog-client/dist-cjs
# catalog-matching: importado por parseDiscordAnnouncement/gmPanel desde a 093
# (normalizeSettingStyles) e, desde a T7.1b da spec 096, também pelas funções de
# scoring — a cópia local `systemSuggestionCandidates.ts` (561 linhas idênticas
# ao pacote) foi apagada e os dois importadores passaram a ler daqui.
# Faltava aqui — mesma classe de E016/E017: build e CI verdes, container crasha
# com MODULE_NOT_FOUND só ao subir. Tem `main`, então precisa de dist E dist-cjs.
COPY --from=builder /repo/packages/catalog-matching/dist ./packages/catalog-matching/dist
COPY --from=builder /repo/packages/catalog-matching/dist-cjs ./packages/catalog-matching/dist-cjs
# Mesmo padrao de E016/E017: utils/userMarkdown.ts importa
# @artificio/content-editor/sanitize. Aqui entra o `dist` (ESM), nao o
# dist-cjs: este backend e "type": "module" + moduleResolution NodeNext, entao
# resolve o subpath pela condicao `import`. O filtro no pnpm install acima e
# necessario porque o pacote tem deps proprias (sanitize-html, markdown-it).
COPY --from=builder /repo/packages/content-editor/dist ./packages/content-editor/dist
# Spec 090 T7 (achado de review, PR #268 — mesmo padrao E016/E017): as rotas
# novas (`community/tableSubjectGuard.ts`, `routes/communityModeration.ts`)
# importam `@artificio/comments` e sao carregadas por `server.ts` no boot, entao
# a falta do `dist` derruba o container no healthcheck, com build e CI verdes.
#
# `dist` (ESM) e nao `dist-cjs`, apesar de o pacote declarar `main`: este backend
# e "type": "module", entao a resolucao usa a condicao `import` do `exports`.
#
# `@artificio/ui` NAO acompanha, diferente do Dockerfile do `downloads`: medido
# no `dist` publicado, so `CommunityModerationWorkspace.js` (React, exportado
# por `/react`) o importa. O caminho que este backend carrega — `index.js` e os
# 12 modulos que ele reexporta — depende apenas de `zod` e de
# `@artificio/content-editor`, ja presentes acima.
COPY --from=builder /repo/packages/comments/dist ./packages/comments/dist

# Copiar build compilado
COPY --from=builder /repo/apps/mesas/backend/dist ./apps/mesas/backend/dist

# Copiar arquivos de dados de sistemas e cenários (JSON)
COPY --from=builder /repo/apps/mesas/backend/sistemas.json ./apps/mesas/backend/sistemas.json
COPY --from=builder /repo/apps/mesas/backend/cenarios.json ./apps/mesas/backend/cenarios.json
COPY --from=builder /repo/apps/mesas/database/changelogs.json ./apps/mesas/backend/database/changelogs.json
# WS4: diretório de logs gravável pelo usuário node (REV-037: RUN único).
RUN chown -R node:node /repo \
    && mkdir -p /app/logs \
    && chown node:node /app/logs

USER node

WORKDIR /repo/apps/mesas/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
