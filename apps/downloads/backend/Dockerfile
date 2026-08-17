# =============================================================================
# Backend — Downloads RPG
# Node.js API (Express/Kysely/Postgres)
# =============================================================================

# Estágio 1: build TypeScript
# node:24-slim (Debian/glibc), nao alpine — achado de review PR #195 (codex):
# Patchright (Modo 2a, spec 084) exige apt-get + glibc para instalar Chromium;
# Alpine (musl) nao e suportado oficialmente por Playwright/Patchright.
FROM node:24-slim AS builder

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/downloads ./apps/downloads
COPY patches ./patches

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/downloads-backend

# =============================================================================
# Estágio 2: imagem de produção (apenas o necessário)
FROM node:24-slim AS production

WORKDIR /repo
ENV NODE_PATH=/repo/apps/downloads/backend/node_modules

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/downloads/backend/package.json ./apps/downloads/backend/package.json
COPY patches ./patches

# `pnpm --prod` filtrando so o app nao instala as deps dos pacotes workspace
# (mesmo motivo ja documentado em apps/mesas/backend/Dockerfile): content-editor
# depende de sanitize-html e markdown-it, e dist-cjs/sanitize.js faz require nos
# dois no boot. Sem este filtro a imagem cai com MODULE_NOT_FOUND antes de
# servir qualquer rota (achado de review PR #227).
# auth/config/catalog-client tem dep externa propria (jsonwebtoken, zod) e o
# require sai de dentro do dist-cjs deles. Hoje o app declara jsonwebtoken e zod
# como dep direta, entao a resolucao ascendente do Node acha por acaso — remover
# essas libs do package.json do app derrubaria o container com o CI verde.
# Filtrar explicitamente troca a coincidencia por garantia (padrao E016/E017).
# `catalog-matching` e `changelog` entraram em 2026-08-08, quando o gate passou a
# resolver dependencia TRANSITIVA e a cobrar `--filter`. Nao quebravam: os dois
# tem `dependencies: {}`, entao nao ha nada no `.pnpm` para podar. Entram porque
# o dia em que qualquer um deles ganhar uma dep externa, o container cai em
# producao com o CI verde — e `catalog-matching` e justamente o pacote do E017.
RUN pnpm install --prod --filter @artificio/downloads-backend --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/email --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/content --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/content-editor --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/auth --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/config --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/catalog-client --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/catalog-matching --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/changelog --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/comments --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/ui --frozen-lockfile --ignore-scripts

# Asserção separada dos installs de propósito (achado de review, PR #268): no
# encadeamento anterior os 12 `pnpm install` dividiam o `||` com os `test -d`,
# então falha de rede ou lockfile em qualquer um deles era reportada como
# "dependencia de pacote workspace ausente" — diagnóstico errado num build que
# quebra por outro motivo. Agora os installs falham por conta própria.
#
# O Sonar pede o contrário ("Merge this RUN instruction with the consecutive
# ones") e foi **recusado com medição**: a regra existe para evitar camada
# desnecessária, e um `RUN` que só roda `test -d` não escreve nada — medido em
# `alpine:3.20`, a camada sai com **4,1 kB** (metadado), contra 453 MB da camada
# de install desta imagem. Juntar de volta economizaria 0,0009% e devolveria o
# diagnóstico errado que o Codex apontou. Não juntar.
RUN test -d packages/media/node_modules/cloudinary \
  && test -d packages/media/node_modules/ipaddr.js \
  && test -d packages/content-editor/node_modules/sanitize-html \
  && test -d packages/content-editor/node_modules/markdown-it \
  && test -d packages/content-editor/node_modules/dompurify \
  && test -d packages/email/node_modules/resend \
  && test -d packages/auth/node_modules/jsonwebtoken \
  && test -d packages/config/node_modules/zod \
  && test -d packages/catalog-client/node_modules/zod \
  && test -d packages/comments/node_modules/zod \
  || (echo "ERRO: dependencia de pacote workspace ausente em packages/*/node_modules/" && exit 1)

# Achado de review PR #193 (codex) — scraper de spec 084 (Modo 2a/2b) precisa
# de runtime headless real na imagem: patchright exige Chromium instalado
# (patchright install --with-deps chromium), Camoufox exige venv Python com
# o pacote camoufox (subprocess chamado por camoufoxClient.ts). Sem isso a
# imagem builda mas qualquer fonte que cair no Modo 2a/2b quebra em runtime.
COPY apps/downloads/backend/scripts ./apps/downloads/backend/scripts

# Achado de review PR #195 (codex) — sem PLAYWRIGHT_BROWSERS_PATH fixo, o
# install roda como root (cache em /root/.cache/ms-playwright) mas o runtime
# roda como USER node (linha abaixo, HOME=/home/node): chromium.launch() em
# patchrightClient.ts nao acharia o browser instalado. Fixar o path dentro de
# /repo garante que o chown -R node:node /repo (mais abaixo) cubra o cache.
ENV PLAYWRIGHT_BROWSERS_PATH=/repo/.playwright-browsers

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv wget \
  && rm -rf /var/lib/apt/lists/* \
  && pnpm --filter @artificio/downloads-backend exec patchright install --with-deps chromium \
  && python3 -m venv ./apps/downloads/backend/scripts/camoufox/.venv \
  && ./apps/downloads/backend/scripts/camoufox/.venv/bin/pip install --no-cache-dir \
       -r ./apps/downloads/backend/scripts/camoufox/requirements.txt

# Workspace packages sao linkados em producao; copiar so o dist que exportam em runtime.
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/content/dist-cjs ./packages/content/dist-cjs
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
COPY --from=builder /repo/packages/media/dist ./packages/media/dist
COPY --from=builder /repo/packages/catalog-client/dist ./packages/catalog-client/dist
COPY --from=builder /repo/packages/catalog-client/dist-cjs ./packages/catalog-client/dist-cjs
# Achado real (deploy beta downloads, 2026-07-26, mesmo padrao de E016 —
# resend/email esquecido antes): scraperIngest.ts e systemSuggestionsAdmin.ts
# importam @artificio/catalog-matching (fase 4/9 da spec 086), mas o
# Dockerfile nunca copiou o dist/dist-cjs desse pacote pra imagem de
# producao — container subia mas crashava em runtime com MODULE_NOT_FOUND
# no 1o request que tocasse taxonomia.
COPY --from=builder /repo/packages/catalog-matching/dist ./packages/catalog-matching/dist
COPY --from=builder /repo/packages/catalog-matching/dist-cjs ./packages/catalog-matching/dist-cjs
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/changelog/dist-cjs ./packages/changelog/dist-cjs
COPY --from=builder /repo/packages/email/dist ./packages/email/dist
# Mesmo padrao de E016/E017: as rotas do backend (comments, materials, reports,
# moderation, ratings, admin, creators, materialMetadata, systemSuggestionsAdmin,
# materialTypeSuggestionsAdmin) importam @artificio/content-editor/sanitize.
# So o dist-cjs entra: o backend compila com module "CommonJS" e consome os
# subpaths de servidor; a raiz do pacote e React/TSX, usada so pelo frontend.
# Desde T2.2a/T2.5b (spec 090) o dist-cjs tambem carrega commentLinks.js
# (@artificio/content-editor/comment-links), a politica de link de comentario.
# Ele nao acrescenta dependencia externa — usa so o `URL` global, zero require —,
# entao o filtro de deps acima continua suficiente.
COPY --from=builder /repo/packages/content-editor/dist-cjs ./packages/content-editor/dist-cjs
# Spec 090 fase 4: `routes/communityModeration.ts` (a fachada browser-safe de
# moderação) importa `moderationQueueSchema` de `@artificio/comments` para
# validar na fronteira o payload que vem do `accounts.` O backend compila para
# CommonJS (`main: dist/server.js`, sem `type: module`), então resolve por
# `require` e só o `dist-cjs` entra — a raiz React do pacote vive em
# `@artificio/comments/react` e é do frontend.
# `@artificio/ui` acompanha por ser dependency do `comments`, não porque este
# backend a use: `--prod --filter` PODA o store de quem fica de fora, e o
# symlink sobrevive apontando para nada (foi assim que o SSO caiu 5h em
# 2026-08-08, E016/E017). Não copiamos `dist` de `ui` porque nenhum `require`
# do CJS de `comments` o alcança — medido: `dist-cjs/moderation.js` requer só
# `zod`, e a trava do requisito 21b mantém o root livre de React.
COPY --from=builder /repo/packages/comments/dist-cjs ./packages/comments/dist-cjs

COPY --from=builder /repo/apps/downloads/backend/dist ./apps/downloads/backend/dist

RUN chown -R node:node /repo && mkdir -p /app/logs && chown node:node /app/logs

USER node

WORKDIR /repo/apps/downloads/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
