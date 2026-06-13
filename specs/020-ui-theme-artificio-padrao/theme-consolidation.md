# Consolidacao de `artificio_theme`

> Spec 020 T5. Estado em 2026-06-13: comportamento corrigido por D067; consolidacao de codigo ainda e rollout futuro.

## Fonte canonica

`packages/ui/src/theme.tsx` e a fonte do contrato:

- cookie unico: `artificio_theme`, `Domain=.artificiorpg.com`, 1 ano;
- leitura: cookie -> `localStorage.theme` -> preferencia do SO -> `light`;
- escrita: somente em escolha explicita via `setTheme`;
- aplicacao: `document.documentElement.dataset.theme = "light" | "dark"`;
- API publica: `readThemeCookie`, `writeThemeCookie`, `resolveTheme`, `applyTheme`, `setTheme`, `ThemeIcon`, `ThemeToggle`.

Regra: app React deve consumir essa API. App estatico/Astro pode ter inline boot pequeno para evitar flash antes do paint, mas esse espelho precisa ser documentado, minimo e sem escrita no boot.

## Inventario atual

| Consumidor | Estado | Acao |
|---|---|---|
| `glossario` SPA | Usa `applyTheme`, `resolveTheme` e `setTheme`; `index.html` tem inline boot zero-flash que espelha o canonical. | Manter. Futuro: extrair helper static-friendly se o padrao se repetir. |
| `mesas` SPA | Usa `setTheme` no toggle; boot proprio le apenas o cookie e cai em `dark` sem cookie. | Manter excecao deliberada: default-dark operacional. Nao usar `resolveTheme` puro aqui enquanto mesas precisar ignorar SO/localStorage quando nao ha cookie. |
| `accounts` SPA | Comportamento D067 OK: nao escreve cookie no boot; escreve apenas no toggle. Ainda duplica helpers locais (`THEME_COOKIE`, cookie, localStorage, matchMedia, dataset). | Migrar para API `@artificio/ui/theme` em fatia de codigo futura. |
| `site` Astro | Comportamento D067 OK: inline boot so le; toggle escreve cookie. Ainda duplica leitura/escrita em script inline. | Manter como excecao zero-JS ate existir helper static-friendly do `@artificio/ui`; reduzir duplicacao depois. |

## Plano de migracao

1. `accounts`: substituir helpers locais por `resolveTheme`/`setTheme` de `@artificio/ui`; manter estado React local apenas para trocar icone/logo. Se o parametro `?theme=` ainda for necessario no login, criar API explicita no `@artificio/ui` ou tratar como override local que nao grava cookie no boot.
2. `site`: preservar inline boot no `<head>` para zero-flash. Depois criar helper static-friendly versionado em `packages/ui` (ex.: string/script exportavel) para site e glossario nao copiarem regex/cookie.
3. `mesas`: documentar como excecao permanente enquanto default-dark for regra de produto. O boot pode chamar `readThemeCookie` se houver helper static-friendly; se nao houver cookie, continua `dark`.
4. `glossario`: sem migracao de runtime; apenas manter o inline boot alinhado ao canonical ate existir helper static-friendly.

## Rollback

- Reverter uma migracao de app volta ao helper local anterior sem tocar banco, VM ou cookie existente.
- Se a propagacao cross-subdominio causar regressao visual, desabilitar o toggle do app afetado e parar novas escritas; o cookie antigo expira ou e sobrescrito na proxima escolha do usuario.
- Para `mesas`, rollback seguro e manter `cookie ? cookie : "dark"`; sem cookie, prod continua dark.
- Para `site`, rollback e remover o listener do toggle mantendo o boot somente-leitura.

## Validacao de fechamento

- `rg "artificio_theme|matchMedia|localStorage|getInitialTheme|writeThemeCookie|dataset.theme"` mostra so ocorrencias permitidas.
- `accounts` build verde apos migracao.
- `site` build/preview verde, sem flash no primeiro paint.
- `mesas` sem cookie abre dark; com cookie `light` abre light; toggle grava cookie compartilhado.
- `glossario` respeita cookie e troca tema ao vivo.
- Smoke cross-subdominio: escolher tema em um projeto e abrir outro preserva a escolha; nenhuma escrita de cookie acontece no boot.

## Resultado T5

T5 esta fechado como planejamento: duplicacoes locais foram identificadas, excecoes foram classificadas e migracao/rollback estao descritos. A remocao de duplicacao em `accounts`/`site` segue como implementacao futura dentro de T14 ou fatia propria autorizada.
