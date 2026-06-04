# =============================================================================
# Frontend — Anúncios de Mesas RPG
# React + Vite → build estático servido por Nginx
# =============================================================================

# Estágio 1: build Vite
FROM node:25.9.0-alpine AS builder

WORKDIR /app

ARG VITE_ENABLE_DEVTOOLS=false
ENV VITE_ENABLE_DEVTOOLS=${VITE_ENABLE_DEVTOOLS}

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_CLOUDINARY_CLOUD_NAME
ENV VITE_CLOUDINARY_CLOUD_NAME=${VITE_CLOUDINARY_CLOUD_NAME}

ARG VITE_CLOUDINARY_UPLOAD_PRESET
ENV VITE_CLOUDINARY_UPLOAD_PRESET=${VITE_CLOUDINARY_UPLOAD_PRESET}

COPY package*.json ./
RUN npm install -g npm@11.13.0
RUN npm ci

COPY . .

RUN npm run build

# =============================================================================
# Estágio 2: Nginx servindo o build estático
FROM nginx:alpine AS production

# Remover config padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar config customizada (proxy para a API com substituição de ENV)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copiar build do Vite
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
