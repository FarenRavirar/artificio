# =============================================================================
# Frontend — Anúncios de Mesas RPG
# React + Vite → build estático servido por Nginx
# =============================================================================

# Estágio 1: build Vite
FROM node:25.9.0-alpine AS builder

WORKDIR /repo
RUN npm install -g pnpm@10.12.1

ARG VITE_ENABLE_DEVTOOLS=false
ENV VITE_ENABLE_DEVTOOLS=${VITE_ENABLE_DEVTOOLS}

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_PUBLIC_SITE_URL
ENV VITE_PUBLIC_SITE_URL=${VITE_PUBLIC_SITE_URL}

ARG VITE_CLOUDINARY_CLOUD_NAME
ENV VITE_CLOUDINARY_CLOUD_NAME=${VITE_CLOUDINARY_CLOUD_NAME}

ARG VITE_CLOUDINARY_UPLOAD_PRESET
ENV VITE_CLOUDINARY_UPLOAD_PRESET=${VITE_CLOUDINARY_UPLOAD_PRESET}

ARG VITE_ACCOUNTS_URL
ENV VITE_ACCOUNTS_URL=${VITE_ACCOUNTS_URL}

ARG VITE_GA_ID
ENV VITE_GA_ID=${VITE_GA_ID}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/mesas ./apps/mesas

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/mesas-frontend

# =============================================================================
# Estágio 2: Nginx servindo o build estático
FROM nginx:alpine AS production

# Remover config padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar config customizada (proxy para a API com substituição de ENV)
COPY apps/mesas/frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Copiar build do Vite
COPY --from=builder /repo/apps/mesas/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
