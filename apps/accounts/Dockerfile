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
# @artificio/comments (T2.3, spec 090) entrou como dep do app para a leitura em
# arvore: o handler importa `assembleTree`, `issueTreeCursor` e
# `verifyTreeCursor` de la. Traz `zod` como dep externa propria e o require sai
# de dentro do dist dele — mesmo caso de auth/config, mesmo modo de falha
# (E016/E017): sem o filtro explicito o container sobe e so quebra na primeira
# leitura de comentario, com MODULE_NOT_FOUND e CI verde.
# @artificio/content-editor (T2.5/T2.6c, spec 090) entrou como dep TRANSITIVA:
# `apps/accounts` nao o importa direto, mas `packages/comments` sim —
# `commentBody.ts` chama `sanitizeUserMarkdown` e `markdownToPlainText`.
#
# Incidente real (2026-08-08, deploy prod run 31238673567): container em restart
# loop com `Cannot find package 'sanitize-html' imported from
# /app/packages/content-editor/dist/sanitize.js`, SSO em 502 para todos os
# projetos, CI verde.
#
# O mecanismo, medido dentro da imagem quebrada — nao e a pasta que some, e o
# STORE que e podado. `packages/content-editor/node_modules/sanitize-html`
# EXISTIA, como symlink para `../../../node_modules/.pnpm/sanitize-html@2.17.6`;
# o alvo e que nao existia. `pnpm install --prod --filter <X>` mantem no
# `.pnpm` so o que os pacotes filtrados precisam, entao `sanitize-html`,
# `markdown-it` e `dompurify` foram removidos enquanto `zod`/`kysely`/`express`
# (dos pacotes filtrados) ficaram. Symlink orfao, resolucao falha em runtime.
#
# E o E016/E017 outra vez, mas por dependencia de SEGUNDO nivel: o gate
# `check_dockerfile_workspace_deps.mjs` cruza imports de `src/` contra linhas
# `COPY`, e `errors.md:236` ja registrava que ele **nao cobre**
# `RUN pnpm install --prod --filter`. Este app usa `--filter`, entao o gate
# passou verde.
#
# Os dois guards abaixo cobrem coisas diferentes: `test -d` segue o symlink e
# falha quando o alvo sumiu (pega exatamente este caso); o `import()` do dist
# prova a cadeia inteira `comments -> content-editor -> sanitize-html` resolver
# em runtime, que e o que nenhum `test -d` individual garante. Falhar aqui
# quebra o BUILD; falhar em runtime quebra o SSO de todos os projetos.
RUN pnpm install --prod --filter @artificio/accounts --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/auth --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/comments --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/config --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/content-editor --frozen-lockfile --ignore-scripts \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile --ignore-scripts \
  && test -d packages/auth/node_modules/jsonwebtoken \
  && test -d packages/comments/node_modules/zod \
  && test -d packages/config/node_modules/zod \
  && test -d packages/content-editor/node_modules/sanitize-html \
  && test -d packages/content-editor/node_modules/markdown-it \
  && test -d packages/content-editor/node_modules/dompurify \
  && test -d packages/media/node_modules/cloudinary \
  && test -d packages/media/node_modules/ipaddr.js \
  && test -d apps/accounts/node_modules/@node-rs/argon2 \
  && node -e "require('/app/apps/accounts/node_modules/@node-rs/argon2').hashSync('probe')" \
  && node --input-type=module -e "import('/app/packages/comments/dist/index.js')" \
  || (echo "ERRO: dependencia de pacote workspace ausente em packages/*/node_modules/" && exit 1)
RUN chown -R node:node /app
USER node
WORKDIR /app/apps/accounts
EXPOSE 3000
CMD ["node", "dist/index.js"]
