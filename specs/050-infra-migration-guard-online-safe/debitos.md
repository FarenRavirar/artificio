# Débitos — Spec 050

## DEB-050-01 — Smells SonarCloud nos scripts shell novos (`[[`, stderr, constantes)

- **Origem:** SonarCloud no PR #95 (2026-06-24), 3 arquivos shell novos da spec 050.
- **Estado:** **fechado** (T26, 2026-06-24).
- **Severidade:** Major/Minor (Code Smell). **Não bloqueia** — ShellCheck (gate real do `_lint-shell.yml`) está verde; são smells de estilo/manutenção.

### Achados (por arquivo)

| Arquivo | Linhas | Smell |
|---|---|---|
| `scripts/deploy/reconcile_migrations.sh` | L19, L30, L73, L90, L94, L106, L138 | usar `[[` em vez de `[` |
| `scripts/deploy/reconcile_migrations.sh` | L103 | redirecionar mensagem de erro para `>&2` |
| `scripts/deploy/test_migration_guard.sh` | L25, L40, L102 | usar `[[` em vez de `[` |
| `scripts/deploy/test_migration_guard.sh` | L103 | redirecionar erro para `>&2` |
| `scripts/deploy/test_migration_reconcile.sh` | L45, L58, L132 | usar `[[` em vez de `[` |
| `scripts/deploy/test_migration_reconcile.sh` | L133 | redirecionar erro para `>&2` |
| `scripts/deploy/test_migration_reconcile.sh` | L118 | constante para literal `migration_200_test.sql` (×5) |
| `scripts/deploy/test_migration_reconcile.sh` | L125 | constante para literal `compose.yml` (×5) |

### Investigação (verdade material — código, não doc)

- `[ ]` é o **padrão estabelecido** dos scripts de deploy do repo: `scripts/deploy/lib_migrations.sh` usa 14× `[` (5× `[[`); `apply_required_migrations.sh` 12× `[` (1× `[[`). Logo o smell `[`→`[[` é real (Sonar/best-practice) porém **estilístico**, e corrigir só os 3 novos diverge da suíte.
- **ShellCheck** (gate obrigatório do `_lint-shell.yml`) passa com `[ ]` — não é erro funcional.
- `>&2` em erro **já é parcialmente padrão** nos novos scripts (os gates R9 do reconcile usam `>&2`); os L103/L133 flagrados são `echo` de erro que escaparam do redirecionamento — correção legítima e barata.
- Constantes (test_migration_reconcile) — manutenção legítima, baixo custo.

### Decisão / próximo passo (DeepSeek)

1. **Corrigir os 3 arquivos novos** (best-practice desde o nascimento): `[`→`[[` nas linhas acima, `>&2` nos erros L103/L133, constantes no test_reconcile (L118/L125). Manter ShellCheck verde e os testes (28/28 e 7/7) passando.
2. **Não** mexer nos scripts antigos nesta task (evitar refactor grande na PR de fix). A convergência da suíte antiga vai para débito separado abaixo.

## DEB-050-03 — `--force` consumido como `db_user` no `--mark-applied` (bug de correção)

- **Origem:** ChatGPT Codex no PR #95 (2026-06-24). **Confirmado no código** (`scripts/deploy/reconcile_migrations.sh:83-91`).
- **Estado:** **fechado** (T27, 2026-06-24).
- **Severidade:** ~~Major / correção~~ — corrigido.

### Bug

`cmd_mark_applied` faz parsing posicional `db_user="${4:-admin}" db_name="${5:-mesas_rpg}"` e só procura `--force` em `${@:6}`. Na forma documentada/legada sem DB args explícitos:

```
reconcile_migrations.sh --mark-applied <version> <compose-prod> <db_service> --force
```

o `--force` cai na posição 4 → vira `db_user="--force"` (corrompe o `psql -U`), e o scan a partir do arg 6 não acha nada → `force=false`. Resultado: o gate R9a (`prod exige --force`) **rejeita** a reconciliação de prod **mesmo o operador tendo passado `--force`**. Pior: só funciona se o operador souber passar `admin mesas_rpg` antes do `--force`.

### Correção (DeepSeek)

Parsear `--force` **antes** de atribuir os DB args opcionais (extrair/remover `--force` de qualquer posição, depois posicionar o resto), ou escanear desde o primeiro arg opcional. Garantir que:
- `--mark-applied <v> <compose> <db_service> --force` → `force=true`, `db_user`/`db_name` = defaults.
- `--mark-applied <v> <compose> <db_service> <user> <db> --force` → continua funcionando.
- `db_user` nunca recebe `--force`.

Cobrir ambas as formas no `test_migration_reconcile.sh` (caso prod-force sem DB args explícitos → NEW, não rejeitado).

## DEB-050-04 — Guard não remove comentário de bloco multilinha (falso-positivo persiste)

- **Origem:** revisão PR #95 (2026-06-24). **Confirmado** em `scripts/deploy/lib_migrations.sh:62`.
- **Estado:** **fechado** (T28, 2026-06-24).
- **Severidade:** **Major / correção** — é a mesma classe do bug que originou a spec (falso-positivo do guard).

### Bug

O strip atual `sed -e 's/--.*//' -e 's/\/\*.*\*\///g'` é **line-based**: `.*` não cruza `\n`. Um comentário de bloco multilinha:

```sql
/* nota:
   DROP TABLE x;
*/
```

deixa o `DROP TABLE x` numa linha intermediária **sem** ser removido → o grep dispara → falso-positivo. O caso single-line (`/* DROP TABLE x */`) já é coberto, o multilinha não.

### Correção (DeepSeek)

Remover comentários de bloco **através de newlines** antes do grep — ex.: slurp do arquivo (`sed ':a;N;$!ba; s|/\*[^*]*\*+([^/*][^*]*\*+)*/||g'`) ou ferramenta que faça non-greedy multilinha (perl `-0777 -pe 's{/\*.*?\*/}{}gs'` se disponível; senão awk). Cuidar para não comer conteúdo entre dois blocos distintos (non-greedy). Adicionar ao `test_migration_guard.sh` um caso verde: `/* DROP TABLE x */` quebrado em múltiplas linhas → guard passa (return 0).

## DEB-050-05 — `--list` engole falhas de docker/psql (mascara erro como sucesso)

- **Origem:** revisão PR #95 (2026-06-24). **Confirmado** em `scripts/deploy/reconcile_migrations.sh:72-78` (`cmd_list`).
- **Estado:** **fechado** (T29, 2026-06-24).
- **Severidade:** **Major / confiabilidade.**

### Bug

`cmd_list` lê `_reconcile_query` via process substitution `< <(...)` — o exit code do `docker compose/psql` é **perdido** (process substitution não propaga falha). E `list_pending_by_set_diff ... || true` **engole** qualquer erro. Resultado: falha de conexão/DB indisponível aparece como `--list` bem-sucedido com saída vazia → operador acha que não há migrations quando na verdade o comando falhou.

### Correção (DeepSeek)

Capturar a saída de `_reconcile_query` em variável e **checar o exit**; remover o `|| true` de `list_pending_by_set_diff` e **propagar** a falha (retornar ≠ 0 com mensagem em `>&2`). Status do comando tem que refletir o resultado real de cada chamada. Cobrir no teste (stub que falha → `cmd_list` retorna erro, não 0 com vazio).

## DEB-050-06 — Guard com `perl` falha-aberto (dependência externa no caminho de segurança)

- **Origem:** verificação do mantenedor/Claude pós-T28 (2026-06-24). `scripts/deploy/lib_migrations.sh:63`.
- **Estado:** **fechado** (T30, 2026-06-24).
- **Severidade:** **Low** (rebaixada após verificação) — dependência satisfeita nos 2 ambientes de execução; resta só endurecer o design.

### Verificação (2026-06-24)

- **VM host:** `perl 5.38.2` presente (`ssh faren 'command -v perl'` → `/usr/bin/perl`). O guard roda no host da VM (via `docker compose exec`), não no container — perl satisfeito.
- **CI:** runners GitHub ubuntu têm perl por padrão (`_lint-shell.yml`).
- **Conclusão:** o fail-open **não pode disparar** nos ambientes atuais. Não precisa instalar nada. Risco real ≈ 0; resta só remover o footgun de design.

### Bug

T28 introduziu `perl -0777 -pe 's{/\*.*?\*/}{}gs'` para strip multilinha. Se `perl` **não existir**, `if perl|sed|grep` falha → `if` false → guard **não bloqueia** (**falha-aberto**). Um guard de segurança deve **falhar-fechado**.

### Correção (DeepSeek) — decisão

**Manter `perl`** (é a ferramenta correta para non-greedy multilinha; `sed` puro `:a;N;$!ba` seria frágil para múltiplos blocos) **e capturar a saída + checar o exit do perl** — fail-closed cobre perl **ausente E quebrado em runtime** (não só ausente):

```sh
local stripped
if ! stripped=$(perl -0777 -pe 's{/\*.*?\*/}{}gs' "$filepath"); then
  echo "::error::perl ausente ou falhou ao processar $filepath — guard fail-closed."
  return 1
fi
if printf '%s\n' "$stripped" | sed 's/--.*//' | grep -Eiq '...'; then ...
```

> **Refino aplicado pelo mantenedor/Claude (2026-06-24):** a 1ª versão T30 usava só `command -v perl` (cobre ausente, mas **não** perl presente-porém-quebrado: saída vazia → grep não acha → fail-open). Trocado para captura+checagem de exit. Placement movido para **dentro** do caminho online-safe (manual-risk não precisa de perl). Smoke: perl quebrado→online-safe exit 1, manual-risk exit 0, DROP real pós-comentário multilinha→exit 1. `test_migration_guard.sh` 29/29 verde.

## DEB-050-02 — Convergência de estilo dos scripts de deploy antigos (`[`→`[[`)

- **Origem:** investigação do DEB-050-01.
- **Estado:** aberto (follow-up, fora da PR #95).
- **Escopo:** `scripts/deploy/lib_migrations.sh`, `apply_required_migrations.sh`, `test_migration_lock.sh`, `validate_branch_invariant.sh` — padronizar `[`→`[[` + erros em `>&2` para alinhar com os 3 novos.
- **Por quê:** após o DEB-050-01, os arquivos novos ficam best-practice e os antigos não — inconsistência. Convergir é o caminho durável, mas é refactor próprio (com re-rodar ShellCheck + os 3 self-tests), não deve entrar na PR de fix do guard.
- **Próximo passo:** SDD Lite/infra própria; rodar `_lint-shell.yml` local + CI antes de fechar.
