# links.artificiorpg.com — app completo (Astro front + Express API + Postgres/Kysely).
# Build do Astro roda NO RUNTIME (entrypoint), não na imagem — depende do DB p/ ler os grupos
# (content layer lê do Postgres, igual ao site que depende do DB+WP).
# Espelha apps/site/Dockerfile.
FROM node:24-slim

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Deps do workspace (inclui devDeps: astro/tsx/tailwind — necessárias p/ o build em runtime).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/links ./apps/links
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Builda os pacotes que o links consome (tsc -> dist).
# O Astro dist builda no entrypoint (depende de DB, não dá p/ buildar na imagem).
RUN pnpm -w turbo run build --filter=@artificio/auth --filter=@artificio/ui

WORKDIR /repo/apps/links
RUN chmod +x docker-entrypoint.sh
EXPOSE 4324
ENTRYPOINT ["./docker-entrypoint.sh"]
