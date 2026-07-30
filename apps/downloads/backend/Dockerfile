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
RUN pnpm install --prod --filter @artificio/downloads-backend --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/email --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/content --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/content-editor --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/auth --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/config --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/catalog-client --frozen-lockfile --ignore-scripts \
  && test -d packages/media/node_modules/cloudinary \
  && test -d packages/content-editor/node_modules/sanitize-html \
  && test -d packages/auth/node_modules/jsonwebtoken \
  && test -d packages/config/node_modules/zod \
  && test -d packages/catalog-client/node_modules/zod \
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
# So o dist-cjs entra: o backend compila com module "CommonJS" e consome apenas
# o subpath do sanitizador; a raiz do pacote e React/TSX, usada so pelo frontend.
COPY --from=builder /repo/packages/content-editor/dist-cjs ./packages/content-editor/dist-cjs

COPY --from=builder /repo/apps/downloads/backend/dist ./apps/downloads/backend/dist

RUN chown -R node:node /repo && mkdir -p /app/logs && chown node:node /app/logs

USER node

WORKDIR /repo/apps/downloads/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
