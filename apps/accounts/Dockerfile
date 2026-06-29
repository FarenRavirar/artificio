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
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/accounts ./apps/accounts
COPY --from=build /repo/patches ./patches
# pnpm --prod nao instala deps de workspace packages no node_modules local.
# accounts usa @artificio/media (upload de avatar -> cloudinary); instalar tambem as
# deps de media, senao o runtime quebra com ERR_MODULE_NOT_FOUND 'cloudinary'. Mesmo
# padrao do Dockerfile do mesas-backend. Guard explicito p/ falhar o build (nao o runtime).
RUN pnpm install --prod --filter @artificio/accounts --frozen-lockfile \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile \
  && test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado em packages/media/node_modules/" && exit 1)
RUN chown -R node:node /app
USER node
WORKDIR /app/apps/accounts
EXPOSE 3000
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
