FROM node:24-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/accounts ./apps/accounts
COPY patches ./patches
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm -w turbo run build --filter=@artificio/accounts

FROM node:24-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# IMPORTANTE: copiar a SOURCE dos packages do CONTEXTO (limpa — .dockerignore exclui
# node_modules e dist), NAO do build stage. Copiar do build stage trazia node_modules
# com symlinks stale (`packages/media/node_modules/cloudinary` pendurado) que sobreviviam
# ao `pnpm install` e quebravam a resolucao ESM de 'cloudinary' em runtime (SSO 502).
# Mesmo padrao ja em producao no apps/mesas/backend/Dockerfile: install limpo + COPY dist.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/accounts/package.json ./apps/accounts/package.json
COPY patches ./patches

# pnpm --prod nao instala deps de workspace packages no node_modules local.
# accounts usa @artificio/media (upload de avatar -> cloudinary); instalar tambem media.
# Guard verifica o ARQUIVO real atraves do symlink (test -f), nao so o dir (test -d dava
# falso-positivo em symlink pendurado): falha o BUILD se cloudinary nao resolver.
RUN pnpm install --prod --filter @artificio/accounts --frozen-lockfile \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile \
  && test -f packages/media/node_modules/cloudinary/package.json \
  || (echo "ERRO: cloudinary nao resolvido em packages/media/node_modules/" && exit 1)

# Outputs compilados dos workspace packages usados em runtime (ESM).
COPY --from=build /repo/packages/config/dist ./packages/config/dist
COPY --from=build /repo/packages/auth/dist ./packages/auth/dist
COPY --from=build /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
COPY --from=build /repo/packages/media/dist ./packages/media/dist
# Backend (dist/*.js) + frontend buildado (dist/client) do accounts.
COPY --from=build /repo/apps/accounts/dist ./apps/accounts/dist

RUN chown -R node:node /repo
USER node
WORKDIR /repo/apps/accounts
EXPOSE 3000
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
