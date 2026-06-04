# =============================================================================
# Backend — Anúncios de Mesas RPG
# Node.js API + CleanupWorker
# =============================================================================

# Estágio 1: build TypeScript
FROM node:25.9.0-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm install -g npm@11.13.0
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
COPY backend/sistemas.json ./sistemas.json
COPY backend/cenarios.json ./cenarios.json
COPY database/changelogs.json ./database/changelogs.json

RUN npm run build

# =============================================================================
# Estágio 2: imagem de produção (apenas o necessário)
FROM node:25.9.0-alpine AS production

WORKDIR /app

# Dependências de runtime do Sharp (processamento de imagem WebP)
RUN apk add --no-cache vips-dev fftw-dev build-base

COPY backend/package*.json ./
RUN npm install -g npm@11.13.0
RUN npm ci --omit=dev

# Copiar build compilado
COPY --from=builder /app/dist ./dist

# Copiar arquivos de dados de sistemas e cenários (JSON)
COPY --from=builder /app/sistemas.json ./sistemas.json
COPY --from=builder /app/cenarios.json ./cenarios.json
COPY --from=builder /app/database/changelogs.json ./database/changelogs.json

EXPOSE 3000

CMD ["node", "dist/server.js"]
