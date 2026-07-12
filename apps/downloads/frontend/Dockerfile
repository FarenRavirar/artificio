# =============================================================================
# Frontend — Downloads RPG
# React + Vite → build estático servido por Nginx
# =============================================================================

# Estágio 1: build Vite
FROM node:24-alpine AS builder

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_PUBLIC_SITE_URL
ENV VITE_PUBLIC_SITE_URL=${VITE_PUBLIC_SITE_URL}

ARG VITE_ACCOUNTS_URL
ENV VITE_ACCOUNTS_URL=${VITE_ACCOUNTS_URL}

ARG VITE_GA_ID
ENV VITE_GA_ID=${VITE_GA_ID}

ARG VITE_SITE_ADMIN_SYSTEMS_URL
ENV VITE_SITE_ADMIN_SYSTEMS_URL=${VITE_SITE_ADMIN_SYSTEMS_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/downloads ./apps/downloads
COPY patches ./patches

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/downloads-frontend

# =============================================================================
# Estágio 2: Nginx servindo o build estático
FROM nginx:1.31-alpine AS production

RUN rm /etc/nginx/conf.d/default.conf

COPY apps/downloads/frontend/nginx.conf /etc/nginx/templates/default.conf.template

COPY --from=builder /repo/apps/downloads/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
