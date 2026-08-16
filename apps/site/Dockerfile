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
  --filter=@artificio/comments --filter=@artificio/content-editor \
  --filter=@artificio/site-admin

# Fail-fast dos pacotes da conversa (T6.4, spec 090). Esta lista de `--filter` é
# uma ALLOWLIST: pacote ausente dela não é construído, o `dist` não existe, e a
# falha só aparece no entrypoint — em runtime, já no ar. É a forma exata dos
# incidentes E016/E017 (SSO fora por 5h em 2026-08-08) e E021 (dependência
# transitiva podada do store). `content-editor` entra porque `@artificio/comments`
# o consome para sanitizar o corpo legado (`CommentsConversation.tsx`), e
# transitiva não construída falha igual à direta.
RUN test -d packages/comments/dist && test -d packages/content-editor/dist \
  || (echo "ERRO: dist de @artificio/comments ou content-editor ausente" && exit 1)

WORKDIR /repo/apps/site
RUN chmod +x docker-entrypoint.sh
RUN chown -R node:node /repo
USER node
EXPOSE 4322
ENTRYPOINT ["./docker-entrypoint.sh"]
