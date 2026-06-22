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

# Dependências de runtime do Sharp (processamento de imagem WebP)
RUN apk add --no-cache vips-dev fftw-dev build-base

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/mesas/backend/package.json ./apps/mesas/backend/package.json
COPY patches ./patches

# pnpm --prod nao instala deps de workspace packages no node_modules local.
# @artificio/media depende de cloudinary; instalar explicitamente antes do fail-fast.
RUN pnpm install --prod --filter @artificio/mesas-backend --frozen-lockfile \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile \
  && test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado em packages/media/node_modules/" && exit 1)

# Workspace packages are linked in production; copy built outputs they export at runtime.
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/changelog/dist-cjs ./packages/changelog/dist-cjs
COPY --from=builder /repo/packages/feedback/dist ./packages/feedback/dist
COPY --from=builder /repo/packages/feedback/dist-cjs ./packages/feedback/dist-cjs
COPY --from=builder /repo/packages/media/dist ./packages/media/dist

# Copiar build compilado
COPY --from=builder /repo/apps/mesas/backend/dist ./apps/mesas/backend/dist

# Copiar arquivos de dados de sistemas e cenários (JSON)
COPY --from=builder /repo/apps/mesas/backend/sistemas.json ./apps/mesas/backend/sistemas.json
COPY --from=builder /repo/apps/mesas/backend/cenarios.json ./apps/mesas/backend/cenarios.json
COPY --from=builder /repo/apps/mesas/database/changelogs.json ./apps/mesas/backend/database/changelogs.json
RUN chown -R node:node /repo
USER node

WORKDIR /repo/apps/mesas/backend

EXPOSE 3000

CMD ["node", "dist/server.js"]
