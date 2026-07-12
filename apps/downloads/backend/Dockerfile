# =============================================================================
# Backend — Downloads RPG
# Node.js API (Express/Kysely/Postgres)
# =============================================================================

# Estágio 1: build TypeScript
FROM node:24-alpine AS builder

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
FROM node:24-alpine AS production

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

# Workspace packages sao linkados em producao; copiar so o dist que exportam em runtime.
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
COPY --from=builder /repo/packages/media/dist ./packages/media/dist
COPY --from=builder /repo/packages/catalog-client/dist ./packages/catalog-client/dist
COPY --from=builder /repo/packages/catalog-client/dist-cjs ./packages/catalog-client/dist-cjs
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/changelog/dist-cjs ./packages/changelog/dist-cjs

COPY --from=builder /repo/apps/downloads/backend/dist ./apps/downloads/backend/dist

RUN chown -R node:node /repo && mkdir -p /app/logs && chown node:node /app/logs

USER node

WORKDIR /repo/apps/downloads/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
