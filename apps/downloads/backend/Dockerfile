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

RUN pnpm install --prod --filter @artificio/downloads-backend --frozen-lockfile \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile \
  && test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado em packages/media/node_modules/" && exit 1)

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
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
COPY --from=builder /repo/packages/media/dist ./packages/media/dist
COPY --from=builder /repo/packages/catalog-client/dist ./packages/catalog-client/dist
COPY --from=builder /repo/packages/catalog-client/dist-cjs ./packages/catalog-client/dist-cjs
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/changelog/dist-cjs ./packages/changelog/dist-cjs
COPY --from=builder /repo/packages/email/dist ./packages/email/dist

COPY --from=builder /repo/apps/downloads/backend/dist ./apps/downloads/backend/dist

RUN chown -R node:node /repo && mkdir -p /app/logs && chown node:node /app/logs

USER node

WORKDIR /repo/apps/downloads/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
