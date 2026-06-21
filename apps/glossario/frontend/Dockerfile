# =============================================================================
# Frontend — Grande Glossário de RPG
# React + Vite → build estático servido por Nginx (proxy /api/ via template)
# =============================================================================

# Estágio 1: build Vite (workspace monorepo)
FROM node:24-alpine AS builder

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Em produção a API é servida pelo mesmo host atrás do nginx (proxy /api/)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_GA_ID
ENV VITE_GA_ID=${VITE_GA_ID}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/glossario ./apps/glossario
COPY patches ./patches

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/glossario-frontend

# =============================================================================
# Estágio 2: Nginx servindo o build estático
FROM nginx:1.31-alpine AS production

ENV API_UPSTREAM=glossario-api

RUN rm /etc/nginx/conf.d/default.conf

RUN apk add --no-cache libexpat=2.8.1-r0

COPY apps/glossario/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template

COPY --from=builder /repo/apps/glossario/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
