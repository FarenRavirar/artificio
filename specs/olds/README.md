# specs/olds — specs encerradas

Specs cuja implementação foi **confirmada no código**, movidas para cá para que `specs/` mostre só trabalho ativo. Nada é apagado: o histórico do git segue intacto e o conteúdo continua legível.

## Como se decide que uma spec vem para cá

Três critérios foram medidos em 2026-09-05. **Dois não funcionam**, e ficam registrados para ninguém repetir:

| critério | veredito |
|---|---|
| "o último commit da spec está em `dev`/`main`" | **inútil.** 94 de 95 specs dão SIM, porque isso mede o commit do `.md`, não da implementação. Documento mergeado só prova que a spec foi escrita |
| checkbox `- [ ]` / `- [x]` em `tasks.md` | **mente.** `036-media-shared` tem **20 abertas e 0 fechadas**, e `packages/media` está em produção há meses. A fase final quase nunca é preenchida |
| **o código que a spec pede existe no repositório** | **funciona.** É o único que distingue |

**O critério é o terceiro**, e a verificação é por requisito: ler o `## Problema` / `## Requisitos` do `spec.md` e procurar no código o que ele exige — arquivo, símbolo, rota, dependência do `package.json`, coluna de migration.

**Cuidado medido:** um "ausente" costuma ser padrão de busca errado, não código faltando. Na primeira leva, `004-mesas-sso-gate-d` acusou ausência porque procurei em `apps/accounts/backend/src` (a estrutura real é `apps/accounts/src`) e pelo literal `artificiorpg.com` (o código usa a constante `BRAND_DOMAIN`, `apps/accounts/src/app.ts:175`). **Confirmar a ausência antes de tratá-la como pendência.**

## Antes de mover, sempre

1. **Verificar o código**, requisito a requisito.
2. **Checar `specs/backlog.md`.** Ele cita ~43 specs por caminho e tem 57 débitos abertos; mover uma spec citada quebra a referência. Ou se evita a spec, ou se atualiza o caminho no mesmo commit.
3. **Varrer referências ao caminho antigo** em todo o repositório (`sessoes/`, outras specs, `AGENTS.md`) e corrigir para `specs/olds/...` no mesmo commit.

## O que está aqui (2026-09-05)

**76 specs**, em duas levas.

### Leva 2 — todas até a 079, por decisão do mantenedor

Ele confirmou que tudo até a `079` já foi implementado. **69 pastas** movidas de uma vez.

**302 referências ao caminho antigo foram corrigidas no mesmo commit**, em 72 arquivos — **99 delas só no `specs/backlog.md`**, que cita as specs por caminho e tem 57 débitos abertos apontando para elas. Sem essa correção o backlog passaria a mentir sobre onde cada spec vive, que é o oposto do objetivo. Os demais atingidos foram `sessoes/*`, `.specify/memory/project-state.md` e docs internas do `mesas`.

Verificação final: `rg` por `specs/0XX-` fora de `specs/olds/` devolveu **zero**.

### Leva 1 — o lote de validação do processo

Sete specs sem citação no `backlog.md` e com zero tarefas abertas, escolhidas para provar o método antes de mexer em escala.

| spec | evidência no código |
|---|---|
| `004-mesas-sso-gate-d` | allowlist de `return` em `apps/accounts/src/app.ts:175` (via `BRAND_DOMAIN`), com 19 asserções em `app.test.ts`; `mesas` consome `@artificio/ui` |
| `006-ui-header-user-menu` | dropdown do avatar em `packages/ui/src` |
| `007-ui-header-parity` | header `sticky` em `packages/ui/src/styles.css` |
| `010-ui-nav-logo` | `defaultNavItems` exportado pelo pacote e consumido por `apps/site` |
| `092-design-system-uniformizacao` | `packages/ui/src/tokens.ts` |
| `097-mesas-paridade-editor-contatos` | `ContactMethodsEditor.tsx` |
| `098-mesas-usabilidade-editor` | `ProfilePart` / `PROFILE_PARTS` no editor de perfil |

## O que segue ativo

**19 specs em `specs/`:** `080` a `091`, `093` a `096`, `099`, `100`, `101`. A `092`, `097` e `098` saíram na leva 1 por já estarem verificadas.
