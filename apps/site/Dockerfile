# Site (blog Astro SSG) — imagem única: instala deps + builda pacotes compartilhados.
# O build do Astro NÃO roda na imagem (depende do DB+WP) → roda no entrypoint (runtime).
# base slim (glibc) p/ o binário do Pagefind (musl/alpine daria problema).
FROM node:24-slim

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Deps do workspace (inclui devDeps: astro/tsx/pagefind/tailwind — necessárias p/ o build em runtime).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/site ./apps/site
COPY apps/site-admin ./apps/site-admin
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Fail-fast: verifica que cloudinary foi instalado (dep de @artificio/media).
RUN test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado em packages/media/node_modules/" && exit 1)

# Builda os pacotes que o site consome (tsc -> dist) + a SPA admin (vite -> apps/site-admin/dist).
# A SPA admin builda na imagem (não depende de DB/WP, ao contrário do Astro público que builda no entrypoint).
RUN pnpm -w turbo run build \
  --filter=@artificio/config --filter=@artificio/auth --filter=@artificio/ui \
  --filter=@artificio/content --filter=@artificio/analytics \
  --filter=@artificio/feedback --filter=@artificio/media \
  --filter=@artificio/site-admin

WORKDIR /repo/apps/site
RUN chmod +x docker-entrypoint.sh
RUN chown -R node:node /repo
USER node
EXPOSE 4322
ENTRYPOINT ["./docker-entrypoint.sh"]
