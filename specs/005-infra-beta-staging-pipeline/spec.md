# 005 — Esteira beta/staging genérica (dev→beta, main→prod)

- **Módulo/Pacote:** infra (CI/CD `.github/workflows/*`, VM `/opt/artificio-beta`) + `apps/mesas` (1º consumidor)
- **Gate relacionado:** D (mesas) — desbloqueia "resolver beta mesasbeta"; padrão reusável p/ glossário e site

## Problema
O monorepo G1 só tem esteira de produção (`main` → `/opt/artificio` → `<modulo>.artificiorpg.com`). Não há ambiente de pré-validação. O `mesasbeta.artificiorpg.com` legado está morto (`deleted_client` no OAuth próprio, que o G1 não usa mais). O mantenedor precisa de um **beta por módulo** onde mudanças entram **antes** de produção, com **mínimo toque manual** e **sem risco de derrubar prod** ao recriar containers. Mesas, glossário e o site principal vão todos precisar disso, então o padrão deve ser **genérico** (D041).

## Requisitos
1. Existe branch `dev` = integração/beta; `main` = produção. Trabalho normal entra via `feat→dev`.
2. **Invariante divergência-proof:** `main` é sempre ancestral de `dev`. Push direto em `main` é proibido por branch protection; `main` só avança por merge `dev→main`.
3. Push em `dev` que toca arquivos de um módulo dispara **auto-deploy do beta daquele módulo** (path-filtered), sem tocar outros módulos nem produção.
4. Beta de cada módulo roda em subdomínio `<modulo>beta.artificiorpg.com`, em clone separado `/opt/artificio-beta` trackeando `dev`.
5. Beta tem **DB próprio** (volume isolado), nunca escreve no DB de produção.
6. Existe endpoint admin de **hydrate on-demand** que copia dados prod→beta, com safety gate que bloqueia execução quando `NODE_ENV=production` (comportamento legado mesas religado).
7. Promoção a produção = merge `dev→main` (PR) → dispara deploy prod existente. Há um PR `dev→main` standing mantido atualizado p/ promover em 1 merge.
8. Gate de produção **recusa** o deploy se `main` não for ancestral de `dev` (cinto de segurança da invariante R2).
9. O workflow reusável `_deploy-module.yml` aceita parâmetro `env` (`beta`|`prod`) que seleciona ref git, diretório na VM, compose file, env file, nomes de container, domínio e rotas de smoke — sem duplicar a lógica de deploy.
10. Deploy de beta herda as cicatrizes do legado: `down` por compose file (nunca por prefixo global — E144), `flock` no host, snapshot pré-deploy, rollback banco+containers, health `healthy`, smoke de rotas críticas.
11. `mesasbeta` é o 1º consumidor: usa accounts SSO (sem OAuth próprio), marca D040, rede `artificio_net` (D035).
12. Nenhum segredo versionado; `JWT_SECRET` do beta = mesmo do SSO (validado como no prod).

## Critérios de aceite
- Push em `dev` tocando `apps/mesas/**` sobe `https://mesasbeta.artificiorpg.com` (200) automaticamente; push tocando só `apps/glossario/**` **não** mexe no mesas-beta.
- `mesasbeta.artificiorpg.com` faz login via `accounts.` (sem `deleted_client`), rota privada `401` sem cookie e OK com cookie, logout limpa sessão.
- Recriar containers do beta **não derruba** `mesas.artificiorpg.com` (prod segue 200 durante o deploy beta).
- Endpoint hydrate copia prod→beta com sucesso em beta e retorna `403` se `NODE_ENV=production`.
- Tentativa de deploy prod com `main` não-ancestral de `dev` é **bloqueada** com erro claro.
- Push direto em `main` é rejeitado pela branch protection.
- DB de prod inalterado por qualquer operação de beta (contagens antes/depois iguais).

## Fora de escopo
- Construir beta de glossário e site (esta spec entrega o **padrão** + mesas; outros módulos consomem depois).
- Migrar/alterar dados de produção.
- Refatorar UI do mesas (já feito em 004/CDX-311).
- Criar DNS/tunnel novo além do hostname `mesasbeta.` (re-aproveitar o existente).
- Rotação de segredos vazados (ação do mantenedor, fora desta spec).
- Watchtower/auto-update de imagem.

## Riscos e impacto em outros módulos
- **Auth sagrado:** beta com `JWT_SECRET` divergente quebra SSO — validar igual ao prod.
- **E144 (cicatriz):** `down`/`build` por prefixo global derruba prod junto; obrigatório operar por compose file e nomes `mesas-beta-*` distintos de `mesas-*`.
- Mudança de fluxo: PRs passam a mirar `dev` (não `main`) — afeta Codex e qualquer automação que assuma `main` como alvo de PR.
- Branch protection em `main` pode bloquear hotfix direto; hotfix passa a ser `feat→dev→promo` (ou break-glass existente).
- VM ganha 2º clone (`/opt/artificio-beta`) + DB beta → consumo de disco/memória adicional na Oracle 24GB/200GB.
- `_deploy-module.yml` é compartilhado (prod vivo): parametrizar `env` sem regressão no caminho prod = crítico; CI deve provar que `env=prod` continua idêntico.
