# Sessao 26-06-29_4 — accounts / conta profile tools

## Objetivo
Corrigir regressao visual da tela `/conta` do `accounts` e implementar ferramentas de conta:
- trocar foto de perfil;
- excluir conta.

## Escopo
- `apps/accounts` frontend/backend.
- `apps/site` busca do header, por feedback do mantenedor no mesmo escopo UX pos-deploy.
- SSO central; tratar como SDD Completo proporcional por tocar `accounts`.

## Contexto
- Bug visual observado em prod: tema dark mostra faixa branca gigante à esquerda.
- Causa inicial: CSS usa `--accounts-ink` para estrutura do fundo; no dark `--accounts-ink` vira texto claro.

## Plano
- Separar tokens de estrutura (`--accounts-rail`) de tokens de texto.
- Reorganizar visual da tela `/conta` para ficar estavel em desktop/mobile.
- Adicionar endpoint autenticado para upload de avatar.
- Adicionar endpoint autenticado para exclusao de conta com confirmacao.
- Corrigir clique da busca do site com evento explicito e fallback `/busca/`.
- Atualizar UI com estados, erro/sucesso e acoes claras.
- Validar lint/build/test do pacote accounts e build/test proporcional do site.

## Checklist de fechamento
- [x] CSS dark sem faixa branca.
- [x] Upload de foto validado por tipo/tamanho.
- [x] Exclusao de conta exige confirmacao e limpa sessao.
- [x] Lint/build/test accounts verdes.
- [x] Busca do site abre modal ou navega para `/busca/`.
- [x] Governanca de API verificada apos rotas novas do accounts.
- [x] Registrar evidencias finais.

## Evidencias
- Branch: `fix/accounts-conta-tools` a partir de `origin/dev`.
- `pnpm verify:api` verde. Resultado relevante: `accounts` 13 rotas; `api:diff` `breaking=0`, `non-breaking=2` (`PATCH /api/account/avatar`, `DELETE /api/account`). 3 warnings OpenAPI conhecidos permanecem.
- `pnpm --filter @artificio/accounts lint` verde.
- `pnpm --filter @artificio/accounts test` verde: 10/10.
- `pnpm --filter @artificio/accounts build` verde.
- `pnpm --filter @artificio/site build` verde; Pagefind gerou indice.
- Prova estatica do build do site: `dist/index.html` contem `search-modal`; bundle contem `artificio:open-search`; `dist/busca/index.html` existe.
- Tentativa de clique headless bloqueada por ausencia de `playwright` no workspace (`MODULE_NOT_FOUND`); preview local foi encerrado.
