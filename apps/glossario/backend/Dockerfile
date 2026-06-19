# =============================================================================
# Backend — Grande Glossário de RPG
# Node.js API (Express + pg)
# =============================================================================

# Estágio 1: build TypeScript (workspace monorepo)
FROM node:24-alpine AS builder

WORKDIR /repo
RUN npm install -g pnpm@10.12.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/glossario ./apps/glossario
COPY patches ./patches

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/glossario-backend

# =============================================================================
# Estágio 2: imagem de produção (apenas o necessário)
FROM node:24-alpine AS production

WORKDIR /repo
ENV NODE_PATH=/repo/apps/glossario/backend/node_modules
RUN npm install -g pnpm@10.12.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/glossario/backend/package.json ./apps/glossario/backend/package.json
COPY patches ./patches
RUN pnpm install --prod --filter @artificio/glossario-backend --frozen-lockfile

# Workspace packages are linked in production; copy built outputs they export at runtime.
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs

COPY --from=builder /repo/apps/glossario/backend/dist ./apps/glossario/backend/dist

WORKDIR /repo/apps/glossario/backend

EXPOSE 3000

CMD ["node", "dist/index.js"]
