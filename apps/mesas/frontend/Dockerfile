# =============================================================================
# Frontend — Anúncios de Mesas RPG
# React + React Router (framework mode) → SSR isomórfico servido por Node
#
# Era nginx servindo `dist/` estático até a spec 102 T4.2. O estático não podia
# continuar: o HTML que ele entregava não tinha conteúdo nem schema, e o remendo
# (`map $http_user_agent $is_crawler` + `@og_proxy`) servia HTML diferente para
# bot e para usuário — exatamente a divergência que a spec elimina. Agora o mesmo
# `loader` roda no servidor e no cliente, e todo user-agent recebe o mesmo HTML.
# =============================================================================

# Estágio 1: build (cliente + servidor)
FROM node:24-alpine AS builder

WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

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
COPY patches ./patches

RUN pnpm install --frozen-lockfile
RUN pnpm -w turbo run build --filter=@artificio/mesas-frontend

# Fail-fast do build de SSR: `react-router build` emite cliente E servidor, e a
# ausência do segundo só apareceria no boot do container, em runtime. Falhar aqui
# é falhar no CI (padrão E016/E017).
RUN test -f apps/mesas/frontend/build/server/index.js \
  && test -d apps/mesas/frontend/build/client \
  || (echo "ERRO: build de SSR incompleto — falta build/server/index.js ou build/client" && exit 1)

# =============================================================================
# Estágio 2: Node executando o bundle do servidor
FROM node:24-alpine AS production

WORKDIR /repo

# Sem pin de versão exato (achado 2026-07-16): `libexpat=2.8.1-r0` fixo quebrava
# o build assim que o mirror Alpine avançava o pacote. `>=` e não `=`
# (2026-08-21): o pin de patch exato quebrou o deploy três vezes. O piso preserva
# a proteção de CVE (apk recusa versão abaixo do corte) sem quebrar quando o
# Alpine promove o patch e tira a antiga de catálogo.
#
# `--upgrade` obrigatório (achado Codex, PR #169): sem ele, `apk add` não troca a
# lib se a imagem base já satisfaz a dependência com a versão vulnerável
# instalada, reabrindo o CVE silenciosamente.
#
# Os pisos são os do `node:24-alpine` — MESMA base do backend, então os números
# batem com `apps/mesas/backend/Dockerfile:45-49`. São maiores que os do antigo
# estágio nginx deste arquivo porque a base mudou: `nginx:1.31-alpine` oferecia
# no máximo curl 8.20.0-r0, e copiar aqueles pisos para cá seria pedir menos
# segurança do que este mirror entrega. Antes de mexer, medir com
# `docker run --rm node:24-alpine apk update && apk policy <pacote>`.
RUN apk add --no-cache --upgrade \
    "curl>=8.21.0-r0" \
    "libcurl>=8.21.0-r0" \
    "c-ares>=1.34.8-r0" \
    "libexpat>=2.8.3-r0"

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/mesas/frontend/package.json ./apps/mesas/frontend/package.json
COPY patches ./patches

# O bundle do servidor NÃO embute as dependências — medido em
# `build/server/index.js`, que as importa em runtime: `react`, `react-dom/server`,
# `react-router`, `@react-router/node`, `@react-router/express`, `express`,
# `isbot`, `@tanstack/react-query`, `lucide-react`, `zod`, `dompurify`,
# `html2canvas-pro`, `react-hot-toast`. Imagem sem `node_modules` de produção
# compila verde e crasha com MODULE_NOT_FOUND no primeiro request. As 30
# `dependencies` do app entram pelo `--filter @artificio/mesas-frontend`.
#
# `pnpm --prod` não instala deps de pacote de workspace no `node_modules` local
# (spec 062/PR #145, reconfirmado na 080): cada pacote com dependency própria
# precisa do SEU `--filter`, senão o `.pnpm` é podado e sobra symlink apontando
# para o vazio — foi assim que o E021 derrubou o SSO por ~5 horas.
#
# Os 7 que têm dep externa própria (medido em `packages/*/package.json`):
# `auth` (jsonwebtoken), `catalog-ui` (lucide-react, react, react-dom),
# `comments` (zod), `config` (zod), `content-editor` (dompurify, markdown-it,
# sanitize-html), `image-editor` (react-image-crop) e `media` (cloudinary,
# ipaddr.js). Os outros 5 entram porque o `src` os importa.
#
# `changelog` entra sem aparecer em nenhum import do `src`: é transitivo,
# puxado por outro pacote do workspace. Exatamente o vetor do E021 — conferir
# import direto não o encontraria.
RUN pnpm install --prod --filter @artificio/mesas-frontend \
  --filter @artificio/analytics --filter @artificio/auth \
  --filter @artificio/catalog-matching --filter @artificio/catalog-table \
  --filter @artificio/catalog-ui --filter @artificio/changelog \
  --filter @artificio/comments --filter @artificio/config \
  --filter @artificio/content-editor --filter @artificio/image-editor \
  --filter @artificio/media --filter @artificio/ui \
  --frozen-lockfile

# Asserção separada do install de propósito (achado de review, PR #268): no
# encadeamento `pnpm install && test ... || echo ERRO`, falha de rede ou de
# lockfile caía no mesmo `||` e era reportada como "dependência ausente" —
# diagnóstico errado num build que quebra por outro motivo.
RUN test -d packages/content-editor/node_modules/sanitize-html \
  && test -d packages/config/node_modules/zod \
  && test -d apps/mesas/frontend/node_modules/express \
  || (echo "ERRO: dependencia de runtime ausente em node_modules/" && exit 1)

# Os pacotes de workspace são linkados; o `dist` que eles exportam precisa vir do
# builder. Todos os 12 do fecho transitivo, porque o SSR executa em runtime o
# código que o estático só compilava.
#
# `dist` (ESM) e não `dist-cjs`: `apps/mesas/frontend/package.json` declara
# `"type": "module"`, então a resolução usa a condição `import` do `exports`,
# mesmo nos pacotes que também publicam `main` apontando para `dist-cjs`.
COPY --from=builder /repo/packages/analytics/dist ./packages/analytics/dist
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/catalog-matching/dist ./packages/catalog-matching/dist
COPY --from=builder /repo/packages/catalog-table/dist ./packages/catalog-table/dist
COPY --from=builder /repo/packages/catalog-ui/dist ./packages/catalog-ui/dist
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/comments/dist ./packages/comments/dist
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/content-editor/dist ./packages/content-editor/dist
COPY --from=builder /repo/packages/image-editor/dist ./packages/image-editor/dist
COPY --from=builder /repo/packages/media/dist ./packages/media/dist
COPY --from=builder /repo/packages/ui/dist ./packages/ui/dist

# `build/client` acompanha o `build/server`: o `server.js` serve os assets com
# `express.static` (`/assets` imutável, resto com cache curto). Sem ele o HTML
# renderiza e nenhum JS/CSS carrega — a página chega sem estilo e sem hidratar.
COPY --from=builder /repo/apps/mesas/frontend/build ./apps/mesas/frontend/build
COPY --from=builder /repo/apps/mesas/frontend/server.js ./apps/mesas/frontend/server.js

RUN chown -R node:node /repo

USER node

WORKDIR /repo/apps/mesas/frontend

# 3000 é a porta default do `server.js` (`process.env.PORT ?? 3000`). O nginx
# expunha 80; quem roteia para cá (compose/tunnel) precisa acompanhar.
EXPOSE 3000

CMD ["node", "server.js"]
