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
# auth/config tem dep externa propria (jsonwebtoken, zod) e o require sai de
# dentro do dist deles. Hoje o app declara as duas libs como dep direta, entao a
# resolucao ascendente do Node acha por acaso — remover do package.json do app
# derrubaria o container com o CI verde. Filtrar explicitamente troca a
# coincidencia por garantia (padrao E016/E017).
# @artificio/media entrou junto com a restauracao da troca de avatar
# (2026-07-31) e traz `cloudinary` como dep externa propria — mesmo caso de
# auth/config: sem o filtro explicito o container sobe e so quebra na primeira
# requisicao de upload, com MODULE_NOT_FOUND e CI verde (E016/E017).
# `--ignore-scripts` em todas: no estagio de runtime nao ha build a fazer, e
# script de lifecycle de dependencia executaria codigo de terceiro dentro da
# imagem de producao sem necessidade (achado do Sonar, PR #235). Mesmo padrao ja
# usado em `apps/downloads/backend/Dockerfile`.
# @node-rs/argon2 (T2.2a, spec 090) e binario nativo, mas resolve por
# optionalDependency de plataforma (`@node-rs/argon2-linux-x64-musl` nesta imagem
# Alpine), nao por script de postinstall — por isso convive com
# `--ignore-scripts`. O `hashSync('probe')` abaixo e o guard: `test -d` sozinho
# provaria so que a pasta existe, e o modo de falha real e o binario da
# plataforma faltar, que so apareceria na primeira autenticacao de servico em
# producao, com CI verde (E016/E017).
RUN pnpm install --prod --filter @artificio/accounts --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/auth --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/config --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile --ignore-scripts \
  && test -d packages/auth/node_modules/jsonwebtoken \
  && test -d packages/config/node_modules/zod \
  && test -d packages/media/node_modules/cloudinary \
  && test -d apps/accounts/node_modules/@node-rs/argon2 \
  && node -e "require('/app/apps/accounts/node_modules/@node-rs/argon2').hashSync('probe')" \
  || (echo "ERRO: dependencia de pacote workspace ausente em packages/*/node_modules/" && exit 1)
RUN chown -R node:node /app
USER node
WORKDIR /app/apps/accounts
EXPOSE 3000
CMD ["node", "dist/index.js"]
