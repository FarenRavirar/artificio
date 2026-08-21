# =============================================================================
# Frontend — Anúncios de Mesas RPG
# React + Vite → build estático servido por Nginx
# =============================================================================

# Estágio 1: build Vite
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

# =============================================================================
# Estágio 2: Nginx servindo o build estático
FROM nginx:1.31-alpine AS production

# Remover config padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Sem pin de versão (achado 2026-07-16): libexpat=2.8.1-r0 fixo quebrava o
# build assim que o mirror Alpine avançava o pacote (2.8.1-r0 saiu de catálogo,
# só 2.8.2-r0 disponível) — apk falhava com "unable to select packages". Pin
# de lib de sistema sem processo de bump vira bomba-relógio certa.
# --upgrade obrigatório (achado Codex, PR #169): o pin original remediava
# CVE-2026-45186/41080 (sessoes/26-06-20_5_infra_dockerfile-sonar-debts.md) —
# sem --upgrade, `apk add` não troca a lib se a imagem base (nginx:1.31-alpine)
# já satisfaz a dependência com a versão vulnerável já instalada, reabrindo o
# CVE silenciosamente. --upgrade força a versão mais nova do mirror sempre.
# Achado Snyk (spec 081, 2026-07-18): curl/libcurl e c-ares na imagem base
# (alpine 3.23) tinham CVEs abertos (CVE-2026-6276 SSRF/cleartext alto,
# CVE-2026-5773 SSRF, CVE-2026-7168 auth bypass, entre outros).
# `>=` e não `=` (2026-08-21): o pin de patch exato quebrou o deploy três vezes
# — libexpat=2.8.1-r0 (2026-07-16), curl=8.20.0-r0 (2026-07-18) e
# libexpat=2.8.2-r0 (2026-08-21, run 32435929546). O piso preserva a proteção
# de CVE (apk recusa versão abaixo do corte) sem quebrar quando o Alpine
# promove o patch e tira a antiga de catálogo. Mesmo tratamento no backend.
#
# Os pisos AQUI são menores que os do backend de propósito: as bases divergem.
# Medido na VM em 2026-08-21 (`docker run --rm nginx:1.31-alpine apk policy`),
# este mirror oferece no máximo curl/libcurl 8.20.0-r0 e c-ares 1.34.8-r0,
# enquanto node:24-alpine já tem curl 8.21.0-r0. O pin anterior deste arquivo
# pedia curl=8.21.0-r0 — versão que NÃO EXISTE nesta base: estava impossível e
# só não estourava porque o build do backend falhava antes e cancelava este
# estágio. Foi exatamente o inverso do incidente de 2026-07-18 (run 29645440355),
# quando este arquivo ficou atrás do backend; alinhar os dois números por
# simetria é o erro que se repete — o que vale é o que cada mirror oferece.
# Antes de mexer nos pisos, medir com `apk update && apk policy <pacote>` na
# imagem base REAL (não `apk info`, que só lê cache local desatualizado).
RUN apk add --no-cache --upgrade \
    "libexpat>=2.8.3-r0" \
    "curl>=8.20.0-r0" \
    "libcurl>=8.20.0-r0" \
    "c-ares>=1.34.8-r0"

COPY apps/mesas/frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Copiar build do Vite
COPY --from=builder /repo/apps/mesas/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
