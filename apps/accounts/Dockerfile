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
RUN pnpm install --prod --filter @artificio/accounts --frozen-lockfile
WORKDIR /app/apps/accounts
EXPOSE 3000
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
